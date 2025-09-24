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

const router: Router = Router();

router.get("/:reminder_id", limiter(), handleGetReminderById);
router.post(
  "/:problem_id",
  limiter({ cost: 3 }),
  zodValidate({ body: createReminderSchema }),
  handleCreateReminder,
);
router.put(
  "/:reminder_id",
  limiter({ cost: 2 }),
  zodValidate({ body: updateReminderSchema }),
  handleUpdateReminder,
);
router.delete("/:reminder_id", limiter({ cost: 2 }), handleDeleteReminder);

export default router;
