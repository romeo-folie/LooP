import { Router } from "express";
import {
  handleGetPreferences,
  handleUpsertPreferences,
} from "../../controllers/preference-controller";
import { zodValidate } from "../../middleware/validate-request";
import { preferenceSchema } from "../../middleware/validators";
import { limiter } from "../../middleware/rate-limiter";

const router = Router();

router.get("/", handleGetPreferences);
router.put(
  "/",
  limiter({ cost: 2 }),
  zodValidate({ body: preferenceSchema }),
  handleUpsertPreferences,
);

export default router;
