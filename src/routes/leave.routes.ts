import { Router } from "express";
import { 
  requestLeave, 
  processLeaveApproval, 
  getLeaveBalances, 
  getPendingLeaves 
} from "../controllers/leave.controller";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Secure globally: Authentication baseline is mandatory for all leave paths
router.use(requireAuth);

// Employee Channels
router.post("/request", requestLeave);
router.get("/balance/:employeeId", getLeaveBalances);

// Admin-Exclusive Channels
router.get("/pending", requireAdmin, getPendingLeaves);
router.patch("/:id/approve", requireAdmin, processLeaveApproval);

export default router;