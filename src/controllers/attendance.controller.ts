import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Logs a standard Clock-In action for the day.
 */
export const clockIn = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // 1. Locate the employee profile footprint
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Operational employee profile footprint not found.",
      });
    }

    // 2. Derive a standardized date string for today (Midnight UTC reference normalized)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 3. Check if the user has already recorded a clock-in parameter today
    const existingRecord = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: profile.id,
          date: today,
        },
      },
    });

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message:
          "Bad Request: An active attendance log is already running for today.",
      });
    }

    // 4. Automatic Business Logic rule: flag as LATE if checking in after 09:30 AM local system time
    const now = new Date();
    let computedStatus: "PRESENT" | "LATE" = "PRESENT";
    if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) {
      computedStatus = "LATE";
    }

    // 5. Commit record to PostgreSQL
    const attendanceRecord = await prisma.attendance.create({
      data: {
        employeeId: profile.id,
        date: today,
        clockIn: now,
        status: computedStatus,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Successfully clocked in for today's operational shift.",
      data: attendanceRecord,
    });
  } catch (error) {
    console.error("Clock In Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error logging check-in.",
      });
  }
};

/**
 * Logs a standard Clock-Out action for the ongoing day's session.
 */
export const clockOut = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Operational employee profile footprint not found.",
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Locate today's active checking parameter rows
    const activeRecord = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: profile.id,
          date: today,
        },
      },
    });

    if (!activeRecord) {
      return res.status(400).json({
        success: false,
        message: "Bad Request: No initial Clock-In trace exists for today.",
      });
    }

    if (activeRecord.clockOut) {
      return res.status(400).json({
        success: false,
        message:
          "Bad Request: A Clock-Out event has already been recorded for this session.",
      });
    }

    // Save the clock out event timestamp
    const updatedRecord = await prisma.attendance.update({
      where: { id: activeRecord.id },
      data: {
        clockOut: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Successfully logged checkout sequence. Have a wonderful evening!",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Clock Out Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error logging checkout.",
      });
  }
};

/**
 * Pulls down the ongoing operational shift matrix status for the current active employee.
 */
export const getTodayStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile context missing." });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const record = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: profile.id,
          date: today,
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get Today Status Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal database tracking error." });
  }
};

/**
 * Admin Panel Feature: Extracts all users currently clocked in on site right now.
 */
export const getLiveOnSiteGrid = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const liveStaff = await prisma.attendance.findMany({
      where: {
        date: today,
        clockOut: null, // Still on site working
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        clockIn: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: liveStaff,
    });
  } catch (error) {
    console.error("Get Live Staff Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to assemble active workforce rosters.",
      });
  }
};
