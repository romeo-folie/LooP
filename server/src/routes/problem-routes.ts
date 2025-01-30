import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateProblem, validateProblemUpdate } from '../middleware/validation-middleware';
import { createProblem, getProblemById, getProblems, updateProblem, deleteProblem } from '../controllers/problem-controller';

const router: Router = Router();

router.post('/problems', authenticateJWT, validateProblem, createProblem);
router.get('/problems', authenticateJWT, getProblems);
router.get('/:problem_id', authenticateJWT, getProblemById);
router.put('/:problem_id', authenticateJWT, validateProblemUpdate, updateProblem);
router.delete('/:problem_id', authenticateJWT, deleteProblem);


export default router;