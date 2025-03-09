import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateSubscription, validateSubscriptionDeletion } from '../middleware/validators';
import { createSubscription, deleteSubscription } from '../controllers/subscription-controller';
import { validateRequest } from '../middleware/validate-request';

const router: Router = Router();

router.post('/', authenticateJWT, validateSubscription, validateRequest, createSubscription);
router.delete('/', authenticateJWT, validateSubscriptionDeletion, validateRequest, deleteSubscription);

export default router;