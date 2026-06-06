import { Router } from "express";
import { clockIn, clockOut } from "../controllers/attendance.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Secure globally: Employees must have an active login session to log time
router.use(requireAuth);

router.post("/clock-in", clockIn);
router.post("/clock-out", clockOut);

export default router;
