import { Router } from "express";
import {
  handlePracticeFeedback,
  handleCreateProblem,
  handleListProblems,
  handleGetProblemById,
  handleUpdateProblem,
  handleDeleteProblem,
  handleListRemindersByProblemId,
} from "../../controllers/problem-controller";
import { zodValidate } from "../../middleware/validate-request";
import {
  createProblemSchema,
  practiceFeedbackSchema,
} from "../../middleware/validators";
import { limiter } from "../../middleware/rate-limiter";

const router: Router = Router();

router.get("/", limiter(), handleListProblems);
router.get(
  "/:problem_id/reminders",
  limiter(),
  handleListRemindersByProblemId,
);
router.get("/:problem_id", limiter(), handleGetProblemById);
router.post(
  "/",
  limiter({ cost: 2 }),
  zodValidate({ body: createProblemSchema }),
  handleCreateProblem,
);
router.put(
  "/:problem_id",
  limiter({ cost: 2 }),
  zodValidate({ body: createProblemSchema }),
  handleUpdateProblem,
);
router.put(
  "/:problem_id/practice",
  limiter({ cost: 5 }),
  zodValidate({ body: practiceFeedbackSchema }),
  handlePracticeFeedback,
);
router.delete("/:problem_id", limiter({ cost: 3 }), handleDeleteProblem);

export default router;
