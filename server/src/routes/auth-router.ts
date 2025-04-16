import { Router } from "express";
import {
  forgotPasswordValidator,
  loginValidation,
  registerValidation,
  resetPasswordValidator,
  verifyOtpValidator,
} from "../middleware/validators";
import {
  forgotPassword,
  getAccessToken,
  getProfile,
  getUserIdentity,
  login,
  logout,
  refreshToken,
  register,
  resetPassword,
  verifyOtp,
} from "../controllers/auth-controller";
import { authenticateJWT } from "../middleware/auth-middleware";
import { validateRequest } from "../middleware/validate-request";

const router: Router = Router();

router.post("/register", registerValidation, validateRequest, register);
router.post("/login", loginValidation, validateRequest, login);
router.post("/refresh-token", refreshToken);
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validateRequest,
  forgotPassword,
);
router.post("/verify-otp", verifyOtpValidator, validateRequest, verifyOtp);
router.post(
  "/reset-password",
  resetPasswordValidator,
  validateRequest,
  resetPassword,
);
router.get("/profile", authenticateJWT, getProfile);
router.get("/github", getUserIdentity);
router.get("/github/callback", getAccessToken);
router.post("/logout", logout);

export default router;
