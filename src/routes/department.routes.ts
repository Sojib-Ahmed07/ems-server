import { Router } from "express";
import {
  createDepartment,
  getDepartments,
} from "../controllers/department.controller";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Global rule: You must be logged in to access any department information
router.use(requireAuth);

// Read-only endpoint: Accessible by any valid Employee, Manager, or Admin
router.get("/", getDepartments);

// Write endpoint: Explicitly guarded; rejects non-ADMIN requests with a 403 Forbidden
router.post("/", requireAdmin, createDepartment);

export default router;
