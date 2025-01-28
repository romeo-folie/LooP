import { Router, Request, Response } from 'express';
import problemRoutes from './problem-routes';
import authRoutes from './auth-routes';

const router: Router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).send({ message: 'progress-tracker server is up and running' });
});

router.use('/auth', authRoutes);
router.use('/problems', problemRoutes);

export default router;