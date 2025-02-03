import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateSubscription, validateSubscriptionDeletion } from '../middleware/validation-middleware';
import { createSubscription, deleteSubscription } from '../controllers/subscription-controller';

const router: Router = Router();

router.post('/', authenticateJWT, validateSubscription, createSubscription);
router.delete('/', authenticateJWT, validateSubscriptionDeletion, deleteSubscription);

export default router;