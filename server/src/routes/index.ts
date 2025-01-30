import { Router, Request, Response } from 'express';
import problemRouter from './problem-router';
import authRouter from './auth-router';
import reminderRouter from './reminder-router';

const router: Router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).send({ message: 'progress-tracker server is up and running' });
});

router.use('/auth', authRouter);
router.use('/problems', problemRouter);
router.use('/reminders', reminderRouter);

export default router;