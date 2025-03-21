import { Request, Response, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import { db } from "../db";
import { AuthenticatedRequest } from "../types/authenticated-request";
import logger from "../logging/winston-config";
import resend from "../config/resend";
import crypto from 'crypto';

dotenv.config();

export const register: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await db("users").where({ email }).first();
    if (existingUser) {
      res.status(400).json({ message: "Email already in use" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db("users")
      .insert({
        name,
        email,
        password: hashedPassword,
      })
      .returning(["user_id", "name", "email", "created_at"]);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });
  } catch (error: unknown) {
    logger.error(
      `Register Error: ${error instanceof Error ? error.message : error}`
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const existingUser = await db("users").where({ email }).first();
    if (!existingUser) {
      logger.warn(`Login failed: User not found - ${email}`);
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "30m" }
    );

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: "7d" }
    );

    const csrfToken = jwt.sign({
      userId: existingUser.user_id,
      email: existingUser.email,
      issuedAt: Date.now(),
    }, process.env.CSRF_SECRET_KEY as string)

    logger.info(`Login successful for ${email} from IP: ${req.ip}`);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("CSRF-TOKEN", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    })

    res.cookie("XSRF-TOKEN", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    })

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: existingUser.user_id,
        name: existingUser.name,
        email: existingUser.email,
      },
    });
  } catch (error: unknown) {
    logger.error(
      `Login error for ${req.body?.email || "unknown user"}: ${
        error instanceof Error ? error.message : error
      }`
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

export const refreshToken: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    logger.info(`Refresh token request received from IP: ${req.ip}`);

    if (!refreshToken) {
      logger.warn(`Refresh token request missing token from IP: ${req.ip}`);
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET as string
      ) as { userId: string; email: string };
    } catch (err) {
      logger.warn(`Invalid or expired refresh token from IP: ${req.ip}`);
      res.status(403).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Find the user
    const user = await db("users").where({ email: decoded.email }).first();
    if (!user) {
      logger.warn(
        `Refresh token failed: User not found - User ID: ${decoded.userId}`
      );
      res.status(403).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "30m" }
    );

    logger.info(
      `Access token refreshed successfully for User ID: ${decoded.userId} from IP: ${req.ip}`
    );

    res.status(200).json({
      message: "Token refreshed successfully",
      token: newAccessToken,
    });
  } catch (error: unknown) {
    logger.error(
      `Refresh token error from IP: ${req.ip} - ${
        error instanceof Error ? error.message : error
      }`
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfile: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    logger.info(
      `Profile fetch request received for User ID: ${req.authUser?.userId} from IP: ${req.ip}`
    );

    if (!req.authUser?.userId) {
      logger.warn(`Unauthorized profile access attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { userId } = req.authUser;

    const user = await db("users")
      .select("user_id", "name", "email", "created_at")
      .where({ user_id: userId })
      .first();

    if (!user) {
      logger.warn(`Profile fetch failed: User not found - User ID: ${userId}`);
      res.status(404).json({ error: "User not found" });
      return;
    }

    logger.info(
      `Profile retrieved successfully for User ID: ${userId} from IP: ${req.ip}`
    );

    res.status(200).json({ user });
  } catch (error: unknown) {
    logger.error(
      `Profile fetch error for User ID: ${req.authUser?.userId || "unknown"}: ${
        error instanceof Error ? error.message : error
      }`
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserIdentity: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.SERVER_URL}/api/auth/github/callback`;
  const scope = "read:user user:email";

  // GitHub OAuth authorize endpoint
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

  logger.info("Redirecting to GitHub OAuth", { clientId });
  res.redirect(githubAuthUrl);
};

export const getAccessToken: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { code } = req.query;

    if (!code) {
      logger.warn("No code returned from GitHub");
      res.status(400).json({ error: "Missing code parameter" });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      logger.error("No access token received from GitHub");
      res.status(500).json({ error: "Failed to obtain access token" });
      return;
    }

    // Fetch user profile from GitHub
    const userProfileResp = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const githubUser = userProfileResp.data;

    // Fetch user’s email(s)
    const emailsResp = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const emails = emailsResp.data;
    const primaryEmailObj = emails.find((obj: any) => obj.primary) || emails[0];
    const userEmail = primaryEmailObj ? primaryEmailObj.email : null;

    // Check if user exists
    let existingUser = await db("users").where({ email: userEmail }).first();

    let userId: number;
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
        logger.info(
          `Updated existing user with GitHub provider info: ${userId}`
        );
      }
      logger.info(`Existing user logged in via GitHub: ${userEmail}`);
    } else {
      // Create a new user
      const displayName = githubUser.name || githubUser.login || "GitHub User";
      const [newUser] = await db("users")
        .insert({
          name: displayName,
          email: userEmail || `user-${githubUser.id}@github.local`,
          password: "", // no local password needed for OAuth
          provider: "github",
          provider_id: String(githubUser.id),
          created_at: new Date(),
        })
        .returning(["user_id"]);
      userId = newUser.user_id;
      logger.info(`New user created via GitHub: ${userEmail}`);
    }

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email,
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: "7d" }
    );

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // make a new query to get all the user's details
    const user = { user_id: existingUser.user_id, name: existingUser.name, email: existingUser.email };

    const encodedUser = encodeURIComponent(JSON.stringify(user));

    res.redirect(
      `${process.env.CLIENT_URL}/auth/github/success?user=${encodedUser}`
    );
  } catch (error: unknown) {
    logger.error("GitHub OAuth Callback Error: ", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const forgotPassword: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      logger.warn('Forgot password attempt without email');
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // 1. Check if user exists
    const user = await db('users').where({ email }).first();
    if (!user) {
      logger.warn(`Forgot password request for non-existent email: ${email}`);
      res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
      return;
    }

    // 2. Generate a 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');

    // 3. Store hashed OTP and expiration (valid for 10 minutes)
    await db('password_reset_tokens').insert({
      user_id: user.user_id,
      otp_hash: hashedOtp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    });

    // 4. Send OTP Email via Resend
    const emailSent = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL as string,
      to: user.email,
      subject: 'Your Password Reset OTP',
      html: `
        <p>Hello ${user.name},</p>
        <p>Your password reset OTP is: <strong>${otpCode}</strong></p>
        <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    if (emailSent) {
      logger.info(`Password reset OTP sent to ${user.email}`);
    } else {
      logger.error(`Failed to send OTP email to ${user.email}`);
    }

    res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
  } catch (error) {
    logger.error('Forgot password error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const verifyOtp: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      logger.warn('OTP verification attempt without email or pin');
      res.status(400).json({ error: 'Email and OTP are required' });
      return;
    }

    // 1. Find user
    const user = await db('users').where({ email }).first();
    if (!user) {
      res.status(400).json({ error: 'Invalid email or OTP' });
      return;
    }

    // 2. Fetch the latest OTP for this user
    const otpRecord = await db('password_reset_tokens')
      .where({ user_id: user.user_id })
      .orderBy('created_at', 'desc')
      .first();

    if (!otpRecord || new Date(otpRecord.expires_at) < new Date()) {
      res.status(400).json({ error: 'OTP expired or invalid' });
      return;
    }

    // 3. Hash the provided OTP and compare
    const hashedOtp = crypto.createHash('sha256').update(pin).digest('hex');
    if (hashedOtp !== otpRecord.otp_hash) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    // 4. OTP is valid - Remove it from the DB
    await db('password_reset_tokens').where({ user_id: user.user_id }).del();

    // 5. Generate a temporary password reset token (valid for 15 minutes)
    const passwordResetToken = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.RESET_PASSWORD_SECRET as string,
      { expiresIn: '15m' }
    );

    logger.info(`OTP verified for ${user.email}. Temporary reset token generated.`);

    res.status(200).json({
      message: 'OTP verified successfully',
      password_reset_token: passwordResetToken
    });
  } catch (error) {
    logger.error('OTP verification error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const resetPassword: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { password_reset_token, new_password } = req.body;

    if (!password_reset_token || !new_password) {
      logger.warn('Password reset attempt without password_reset_token or new_password');
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    // 1. Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(password_reset_token, process.env.RESET_PASSWORD_SECRET as string);
    } catch (error) {
      logger.warn('Invalid or expired password reset token');
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    const { userId, email } = decoded as { userId: number; email: string };

    // 2. Hash the new password securely
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // 3. Update password in the database
    await db('users').where({ user_id: userId, email }).update({
      password: hashedPassword,
      updated_at: new Date()
    });

    logger.info(`Password reset successfully for ${email}`);

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    logger.error('Password reset error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const logout: RequestHandler = (req: Request, res: Response) => {
  try {
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.clearCookie("CSRF-TOKEN", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.clearCookie("XSRF-TOKEN", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    logger.info(`User logged out - refresh and csrf tokens and cookies cleared`);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    logger.error(
      "Logout error",
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: "Internal server error" });
  }
};
