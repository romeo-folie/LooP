import { Router } from "express";
import {
  handleGetPreferences,
  handleUpsertPreferences,
} from "../../controllers/preference-controller";
import { authenticateJWT } from "../../middleware/auth-middleware";
import { zodValidate } from "../../middleware/validate-request";
import { preferenceSchema } from "../../middleware/validators";

const router = Router();

router.get("/", authenticateJWT, handleGetPreferences);
router.put(
  "/",
  authenticateJWT,
  zodValidate({ body: preferenceSchema }),
  handleUpsertPreferences,
);

export default router;
