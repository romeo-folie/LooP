import { Router } from 'express';
import { createReminder, deleteReminder, getReminderById, getRemindersByProblem, updateReminder } from '../controllers/reminder-controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateReminderCreation, validateReminderUpdate } from '../middleware/validators';
import { validateRequest } from '../middleware/validate-request';

const router: Router = Router();

router.get('/:problem_id', authenticateJWT, getRemindersByProblem);
router.get('/:reminder_id', authenticateJWT, getReminderById);
router.post('/:problem_id', authenticateJWT, validateReminderCreation, validateRequest, createReminder);
router.put('/:reminder_id', authenticateJWT, validateReminderUpdate, validateRequest, updateReminder);
router.delete('/:reminder_id', authenticateJWT, deleteReminder);

export default router;