/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Request, Response, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import { db } from "../db";
import resend from "../lib/resend";
import crypto from "crypto";
import { IUserRow } from "../types/knex-tables";
import { AppRequestHandler, GitHubOAuthAccessTokenSuccess } from "../types";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import AppError from "../types/errors";
import logger from "../lib/winston-config";

type AuthUser =
  RestEndpointMethodTypes["users"]["getAuthenticated"]["response"]["data"];
type UserEmails =
  RestEndpointMethodTypes["users"]["listEmailsForAuthenticatedUser"]["response"]["data"];

dotenv.config();

export const register: AppRequestHandler<
  {},
  { message?: string; user?: Partial<IUserRow> },
  { name: string; email: string; password: string }
> = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await db("users").where({ email }).first();
    if (existingUser) {
      throw new AppError("CONFLICT", "Email already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db("users")
      .insert({
        name,
        email,
        password: hashedPassword,
      })
      .returning(["user_id", "name", "email", "created_at"]);

    req.log?.info(`New user registered: ${email}`);

    res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });
  } catch (error) {
    req.log?.error(`Register Error: ${error}`);
    next(error);
  }
};

export const login: AppRequestHandler<
  {},
  { message?: string; user?: Partial<IUserRow> & { token: string } },
  { email: string; password: string }
> = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existingUser = await db("users").where({ email }).first();
    if (!existingUser) {
      req.log?.warn(`Login failed: User not found - ${email}`);
      throw new AppError("UNAUTHORIZED", "Invalid Credentials");
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      throw new AppError("UNAUTHORIZED", "Invalid Credentials");
    }

    const token = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: "7d" },
    );

    const csrfToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
        issuedAt: Date.now(),
      },
      process.env.CSRF_SECRET_KEY as string,
    );

    req.log?.info(`Login successful for ${email} from IP: ${req.ip}`);

    res.cookie("refresh_token", refreshToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("CSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        user_id: existingUser.user_id,
        name: existingUser.name,
        email: existingUser.email,
        token,
      },
    });
  } catch (error: unknown) {
    req.log?.error(
      `Login error for ${req.body?.email || "unknown user"} error: ${error}`,
    );
    next(error);
  }
};

export const refreshToken: AppRequestHandler<
  {},
  { message: string; token: string }
> = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    req.log?.info(`Refresh token request received from IP: ${req.ip}`);

    if (!refreshToken) {
      req.log?.warn(`Refresh token request missing token from IP: ${req.ip}`);
      throw new AppError("BAD_REQUEST", "Refresh token is required");
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET as string,
      ) as { userId: string; email: string };
    } catch (err) {
      req.log?.warn(
        `Invalid or expired refresh token from IP: ${req.ip} error: ${err}`,
      );
      throw new AppError("FORBIDDEN", "Invalid or expired refresh token");
    }

    // Find the user
    const user = await db("users").where({ email: decoded.email }).first();
    if (!user) {
      req.log?.warn(
        `Refresh token failed: User not found - User ID: ${decoded.userId}`,
      );
      throw new AppError("FORBIDDEN", "Invalid or expired refresh token");
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    const csrfToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        issuedAt: Date.now(),
      },
      process.env.CSRF_SECRET_KEY as string,
    );

    res.cookie("CSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    req.log?.info(
      `Access token refreshed successfully for User ID: ${decoded.userId} from IP: ${req.ip}`,
    );

    res.status(200).json({
      message: "Token refreshed successfully",
      token: newAccessToken,
    });
  } catch (error: unknown) {
    req.log?.error(`Refresh token error from IP: ${req.ip} - ${error}`);
    next(error);
  }
};

export const getProfile: AppRequestHandler<
  {},
  { user: Partial<IUserRow> }
> = async (req, res, next) => {
  try {
    req.log?.info(
      `Profile fetch request received for User ID: ${req.authUser?.userId} from IP: ${req.ip}`,
    );

    if (!req.authUser?.userId) {
      req.log?.warn(`Unauthorized profile access attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const { userId } = req.authUser;

    const user = await db("users")
      .select("user_id", "name", "email", "created_at")
      .where({ user_id: userId })
      .first();

    if (!user) {
      req.log?.warn(
        `Profile fetch failed: User not found - User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "User not found");
    }

    req.log?.info(
      `Profile retrieved successfully for User ID: ${userId} from IP: ${req.ip}`,
    );

    res.status(200).json({ user });
  } catch (error: unknown) {
    req.log?.error(
      `Profile fetch error for User ID: ${req.authUser?.userId || "unknown"}: ${error}`,
    );
    next(error);
  }
};

export const getUserIdentity: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.SERVER_URL}/api/auth/github/callback`;
  const scope = "read:user user:email";

  // GitHub OAuth authorize endpoint
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

  logger.info("Redirecting to GitHub OAuth", { clientId });
  res.redirect(githubAuthUrl);
};

export const getAccessToken: AppRequestHandler<
  {},
  {},
  {},
  { code: string }
> = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      req.log?.warn("No code returned from GitHub");
      throw new Error("Missing code parameter");
    }

    // Exchange code for access token
    const tokenResponse = await axios.post<GitHubOAuthAccessTokenSuccess>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      req.log?.error("No access token received from GitHub");
      throw new Error("Failed to obtain access token");
    }

    // Fetch user profile from GitHub
    const userProfileResp = await axios.get<AuthUser>(
      "https://api.github.com/user",
      {
        headers: { Authorization: `token ${accessToken}` },
      },
    );
    const githubUser = userProfileResp.data;

    // Fetch user’s email(s)
    const emailsResp = await axios.get<UserEmails>(
      "https://api.github.com/user/emails",
      {
        headers: { Authorization: `token ${accessToken}` },
      },
    );
    const emails = emailsResp.data;
    const primaryEmailObj = emails.find((obj) => obj.primary) || emails[0];
    const userEmail = primaryEmailObj ? primaryEmailObj.email : null;

    if (!userEmail) throw new Error("Failed to obtain user email");

    // Check if user exists
    let existingUser: Partial<IUserRow> | undefined = await db("users")
      .where({ email: userEmail })
      .first();

    let userId;
    if (existingUser) {
      // Possibly update provider fields if user was local
      userId = existingUser.user_id;
      if (!existingUser.provider || existingUser.provider === "local") {
        await db("users")
          .where({ user_id: userId })
          .update({
            provider: "github",
            provider_id: String(githubUser.id),
            updated_at: new Date(),
          });
        req.log?.info(
          `Updated existing user with GitHub provider info: ${userId}`,
        );
      }
      req.log?.info(`Existing user logged in via GitHub: ${userEmail}`);
    } else {
      // Create a new user
      const displayName = githubUser.name || githubUser.login || "GitHub User";
      const [newUser] = await db("users")
        .insert({
          name: displayName,
          email: userEmail || `user-${githubUser.id}@github.local`,
          password: "",
          provider: "github",
          provider_id: String(githubUser.id),
          created_at: new Date(),
        })
        .returning(["user_id", "email"]);
      if (!newUser) throw new Error("Failed to create new local user");
      userId = newUser.user_id;
      existingUser = newUser;
      req.log?.info(`New user created via GitHub: ${userEmail}`);
    }

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: "7d" },
    );

    res.cookie("refresh_token", refreshToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const newAccessToken = jwt.sign(
      { userId: existingUser.user_id, email: existingUser.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    const csrfToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
        issuedAt: Date.now(),
      },
      process.env.CSRF_SECRET_KEY as string,
    );

    res.cookie("CSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.cookie("XSRF-TOKEN", csrfToken, {
      domain: `.${process.env.DOMAIN as string}`,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    // make a new query to get all the user's details
    const user = {
      user_id: existingUser.user_id,
      name: existingUser.name,
      email: existingUser.email,
      token: newAccessToken,
    };

    const encodedUser = encodeURIComponent(JSON.stringify(user));

    res.redirect(
      `${process.env.CLIENT_URL}/auth/github/success?user=${encodedUser}`,
    );
  } catch (error: unknown) {
    req.log?.error(`GitHub OAuth Callback Error: ${error}`);
    res.redirect(`${process.env.CLIENT_URL}/auth/github/error`);
  }
};

export const forgotPassword: AppRequestHandler<
  {},
  { message: string },
  { email: string }
> = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      req.log?.warn("Forgot password attempt without email");
      throw new AppError("BAD_REQUEST", "Email is required");
    }

    // 1. Check if user exists
    const user = await db("users").where({ email }).first();
    if (!user) {
      req.log?.warn(`Forgot password request for non-existent email: ${email}`);
      res
        .status(200)
        .json({ message: "If the email exists, an OTP has been sent." });
      return;
    }

    // 2. Generate a 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash("sha256").update(otpCode).digest("hex");

    // 3. Store hashed OTP and expiration (valid for 10 minutes)
    await db("password_reset_tokens").insert({
      user_id: user.user_id,
      otp_hash: hashedOtp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    });

    // 4. Send OTP Email via Resend
    const emailSent = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL as string,
      to: user.email,
      subject: "Your Password Reset OTP",
      html: `
        <p>Hello ${user.name},</p>
        <p>Your password reset OTP is: <strong>${otpCode}</strong></p>
        <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    if (emailSent) {
      req.log?.info(`Password reset OTP sent to ${user.email}`);
    } else {
      req.log?.error(`Failed to send OTP email to ${user.email}`);
    }

    res
      .status(200)
      .json({ message: "If the email exists, an OTP has been sent." });
  } catch (error) {
    req.log?.error("Forgot password error", error);
    next(error);
  }
};

export const verifyOtp: AppRequestHandler<
  {},
  { message: string; password_reset_token: string },
  { email: string; pin: number }
> = async (req, res, next) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      req.log?.warn("OTP verification attempt without email or pin");
      throw new AppError("BAD_REQUEST", "Invalid email or OTP");
    }

    // 1. Find user
    const user = await db("users").where({ email }).first();
    if (!user) {
      throw new AppError("BAD_REQUEST", "Invalid email or OTP");
    }

    // 2. Fetch the latest OTP for this user
    const otpRecord = await db("password_reset_tokens")
      .where({ user_id: user.user_id })
      .orderBy("created_at", "desc")
      .first();

    if (!otpRecord || new Date(otpRecord.expires_at) < new Date()) {
      throw new AppError("BAD_REQUEST", "OTP expired or invalid");
    }

    // 3. Hash the provided OTP and compare
    const hashedOtp = crypto
      .createHash("sha256")
      .update(pin.toString())
      .digest("hex");
    if (hashedOtp !== otpRecord.otp_hash) {
      throw new AppError("BAD_REQUEST", "Invalid OTP");
    }

    // 4. OTP is valid - Remove it from the DB
    await db("password_reset_tokens").where({ user_id: user.user_id }).del();

    // 5. Generate a temporary password reset token (valid for 15 minutes)
    const passwordResetToken = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.RESET_PASSWORD_SECRET as string,
      { expiresIn: "15m" },
    );

    req.log?.info(
      `OTP verified for ${user.email}. Temporary reset token generated.`,
    );

    res.status(200).json({
      message: "OTP verified successfully",
      password_reset_token: passwordResetToken,
    });
  } catch (error) {
    req.log?.error(`OTP verification error ${error}`);
    next(error);
  }
};

export const resetPassword: AppRequestHandler<
  {},
  { message: string },
  { password_reset_token: string; new_password: string }
> = async (req, res, next) => {
  try {
    const { password_reset_token, new_password } = req.body;

    if (!password_reset_token || !new_password) {
      req.log?.warn(
        "Password reset attempt without password_reset_token or new_password",
      );
      throw new AppError("BAD_REQUEST", "Token and new password are required");
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(
        password_reset_token,
        process.env.RESET_PASSWORD_SECRET as string,
      );
    } catch (error) {
      req.log?.warn(`Invalid or expired password reset token ${error}`);
      throw new AppError("FORBIDDEN", "Invalid or expired token");
    }

    const { userId, email } = decoded as { userId: number; email: string };

    // Hash the new password securely
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password in the database
    await db("users").where({ user_id: userId, email }).update({
      password: hashedPassword,
      updated_at: new Date(),
    });

    req.log?.info(`Password reset successfully for ${email}`);

    res
      .status(200)
      .json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    req.log?.error(`Password reset error ${error}`);
    next(error);
  }
};

export const logout: AppRequestHandler<{}, {}, { message: string }> = (
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

    req.log?.info(
      `User logged out - refresh and csrf tokens and cookies cleared`,
    );
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    req.log?.error(`Logout error ${error}`);
    next(error);
  }
};
