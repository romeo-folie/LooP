import { Router } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../../middleware/validators";
import {
  handleForgotPassword,
  handleGitHubStart,
  handleGetProfile,
  handleGitHubCallback,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleRegister,
  handleResetPassword,
  handleVerifyOtp,
} from "../../controllers/auth-controller";
import { authenticateJWT } from "../../middleware/auth-middleware";
import { zodValidate } from "../../middleware/validate-request";

const router = Router();

router.post("/register", zodValidate({ body: registerSchema }), handleRegister);
router.post("/login", zodValidate({ body: loginSchema }), handleLogin);
router.post("/refresh-token", handleRefreshToken);
router.post(
  "/forgot-password",
  zodValidate({ body: forgotPasswordSchema }),
  handleForgotPassword,
);
router.post(
  "/verify-otp",
  zodValidate({ body: verifyOtpSchema }),
  handleVerifyOtp,
);
router.post(
  "/reset-password",
  zodValidate({ body: resetPasswordSchema }),
  handleResetPassword,
);
router.get("/profile", authenticateJWT, handleGetProfile);
router.get("/github", handleGitHubStart);
router.get("/github/callback", handleGitHubCallback);
router.post("/logout", handleLogout);

export default router;
