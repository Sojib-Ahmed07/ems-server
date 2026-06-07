import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Ensures an authenticated user has an operational EmployeeProfile record.
 * If it doesn't exist, it auto-generates one. Then returns the complete profile.
 */
export const syncOrCreateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // 1. Check if the profile already exists (Removed manager reference to align with schema)
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            image: true,
            department: true,
          },
        },
      },
    });

    // 2. If it exists, return it immediately
    if (profile) {
      return res.status(200).json({
        success: true,
        message: "Profile retrieved successfully.",
        data: profile,
      });
    }

    // 3. If it doesn't exist, generate a unique timestamp-based code
    const uniqueId = Date.now().toString().slice(-4);
    const generatedEmployeeCode = `EMP-${uniqueId}`;

    profile = await prisma.employeeProfile.create({
      data: {
        userId,
        employeeCode: generatedEmployeeCode,
        employmentStatus: "PROBATION", // Defaults to probation as per schema
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            image: true,
            department: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Operational employee profile created successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("Sync Employee Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while syncing profile.",
    });
  }
};

/**
 * Fetches all organizational tracking profiles currently locked in PROBATION.
 */
export const getPendingProfiles = async (req: Request, res: Response) => {
  try {
    const pendingProfiles = await prisma.employeeProfile.findMany({
      where: {
        employmentStatus: "PROBATION",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: pendingProfiles,
    });
  } catch (error) {
    console.error("Fetch Pending Profiles Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while compiling pending roster.",
    });
  }
};

/**
 * Upgrades a designated employee profile's status from PROBATION to ACTIVE.
 */
export const activateProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ✅ STRICT TYPE GUARD: Enforce that id is a singular string, clearing up the Prisma type conflict!
    if (typeof id !== "string") {
      return res.status(400).json({
        success: false,
        message: "Bad Request: Invalid parameters passed to entry path.",
      });
    }

    const updatedProfile = await prisma.employeeProfile.update({
      where: { id },
      data: {
        employmentStatus: "ACTIVE",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Personnel profile status successfully upgraded to ACTIVE.",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Activate Profile Error:", error);

    if ((error as any).code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Target employee profile record could not be found.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error during profile activation.",
    });
  }
};
