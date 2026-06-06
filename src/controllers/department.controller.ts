import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * Creates a new company department.
 * Restricted to ADMIN role via router middleware.
 */
export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Department name and code are required.",
      });
    }

    const normalizedCode = code.toUpperCase().trim();

    // Prevent duplicate entries using the unique constraint on code
    const existingDept = await prisma.department.findUnique({
      where: { code: normalizedCode },
    });

    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: `Department code '${normalizedCode}' already exists.`,
      });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: normalizedCode,
      },
    });

    return res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error("Create Department Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * Retrieves all departments with their current employee headcounts.
 * Accessible by all authenticated users.
 */
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("Get Departments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
