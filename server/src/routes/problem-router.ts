import { Router } from "express";
import { authenticateJWT } from "../middleware/auth-middleware";
import {
  validateProblemCreation,
  validateProblemUpdate,
  validatePracticeFeedback,
} from "../middleware/validators";
import {
  createProblem,
  getProblemById,
  getProblems,
  updateProblem,
  deleteProblem,
  handlePracticeFeedback,
} from "../controllers/problem-controller";
import { validateRequest } from "../middleware/validate-request";
import { verifyCsrfToken } from "../middleware/verify-csrf-token";

const router: Router = Router();

router.get("/", authenticateJWT, getProblems);
router.get("/:problem_id", authenticateJWT, getProblemById);
router.post(
  "/",
  verifyCsrfToken,
  authenticateJWT,
  validateProblemCreation,
  validateRequest,
  createProblem,
);
router.put(
  "/:problem_id",
  verifyCsrfToken,
  authenticateJWT,
  validateProblemUpdate,
  validateRequest,
  updateProblem,
);
router.put(
  "/:problem_id/practice",
  verifyCsrfToken,
  authenticateJWT,
  validatePracticeFeedback,
  validateRequest,
  handlePracticeFeedback,
);
router.delete("/:problem_id", verifyCsrfToken, authenticateJWT, deleteProblem);

export default router;
