import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateProblemCreation, validateProblemUpdate } from '../middleware/validation-middleware';
import { createProblem, getProblemById, getProblems, updateProblem, deleteProblem } from '../controllers/problem-controller';

const router: Router = Router();

router.get('/', authenticateJWT, getProblems);
router.get('/:problem_id', authenticateJWT, getProblemById);
router.post('/', authenticateJWT, validateProblemCreation, createProblem);
router.put('/:problem_id', authenticateJWT, validateProblemUpdate, updateProblem);
router.delete('/:problem_id', authenticateJWT, deleteProblem);

export default router;