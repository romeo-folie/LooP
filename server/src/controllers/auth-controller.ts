/* eslint-disable @typescript-eslint/no-empty-object-type */
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { db } from "../db";
import { IUserRow } from "../types/knex-tables";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import {
  getUserProfile,
  loginUser,
  refreshAccessToken,
  registerUser,
} from "../services/auth.service";
import { loginWithGitHub } from "../services/oauth.service";
import {
  resetPasswordWithToken,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "../services/password-reset.service";
import { email } from "zod";

dotenv.config();

export const handleRegister: AppRequestHandler<
  {},
  { message?: string; user?: Partial<IUserRow> },
  { name: string; email: string; password: string }
> = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const user = await registerUser({
      name,
      email,
      password,
      log: req.log,
    });

    req.log?.info("handleRegister:success", {
      userId: user.user_id,
      email: user.email,
    });

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    req.log?.error("handleRegister:error", {
      message: error instanceof Error ? error.message : String(error),
      email: req.body?.email,
    });
    next(error);
  }
};

export const handleLogin: AppRequestHandler<
  {},
  { message?: string; user?: Partial<IUserRow> & { token: string } },
  { email: string; password: string }
> = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken, csrfToken } = await loginUser({
      email,
      password,
      log: req.log,
    });

    req.log?.info("handleLogin:success", {
      userId: user.user_id,
      email,
      ip: req.ip,
    });

    const domainEnv = process.env.DOMAIN as string | undefined;
    const cookieBase = {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    } as const;

    // Refresh token: HTTP-only
    res.cookie("refresh_token", refreshToken, {
      ...cookieBase,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    // CSRF tokens (double submit)
    res.cookie("CSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: true,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: false,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    // Response contains access token
    res.status(200).json({
      message: "Login successful",
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        token: accessToken,
      },
    });
  } catch (error) {
    req.log?.error("handleLogin:error", {
      email: req.body?.email,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleRefreshToken: AppRequestHandler<
  {},
  { message: string; token: string }
> = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    req.log?.info("handleRefreshToken:received", { ip: req.ip });

    if (!refreshToken) {
      req.log?.warn("handleRefreshToken:missing_cookie", { ip: req.ip });
      throw new AppError("BAD_REQUEST", "Refresh token is required");
    }

    const { accessToken, csrfToken, userId } = await refreshAccessToken({
      refreshToken,
      log: req.log,
    });

    const domainEnv = process.env.DOMAIN as string | undefined;
    const cookieBase = {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    } as const;

    // Rotate CSRF cookies (double submit)
    res.cookie("CSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: true,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: false,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    req.log?.info("handleRefreshToken:success", { userId, ip: req.ip });

    res.status(200).json({
      message: "Token refreshed successfully",
      token: accessToken,
    });
  } catch (error) {
    req.log?.error("handleRefreshToken:error", {
      ip: req.ip,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleGetProfile: AppRequestHandler<
  {},
  { user: Pick<IUserRow, "user_id" | "name" | "email" | "created_at"> }
> = async (req, res, next) => {
  try {
    req.log?.info("handleGetProfile:received", {
      userId: req.authUser?.userId,
      ip: req.ip,
    });

    if (!req.authUser?.userId) {
      req.log?.warn(`handleGetProfile:unauthorized from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const user = await getUserProfile({
      userId: req.authUser.userId,
      log: req.log,
    });

    req.log?.info("handleGetProfile:success", { userId: user.user_id });

    res.status(200).json({ user });
  } catch (error) {
    req.log?.error("handleGetProfile:error", {
      userId: req.authUser?.userId ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleGitHubStart: AppRequestHandler = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID as string | undefined;
  const serverUrl = process.env.SERVER_URL as string | undefined;
  if (!clientId || !serverUrl) {
    req.log?.error("handleGitHubStart:missing_env");
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  const redirectUri = `${serverUrl}/api/auth/github/callback`;
  const scope = encodeURIComponent("read:user user:email");

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=${scope}`;

  req.log?.info("Redirecting to GitHub OAuth");
  res.redirect(githubAuthUrl);
};

export const handleGitHubCallback: AppRequestHandler<
  {},
  {},
  {},
  { code?: string }
> = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      req.log?.warn("handleGitHubCallback:missing_code");
      throw new AppError("BAD_REQUEST", "Missing code parameter");
    }

    const { user, accessToken, refreshToken, csrfToken } =
      await loginWithGitHub({
        code,
        log: req.log,
      });

    // Cookies
    const domainEnv = process.env.DOMAIN as string | undefined;
    const cookieBase = {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    } as const;

    res.cookie("refresh_token", refreshToken, {
      ...cookieBase,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    res.cookie("CSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: true,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      ...cookieBase,
      httpOnly: false,
      ...(domainEnv ? { domain: `.${domainEnv}` } : {}),
    });

    // Build user payload for frontend
    const payload = encodeURIComponent(
      JSON.stringify({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        token: accessToken,
      }),
    );

    const clientUrl = process.env.CLIENT_URL as string | undefined;
    if (!clientUrl) {
      req.log?.error("handleGitHubCallback:missing_CLIENT_URL");
      throw new AppError("INTERNAL", "Server misconfiguration");
    }

    res.redirect(`${clientUrl}/auth/github/success?user=${payload}`);
  } catch (error) {
    req.log?.error("handleGitHubCallback:error", {
      message: error instanceof Error ? error.message : String(error),
    });

    const clientUrl = process.env.CLIENT_URL || "";
    res.redirect(`${clientUrl}/auth/github/error`);
  }
};

export const handleForgotPassword: AppRequestHandler<
  {},
  { message: string },
  { email: string }
> = async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      req.log?.warn("handleForgotPassword:missing_email");
      throw new AppError("BAD_REQUEST", "Email is required");
    }

    await sendPasswordResetOtp({ email, log: req.log });

    res
      .status(200)
      .json({ message: "If the email exists, an OTP has been sent." });
  } catch (error) {
    req.log?.error("handleForgotPassword:error", {
      email: req.body?.email,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleVerifyOtp: AppRequestHandler<
  {},
  { message: string; password_reset_token: string },
  { email: string; pin: number | string }
> = async (req, res, next) => {
  try {
    const { email, pin } = req.body ?? {};

    if (!email || pin === undefined || pin === null || pin === "") {
      req.log?.warn("handleVerifyOtp:missing_email_or_pin");
      throw new AppError("BAD_REQUEST", "Invalid email or OTP");
    }

    const { passwordResetToken } = await verifyPasswordResetOtp({
      email,
      pin,
      log: req.log,
    });

    req.log?.info("handleVerifyOtp:success", { email });

    res.status(200).json({
      message: "OTP verified successfully",
      password_reset_token: passwordResetToken,
    });
  } catch (error) {
    req.log?.error("handleVerifyOtp:error", {
      email: req.body?.email,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleResetPassword: AppRequestHandler<
  {},
  { message: string },
  { password_reset_token: string; new_password: string }
> = async (req, res, next) => {
  try {
    const { password_reset_token, new_password } = req.body ?? {};

    if (!password_reset_token || !new_password) {
      req.log?.warn("handleResetPassword:missing_token_or_password");
      throw new AppError("BAD_REQUEST", "Token and new password are required");
    }

    await resetPasswordWithToken({
      passwordResetToken: password_reset_token,
      newPassword: new_password,
      log: req.log,
    });

    req.log?.info("handleResetPassword:success", { email: "redacted" });

    res
      .status(200)
      .json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    req.log?.error("handleResetPassword:error", {
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleLogout: AppRequestHandler<{}, {}, { message: string }> = (
  req,
  res,
  next,
) => {
  try {
    res.clearCookie("refresh_token", {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.clearCookie("CSRF-TOKEN", {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.clearCookie("XSRF-TOKEN", {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    req.log?.info("handleLogout:success", { email });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    req.log?.error("handleLogout:error", {
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
