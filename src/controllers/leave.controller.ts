import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Shared Helper: Calculates real-time leave metrics dynamically based on approved entries.
 * Aligns perfectly with the LeaveBalance contract interface expected by LeavePanel.tsx
 */
const calculateBalances = async (employeeId: string) => {
  // Hardcoded default allowances per system guidelines
  const policyAllowances = {
    ANNUAL: 15,
    SICK: 10,
    MATERNITY: 90,
    UNPAID: 30,
  };

  // Fetch every authorized/approved leave item associated with this profile
  const approvedLeaves = await prisma.leave.findMany({
    where: {
      employeeId,
      status: "APPROVED",
    },
  });

  // Compile totals of consumed days per classification type
  const consumedMap: Record<string, number> = {
    ANNUAL: 0,
    SICK: 0,
    MATERNITY: 0,
    UNPAID: 0,
  };

  approvedLeaves.forEach((leave) => {
    const type = leave.leaveType.toUpperCase();
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    
    // Calculate difference in operational calendar days (inclusive)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (type in consumedMap) {
      consumedMap[type] += diffDays;
    }
  });

  // Map into structured payload array matching your LeaveBalance UI contract layout
  return Object.keys(policyAllowances).map((type) => ({
    type,
    allocated: policyAllowances[type as keyof typeof policyAllowances],
    consumed: consumedMap[type] || 0,
  }));
};

/**
 * GET /api/leaves/balance/:employeeId
 * Retrieves the data balances matrix for an employee with absolute type-narrowing safeguards.
 */
export const getLeaveBalances = async (req: Request, res: Response) => {
  try {
    const targetEmployeeId = req.params.employeeId;

    // Strict type guard check to narrow down to a pure string primitive
    if (!targetEmployeeId || typeof targetEmployeeId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters: Employee ID must be a single string.",
      });
    }

    const dataMatrix = await calculateBalances(targetEmployeeId);

    return res.status(200).json({
      success: true,
      data: dataMatrix,
    });
  } catch (error) {
    console.error("Fetch Leave Balances Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error compilation processing leave sheets.",
    });
  }
};

/**
 * GET /api/leaves/pending
 * Retrieves all pending leaves across the enterprise for administrative dashboard tracking cards.
 * Guarded by requireAdmin middleware.
 */
export const getPendingLeaves = async (req: Request, res: Response) => {
  try {
    const pendingLeaves = await prisma.leave.findMany({
      where: { status: "PENDING" },
      include: {
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: pendingLeaves,
    });
  } catch (error) {
    console.error("Fetch Pending Leaves Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching pending clearance queue items.",
    });
  }
};

/**
 * POST /api/leaves/request
 * Creates an initial pending leave transaction log entry for an authenticated employee.
 */
export const requestLeave = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing mandatory parameters. leaveType, startDate, endDate, and reason are required.",
      });
    }

    // Resolve operational profile mapping from the authenticated user
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found. Complete profile sync setup first.",
      });
    }

    // Commit the pending transaction log to database
    const newLeave = await prisma.leave.create({
      data: {
        employeeId: profile.id,
        leaveType: leaveType.toUpperCase(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason.trim(),
        status: "PENDING",
      },
    });

    // Provide the frontend with the current balance tracking state array right away
    const currentBalances = await calculateBalances(profile.id);

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully and is awaiting review.",
      data: newLeave,
      updatedBalances: currentBalances,
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
 * PATCH /api/leaves/:id/approve
 * Updates a pending leave status constraint. Restricted to ADMIN only.
 */
export const processLeaveApproval = async (req: Request, res: Response) => {
  try {
    const leaveId = req.params.id;

    // Strict parameter evaluation block to eliminate dual 'string | string[]' variations
    if (!leaveId || typeof leaveId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid request parameters: ID must be a single string.",
      });
    }

    const { status } = req.body; // Expects "APPROVED" or "REJECTED"

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action type. Status parameter must be 'APPROVED' or 'REJECTED'.",
      });
    }

    // Verify existence of target database model
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message: "Target leave record could not be found.",
      });
    }

    // Perform transactional status mutation update
    const updatedLeave = await prisma.leave.update({
      where: { id: leaveId },
      data: { status },
    });

    // Recalculate sheets following authorization state mutations
    const updatedBalances = await calculateBalances(existingLeave.employeeId);

    return res.status(200).json({
      success: true,
      message: `Leave entry successfully marked as ${status.toLowerCase()}.`,
      data: updatedLeave,
      updatedBalances, 
    });
  } catch (error) {
    console.error("Process Leave Approval Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error evaluating leave decision.",
    });
  }
};