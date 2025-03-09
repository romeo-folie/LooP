import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateProblemCreation, validateProblemUpdate } from '../middleware/validators';
import { createProblem, getProblemById, getProblems, updateProblem, deleteProblem } from '../controllers/problem-controller';
import { validateRequest } from '../middleware/validate-request';

const router: Router = Router();

router.get('/', authenticateJWT, getProblems);
router.get('/:problem_id', authenticateJWT, getProblemById);
router.post('/', authenticateJWT, validateProblemCreation, validateRequest, createProblem);
router.put('/:problem_id', authenticateJWT, validateProblemUpdate, validateRequest, updateProblem);
router.delete('/:problem_id', authenticateJWT, deleteProblem);

export default router;