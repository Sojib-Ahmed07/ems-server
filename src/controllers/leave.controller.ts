import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Creates an initial pending leave request for an authenticated employee.
 */
export const requestLeave = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message:
          "Missing mandatory parameters. leaveType, startDate, endDate, and reason are required.",
      });
    }

    // 1. Resolve operational profile mapping from the authenticated user
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message:
          "Employee profile not found. Complete profile sync setup first.",
      });
    }

    // 2. Commit the pending transaction log to database
    const newLeave = await prisma.leave.create({
      data: {
        employeeId: profile.id,
        leaveType: leaveType.toUpperCase(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason.trim(),
        status: "PENDING", // Enforce database status schema state
      },
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully and is awaiting review.",
      data: newLeave,
    });
  } catch (error) {
    console.error("Submit Leave Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error processing leave submission.",
    });
  }
};

/**
 * Updates a pending leave status constraint.
 * Restricted to ADMIN, HR, or MANAGER clearance tiers via the router layout.
 */
export const processLeaveApproval = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expects "APPROVED" or "REJECTED"

    // Type guard: Ensure id is a single, valid string parameter before passing to Prisma
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters: ID must be a single string.",
      });
    }

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid action type. Status parameter must be 'APPROVED' or 'REJECTED'.",
      });
    }

    // 1. Verify existence of target database model
    // TypeScript is happy here because id has been narrowed to 'string'
    const existingLeave = await prisma.leave.findUnique({
      where: { id },
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: "Target leave record could not be found.",
      });
    }

    // 2. Perform transactional status mutation update
    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({
      success: true,
      message: `Leave entry successfully marked as ${status.toLowerCase()}.`,
      data: updatedLeave,
    });
  } catch (error) {
    console.error("Process Leave Approval Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error evaluating leave decision.",
    });
  }
};
