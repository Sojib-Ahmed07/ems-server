import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Utility: Haversine mathematical algorithm calculating distance between
 * two geographical points in kilometers.
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's Radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Logs a standard Clock-In action for the day with perimeter geofence validation.
 */
export const clockIn = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { coords } = req.body; // Expects structural format: { lat: number, lng: number }

    // 🏢 CHANGE THESE TO MATCH YOUR EXACT PHYSICAL OFFICE COORDINATES
    const OFFICE_LAT = 40.7128;
    const OFFICE_LNG = -74.006;
    const PERMITTED_RADIUS_KM = 0.2; // 200 Meters geofencing lock boundary limit

    // 1. Validate perimeter telemetry presence
    if (
      !coords ||
      typeof coords.lat !== "number" ||
      typeof coords.lng !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Bad Request: Precise device positioning telemetry coordinates are required to clock in.",
      });
    }

    // 2. Execute Haversine validation calculation check
    const spaceDistance = calculateDistance(
      coords.lat,
      coords.lng,
      OFFICE_LAT,
      OFFICE_LNG,
    );
    if (spaceDistance > PERMITTED_RADIUS_KM) {
      return res.status(403).json({
        success: false,
        message: `Clock-In Forbidden: You are outside the authorized workspace parameter boundaries (${Math.round(spaceDistance * 1000)} meters away).`,
      });
    }

    // 3. Locate the employee profile footprint
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Operational employee profile footprint not found.",
      });
    }

    // 4. Derive a standardized date string for today (Midnight UTC reference normalized)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 5. Check if the user has already recorded a clock-in parameter today
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

    // 6. Automatic Business Logic rule: flag as LATE if checking in after 09:30 AM local system time
    const now = new Date();
    let computedStatus: "PRESENT" | "LATE" = "PRESENT";
    if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) {
      computedStatus = "LATE";
    }

    // 7. Commit record to PostgreSQL with validated coordinates
    const attendanceRecord = await prisma.attendance.create({
      data: {
        employeeId: profile.id,
        date: today,
        clockIn: now,
        status: computedStatus,
        lat: coords.lat,
        lng: coords.lng,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Successfully clocked in for today's operational shift within workplace boundaries.",
      data: attendanceRecord,
    });
  } catch (error) {
    console.error("Clock In Error:", error);
    return res.status(500).json({
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
    return res.status(500).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to assemble active workforce rosters.",
    });
  }
};
