import { Router } from 'express';
import { createReminder, deleteReminder, getReminderById, getRemindersByProblem, updateReminder } from '../controllers/reminder-controller';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateReminderCreation, validateReminderUpdate } from '../middleware/validation-middleware';

const router: Router = Router();

router.get('/:problem_id', authenticateJWT, getRemindersByProblem);
router.get('/:reminder_id', authenticateJWT, getReminderById);
router.post('/:problem_id', authenticateJWT, validateReminderCreation, createReminder);
router.put('/:reminder_id', authenticateJWT, validateReminderUpdate, updateReminder);
router.delete('/:reminder_id', authenticateJWT, deleteReminder);

export default router;