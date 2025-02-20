import { Router } from 'express';
import { loginValidation, registerValidation } from '../middleware/validation-middleware';
import { getAccessToken, getProfile, getUserIdentity, login, register } from '../controllers/auth-controller';
import { authenticateJWT } from '../middleware/auth-middleware';

const router: Router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', authenticateJWT, getProfile);
router.get('/github', getUserIdentity);
router.get('/github/callback', getAccessToken);

export default router;