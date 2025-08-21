import { Router } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
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
import { zodValidate } from "../middleware/validate-request";

const router: Router = Router();

router.post("/register", zodValidate({ body: registerSchema }), register);
router.post("/login", zodValidate({ body: loginSchema }), login);
router.post("/refresh-token", refreshToken);
router.post(
  "/forgot-password",
  zodValidate({ body: forgotPasswordSchema }),
  forgotPassword,
);
router.post("/verify-otp", zodValidate({ body: verifyOtpSchema }), verifyOtp);
router.post(
  "/reset-password",
  zodValidate({ body: resetPasswordSchema }),
  resetPassword,
);
router.get("/profile", authenticateJWT, getProfile);
router.get("/github", getUserIdentity);
router.get("/github/callback", getAccessToken);
router.post("/logout", logout);

export default router;
