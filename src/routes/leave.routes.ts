import { Router } from "express";
import { requestLeave, processLeaveApproval } from "../controllers/leave.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Secure globally: Authentication baseline is mandatory
router.use(requireAuth);

// Transaction creation endpoint for general employees
router.post("/request", requestLeave);

// Status modification processing pipeline
// Later we will build a custom role-guard middleware if you need MANAGER/HR specific checks,
// but for now, we attach this endpoint securely under your core layer.
router.patch("/:id/approve", processLeaveApproval);

export default router;