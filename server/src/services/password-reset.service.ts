import { Knex } from "knex";
import { Logger } from "winston";
import resend from "../lib/resend";
import { usersRepo } from "../repositories/user.repo";
import AppError from "../types/errors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { passwordResetTokensRepo } from "../repositories/password-reset-tokens.repo";

type SendOtpArgs = {
  email: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type VerifyArgs = {
  email: string;
  pin: string | number;
  log?: Logger;
  trx?: Knex.Transaction;
};

type VerifyResult = {
  passwordResetToken: string;
};

type ResetArgs = {
  passwordResetToken: string;
  newPassword: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

export async function sendPasswordResetOtp({
  email,
  log,
  trx,
}: SendOtpArgs): Promise<void> {
  if (!email) throw new AppError("BAD_REQUEST", "Email is required");

  const normalizedEmail = email.trim().toLowerCase();

  // Look up user (do not reveal existence to the client)
  const user = await usersRepo.findByEmail(normalizedEmail, trx);
  if (!user) {
    log?.warn("sendPasswordResetOtp:user_not_found", {
      email: normalizedEmail,
    });
    return; // exit silently; controller will send generic success
  }

  // Generate 6-digit OTP and its hash
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Persist the hashed OTP
  await passwordResetTokensRepo.create(
    {
      user_id: user.user_id,
      otp_hash: otpHash,
      expires_at: expiresAt,
    },
    trx,
  );

  // Send email (best-effort: do not leak failures to the client)
  try {
    const from = process.env.RESEND_FROM_EMAIL as string | undefined;
    if (!from) throw new Error("RESEND_FROM_EMAIL not configured");

    await resend.emails.send({
      from,
      to: user.email,
      subject: "Your Password Reset OTP",
      html: `
        <p>Hello ${user.name ?? "there"},</p>
        <p>Your password reset OTP is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    log?.info("sendPasswordResetOtp:email_sent", {
      userId: user.user_id,
      email: user.email,
    });
  } catch (err) {
    // Log and continue; we still respond generically to avoid user enumeration
    log?.error("sendPasswordResetOtp:email_failed", {
      userId: user.user_id,
      email: user.email,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function verifyPasswordResetOtp({
  email,
  pin,
  log,
  trx,
}: VerifyArgs): Promise<VerifyResult> {
  if (!email || pin === undefined || pin === null || pin === "") {
    throw new AppError("BAD_REQUEST", "Invalid email or OTP");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const pinStr = String(pin).trim();

  // 1) Find user (do not reveal existence beyond generic errors)
  const user = await usersRepo.findByEmail(normalizedEmail, trx);
  if (!user) {
    throw new AppError("BAD_REQUEST", "Invalid email or OTP");
  }

  // 2) Get latest OTP for this user
  const otpRecord = await passwordResetTokensRepo.findLatestByUserId(
    user.user_id,
    trx,
  );
  const now = new Date();

  if (!otpRecord || new Date(otpRecord.expires_at) < now) {
    throw new AppError("BAD_REQUEST", "OTP expired or invalid");
  }

  // 3) Compare hashes
  const hashedProvided = crypto
    .createHash("sha256")
    .update(pinStr)
    .digest("hex");
  if (hashedProvided !== otpRecord.otp_hash) {
    throw new AppError("BAD_REQUEST", "Invalid OTP");
  }

  // 4) Delete existing OTP(s)
  await passwordResetTokensRepo.deleteByUserId(user.user_id, trx);

  // 5) Create short-lived password reset token (15m)
  const resetSecret = process.env.RESET_PASSWORD_SECRET as string | undefined;
  if (!resetSecret) {
    log?.error("verifyPasswordResetOtp:missing_RESET_PASSWORD_SECRET");
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  const passwordResetToken = jwt.sign(
    { userId: user.user_id, email: user.email },
    resetSecret,
    { expiresIn: "15m" },
  );

  log?.info("verifyPasswordResetOtp:success", {
    userId: user.user_id,
    email: user.email,
  });

  return { passwordResetToken };
}

export async function resetPasswordWithToken({
  passwordResetToken,
  newPassword,
  log,
  trx,
}: ResetArgs): Promise<void> {
  if (!passwordResetToken || !newPassword) {
    throw new AppError("BAD_REQUEST", "Token and new password are required");
  }

  const resetSecret = process.env.RESET_PASSWORD_SECRET as string | undefined;
  if (!resetSecret) {
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  let decoded: { userId: number; email: string };
  try {
    decoded = jwt.verify(passwordResetToken, resetSecret) as {
      userId: number;
      email: string;
    };
  } catch (err) {
    log?.warn("resetPasswordWithToken:invalid_or_expired_token", {
      err: String(err),
    });
    throw new AppError("FORBIDDEN", "Invalid or expired token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const updated = await usersRepo.updatePasswordByIdAndEmail(
    decoded.userId,
    decoded.email,
    passwordHash,
    trx,
  );

  if (updated === 0) {
    // user no longer exists or email mismatch
    throw new AppError("NOT_FOUND", "User not found");
  }

  log?.info("resetPasswordWithToken:success", {
    userId: decoded.userId,
    email: decoded.email,
  });
}
