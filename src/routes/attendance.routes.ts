import { Router } from "express";
import { 
  clockIn, 
  clockOut, 
  getTodayStatus, 
  getLiveOnSiteGrid 
} from "../controllers/attendance.controller";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

// 🔓 Global Lock: All endpoints require an active authenticated user context session
router.use(requireAuth);

// Employee operational actions
router.get("/today-status", getTodayStatus);
router.post("/clock-in", clockIn);
router.post("/clock-out", clockOut);

// 🔒 Admin restricted streams
router.get("/live-onsite", requireAdmin, getLiveOnSiteGrid);

export default router;