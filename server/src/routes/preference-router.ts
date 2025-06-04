import { Router } from "express";
import {
  getPreferences,
  upsertPreferences,
} from "../controllers/preference-controller";
import { authenticateJWT } from "../middleware/auth-middleware";
import { validateRequest } from "../middleware/validate-request";
import { preferencesValidator } from "../middleware/validators";

const router = Router();

router.get("/", authenticateJWT, getPreferences);
router.put(
  "/",
  authenticateJWT,
  preferencesValidator,
  validateRequest,
  upsertPreferences,
);

export default router;
