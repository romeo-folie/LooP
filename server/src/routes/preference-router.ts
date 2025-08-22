import { Router } from "express";
import {
  getPreferences,
  upsertPreferences,
} from "../controllers/preference-controller";
import { authenticateJWT } from "../middleware/auth-middleware";
import { zodValidate } from "../middleware/validate-request";
import { preferenceSchema } from "../middleware/validators";

const router = Router();

router.get("/", authenticateJWT, getPreferences);
router.put(
  "/",
  authenticateJWT,
  zodValidate({ body: preferenceSchema }),
  upsertPreferences,
);

export default router;
