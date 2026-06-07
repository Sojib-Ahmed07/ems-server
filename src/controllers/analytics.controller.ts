import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const { id: userId, role } = req.user!;

    // ==========================================
    // 🛠️ PATH A: ADMIN DASHBOARD METRICS
    // ==========================================
    if (role === "ADMIN") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Parallel database pooling execution to maximize performance
      const [
        totalEmployees,
        activeClockedIn,
        pendingLeavesCount,
        pendingProfilesCount,
      ] = await Promise.all([
        prisma.employeeProfile.count(),
        prisma.attendance.count({
          where: {
            date: { gte: todayStart, lte: todayEnd },
            clockOut: null, // Still inside the building
          },
        }),
        prisma.leave.count({
          where: { status: "PENDING" },
        }),
        prisma.employeeProfile.count({
          where: { employmentStatus: "PROBATION" },
        }),
      ]);

      return res.status(200).json({
        success: true,
        role: "ADMIN",
        metrics: {
          totalEmployees,
          currentlyClockedIn: activeClockedIn,
          pendingApprovalsQueue: pendingLeavesCount,
          onboardingProbations: pendingProfilesCount,
          attendanceRateToday: totalEmployees > 0 
            ? Math.round((activeClockedIn / totalEmployees) * 100) 
            : 0,
        },
      });
    }

    // ==========================================
    // 👤 PATH B: EMPLOYEE DASHBOARD METRICS
    // ==========================================
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee data profile structure missing.",
      });
    }

    // Pull personal logs concurrently
    const [totalAttendanceDays, lateDaysCount, upcomingLeaves] = await Promise.all([
      prisma.attendance.count({
        where: { employeeId: profile.id },
      }),
      prisma.attendance.count({
        where: { 
          employeeId: profile.id,
          status: "LATE",
        },
      }),
      prisma.leave.findMany({
        where: {
          employeeId: profile.id,
          status: "APPROVED",
          startDate: { gte: new Date() },
        },
        orderBy: { startDate: "asc" },
        take: 3, // Only get the next 3 upcoming holidays
      }),
    ]);

    return res.status(200).json({
      success: true,
      role: "EMPLOYEE",
      metrics: {
        daysWorkedThisPeriod: totalAttendanceDays,
        tardinessCount: lateDaysCount,
        punctualityRate: totalAttendanceDays > 0
          ? Math.round(((totalAttendanceDays - lateDaysCount) / totalAttendanceDays) * 100)
          : 100,
        upcomingHolidays: upcomingLeaves.map(leave => ({
          id: leave.id,
          type: leave.leaveType,
          start: leave.startDate,
          end: leave.endDate,
        })),
      },
    });

  } catch (error) {
    console.error("Dashboard Analytics Compilation Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error gathering metric summaries.",
    });
  }
};