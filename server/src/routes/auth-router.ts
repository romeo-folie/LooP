import { Router } from 'express';
import { forgotPasswordValidator, loginValidation, registerValidation, verifyOtpValidator } from '../middleware/validation-middleware';
import { forgotPassword, getAccessToken, getProfile, getUserIdentity, login, logout, refreshToken, register, verifyOtp } from '../controllers/auth-controller';
import { authenticateJWT } from '../middleware/auth-middleware';

const router: Router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);
router.post('/verify-otp', verifyOtpValidator, verifyOtp);
router.get('/profile', authenticateJWT, getProfile);
router.get('/github', getUserIdentity);
router.get('/github/callback', getAccessToken);
router.post('/logout', logout);

export default router;