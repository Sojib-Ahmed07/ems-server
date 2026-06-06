import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Ensures an authenticated user has an operational EmployeeProfile record.
 * If it doesn't exist, it auto-generates one. Then returns the complete profile.
 */
export const syncOrCreateProfile = async (req: Request, res: Response) => {
  try {
    // req.user is safely populated by your requireAuth middleware
    const userId = req.user!.id;

    // 1. Check if the profile already exists
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
        manager: true,
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

    // 3. If it doesn't exist, we generate a brand-new profile sequence
    // To keep it simple and clean, we'll generate a unique timestamp-based code
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
        manager: true,
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
