import { Router, Request, Response } from 'express';

const router: Router = Router();

router.post('/users', (req: Request, res: Response) => {
  res.send('Create a new user');
})

export default router;