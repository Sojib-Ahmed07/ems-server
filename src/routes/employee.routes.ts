import { Router } from "express";
import { syncOrCreateProfile } from "../controllers/employee.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Secure globally: A user must be logged in to initialize their employee profile
router.use(requireAuth);

// Endpoint used by the frontend upon initialization/dashboard load
router.post("/sync", syncOrCreateProfile);

export default router;
