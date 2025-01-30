import { Router } from 'express';
import { loginValidation, registerValidation } from '../middleware/validation-middleware';
import { getProfile, login, register } from '../controllers/auth-controller';
import { authenticateJWT } from '../middleware/auth-middleware';

const router: Router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', authenticateJWT, getProfile);


export default router;