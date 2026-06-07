import { Router } from "express";
import { 
  syncOrCreateProfile, 
  getPendingProfiles, 
  activateProfile 
} from "../controllers/employee.controller";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

// 🔓 Global Requirement: A user must be logged in to access any endpoint inside this file
router.use(requireAuth);

// Base user action endpoint
router.post("/sync", syncOrCreateProfile);

// 🔒 Admin Isolation: Protect these endpoints exclusively for ADMIN personnel
router.get("/pending", requireAdmin, getPendingProfiles);
router.put("/activate/:id", requireAdmin, activateProfile);

export default router;