import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateSubscription, validateSubscriptionDeletion } from '../middleware/validators';
import { createSubscription, deleteSubscription } from '../controllers/subscription-controller';
import { validateRequest } from '../middleware/validate-request';
import { verifyCsrfToken } from '../middleware/verify-csrf-token';

const router: Router = Router();

router.post('/', verifyCsrfToken, authenticateJWT, validateSubscription, validateRequest, createSubscription);
router.delete('/', verifyCsrfToken, authenticateJWT, validateSubscriptionDeletion, validateRequest, deleteSubscription);

export default router;