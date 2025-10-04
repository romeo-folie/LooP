import { Router } from "express";
import {
  handleCreateReminder,
  handleDeleteReminder,
  handleGetReminderById,
  handleUpdateReminder,
} from "../../controllers/reminder-controller";
import { zodValidate } from "../../middleware/validate-request";
import {
  createReminderSchema,
  updateReminderSchema,
} from "../../middleware/validators";
import { limiter } from "../../middleware/rate-limiter";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";

const router: Router = Router();

router.get("/:reminder_id", limiter(), handleGetReminderById);
router.post(
  "/:problem_id",
  limiter({ cost: 3 }),
  verifyCsrfToken,
  zodValidate({ body: createReminderSchema }),
  handleCreateReminder,
);
router.put(
  "/:reminder_id",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  zodValidate({ body: updateReminderSchema }),
  handleUpdateReminder,
);
router.delete(
  "/:reminder_id",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  handleDeleteReminder,
);

export default router;
