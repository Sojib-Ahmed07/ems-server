import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Logs a daily clock-in event for the authenticated employee.
 * Enforces a strict one-log-per-day policy.
 */
export const clockIn = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // 1. Fetch the operational employee profile linked to the session
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found. Please sync your profile first.",
      });
    }

    // 2. Set up a normalized date representing today (midnight) to prevent multi-punching
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. Look for an existing check-in matching today's date boundary
    const existingLog = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingLog) {
      return res.status(400).json({
        success: false,
        message: "You have already clocked in for today.",
      });
    }

    // 4. Create the new attendance record
    const record = await prisma.attendance.create({
      data: {
        employeeId: profile.id,
        status: "PRESENT", // Defaults to present; can adjust for "LATE" later if needed
      },
    });

    return res.status(201).json({
      success: true,
      message: "Clock-in recorded successfully.",
      data: record,
    });
  } catch (error) {
    console.error("Clock In Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during clock-in.",
    });
  }
};

/**
 * Updates today's existing attendance record with a clock-out timestamp.
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
        message: "Employee profile not found.",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's open record (where clockOut is still null)
    const activeLog = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        clockOut: null,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!activeLog) {
      return res.status(400).json({
        success: false,
        message: "No active clock-in session found for today, or you have already clocked out.",
      });
    }

    // Update the record with the current timestamp
    const updatedRecord = await prisma.attendance.update({
      where: { id: activeLog.id },
      data: {
        clockOut: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Clock-out recorded successfully.",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Clock Out Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during clock-out.",
    });
  }
};