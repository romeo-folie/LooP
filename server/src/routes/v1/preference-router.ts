import { Router } from "express";
import {
  handleGetPreferences,
  handleUpsertPreferences,
} from "../../controllers/preference-controller";
import { zodValidate } from "../../middleware/validate-request";
import { preferenceSchema } from "../../middleware/validators";
import { limiter } from "../../middleware/rate-limiter";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";

const router = Router();

router.get("/", limiter(), handleGetPreferences);
router.put(
  "/",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  zodValidate({ body: preferenceSchema }),
  handleUpsertPreferences,
);

export default router;
