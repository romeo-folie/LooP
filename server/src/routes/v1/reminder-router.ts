import { Router } from "express";
import {
  createReminder,
  deleteReminder,
  getReminderById,
  getRemindersByProblem,
  updateReminder,
} from "../../controllers/reminder-controller";
import { authenticateJWT } from "../../middleware/auth-middleware";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";
import { zodValidate } from "../../middleware/validate-request";
import { createReminderSchema } from "../../middleware/validators";

const router: Router = Router();

router.get("/:problem_id", authenticateJWT, getRemindersByProblem);
router.get("/:reminder_id", authenticateJWT, getReminderById);
router.post(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createReminderSchema }),
  createReminder,
);
router.put(
  "/:reminder_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createReminderSchema }),
  updateReminder,
);
router.delete(
  "/:reminder_id",
  verifyCsrfToken,
  authenticateJWT,
  deleteReminder,
);

export default router;
