import { Router } from "express";
import {
  handleCreateReminder,
  handleDeleteReminder,
  handleGetReminderById,
  handleListReminders,
  handleUpdateReminder,
} from "../../controllers/reminder-controller";
import { authenticateJWT } from "../../middleware/auth-middleware";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";
import { zodValidate } from "../../middleware/validate-request";
import { createReminderSchema } from "../../middleware/validators";

const router: Router = Router();

router.get("/:problem_id", authenticateJWT, handleListReminders);
router.get("/:reminder_id", authenticateJWT, handleGetReminderById);
router.post(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createReminderSchema }),
  handleCreateReminder,
);
router.put(
  "/:reminder_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createReminderSchema }),
  handleUpdateReminder,
);
router.delete(
  "/:reminder_id",
  verifyCsrfToken,
  authenticateJWT,
  handleDeleteReminder,
);

export default router;
