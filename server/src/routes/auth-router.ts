import { Router } from 'express';
import { loginValidation, registerValidation } from '../middleware/validation-middleware';
import { getAccessToken, getProfile, getUserIdentity, login, logout, refreshToken, register } from '../controllers/auth-controller';
import { authenticateJWT } from '../middleware/auth-middleware';

const router: Router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', refreshToken);
router.get('/profile', authenticateJWT, getProfile);
router.get('/github', getUserIdentity);
router.get('/github/callback', getAccessToken);
router.post('/logout', logout);

export default router;