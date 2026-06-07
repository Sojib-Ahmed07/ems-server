import { Router } from "express";
import { getDashboardAnalytics } from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Secure globally: Only logged-in users can fetch insights
router.use(requireAuth);

// Dynamic route: Automatically returns Admin or Employee data based on req.user.role
router.get("/dashboard", getDashboardAnalytics);

export default router;