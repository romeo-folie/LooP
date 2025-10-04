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
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";

const router: Router = Router();

router.get("/", limiter(), handleListProblems);
router.get("/:problem_id/reminders", limiter(), handleListRemindersByProblemId);
router.get("/:problem_id", limiter(), handleGetProblemById);
router.post(
  "/",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  zodValidate({ body: createProblemSchema }),
  handleCreateProblem,
);
router.put(
  "/:problem_id",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  zodValidate({ body: createProblemSchema }),
  handleUpdateProblem,
);
router.put(
  "/:problem_id/practice",
  limiter({ cost: 5 }),
  verifyCsrfToken,
  zodValidate({ body: practiceFeedbackSchema }),
  handlePracticeFeedback,
);
router.delete(
  "/:problem_id",
  limiter({ cost: 3 }),
  verifyCsrfToken,
  handleDeleteProblem,
);

export default router;
