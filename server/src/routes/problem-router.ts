import { Router } from "express";
import { authenticateJWT } from "../middleware/auth-middleware";
import {
  createProblem,
  getProblemById,
  getProblems,
  updateProblem,
  deleteProblem,
  handlePracticeFeedback,
} from "../controllers/problem-controller";
import { verifyCsrfToken } from "../middleware/verify-csrf-token";
import { zodValidate } from "../middleware/validate-request";
import {
  createProblemSchema,
  practiceFeedbackSchema,
} from "../middleware/validators";

const router: Router = Router();

router.get("/", authenticateJWT, getProblems);
router.get("/:problem_id", authenticateJWT, getProblemById);
router.post(
  "/",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createProblemSchema }),
  createProblem,
);
router.put(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createProblemSchema }),
  updateProblem,
);
router.put(
  "/:problem_id/practice",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: practiceFeedbackSchema }),
  handlePracticeFeedback,
);
router.delete("/:problem_id", verifyCsrfToken, authenticateJWT, deleteProblem);

export default router;
