import { Router, Request, Response } from 'express';
import problemRoutes from './problem-routes';
import userRoutes from './user-routes';

const router: Router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(200).send({ message: 'progress-tracker server is up and running' });
});

router.use('/problems', problemRoutes);
router.use('/users', userRoutes);

export default router;