import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth-middleware";
import {
  handlePracticeFeedback,
  handleCreateProblem,
  handleListProblems,
  handleGetProblemById,
  handleUpdateProblem,
  handleDeleteProblem,
  handleListRemindersByProblemId,
} from "../../controllers/problem-controller";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";
import { zodValidate } from "../../middleware/validate-request";
import {
  createProblemSchema,
  practiceFeedbackSchema,
} from "../../middleware/validators";

const router: Router = Router();

router.get("/", authenticateJWT, handleListProblems);
router.get(
  "/:problem_id/reminders",
  authenticateJWT,
  handleListRemindersByProblemId,
);
router.get("/:problem_id", authenticateJWT, handleGetProblemById);
router.post(
  "/",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createProblemSchema }),
  handleCreateProblem,
);
router.put(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createProblemSchema }),
  handleUpdateProblem,
);
router.put(
  "/:problem_id/practice",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: practiceFeedbackSchema }),
  handlePracticeFeedback,
);
router.delete(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  handleDeleteProblem,
);

export default router;
