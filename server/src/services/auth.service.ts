import { Knex } from "knex";
import { Logger } from "winston";
import bcrypt from "bcrypt";
import { PublicUser, usersRepo } from "../repositories/user.repo";
import AppError from "../types/errors";
import { IUserRow } from "../types/knex-tables";
import jwt from "jsonwebtoken";

type RegisterArgs = {
  name: string;
  email: string;
  password: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type LoginArgs = {
  email: string;
  password: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type LoginResult = {
  user: Pick<IUserRow, "user_id" | "name" | "email">;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

type RefreshArgs = {
  refreshToken: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type RefreshResult = {
  userId: number;
  email: string;
  accessToken: string;
  csrfToken: string;
};

type GetUserProfileArgs = {
  userId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

export async function registerUser({
  name,
  email,
  password,
  log,
  trx,
}: RegisterArgs): Promise<
  Pick<IUserRow, "user_id" | "name" | "email" | "created_at">
> {
  // Check for existing account
  const existing = await usersRepo.findByEmail(email, trx);
  if (existing) {
    throw new AppError("CONFLICT", "Email already in use");
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await usersRepo.insertUser(
      { name, email, password: hashed, provider: "local" },
      trx,
    );
    log?.info("registerUser:created", {
      userId: user.user_id,
      email: user.email,
    });
    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // Translate common PG errors
    if (err?.code === "23505") {
      // unique_violation catches potential race conditions
      throw new AppError("CONFLICT", "Email already in use");
    }
    throw err;
  }
}

export async function loginUser({
  email,
  password,
  log,
  trx,
}: LoginArgs): Promise<LoginResult> {
  const user = await usersRepo.findByEmail(email, trx);
  if (!user || !user.password) {
    // No local password present also implies OAuth-only account
    log?.warn("loginUser:not_found_or_oauth_only", { email });
    throw new AppError("UNAUTHORIZED", "Invalid Credentials");
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    log?.warn("loginUser:bad_password", { userId: user.user_id, email });
    throw new AppError("UNAUTHORIZED", "Invalid Credentials");
  }

  const jwtSecret = process.env.JWT_SECRET as string;
  const refreshSecret = process.env.REFRESH_SECRET as string;
  const csrfSecret = process.env.CSRF_SECRET_KEY as string;
  if (!jwtSecret || !refreshSecret || !csrfSecret) {
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  const accessToken = jwt.sign(
    { userId: user.user_id, email: user.email },
    jwtSecret,
    { expiresIn: "1h" },
  );

  const refreshToken = jwt.sign(
    { userId: user.user_id, email: user.email },
    refreshSecret,
    { expiresIn: "7d" },
  );

  const csrfToken = jwt.sign(
    { userId: user.user_id, email: user.email, issuedAt: Date.now() },
    csrfSecret,
  );

  log?.info("loginUser:success", { userId: user.user_id, email });

  return {
    user: { user_id: user.user_id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
    csrfToken,
  };
}

export async function refreshAccessToken({
  refreshToken,
  log,
  trx,
}: RefreshArgs): Promise<RefreshResult> {
  if (!refreshToken) {
    throw new AppError("BAD_REQUEST", "Refresh token is required");
  }

  const refreshSecret = process.env.REFRESH_SECRET as string | undefined;
  const jwtSecret = process.env.JWT_SECRET as string | undefined;
  const csrfSecret = process.env.CSRF_SECRET_KEY as string | undefined;

  if (!refreshSecret || !jwtSecret || !csrfSecret) {
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  let decoded: { userId: number; email: string };
  try {
    decoded = jwt.verify(refreshToken, refreshSecret) as {
      userId: number;
      email: string;
    };
  } catch (err) {
    log?.warn("refreshAccessToken:invalid_refresh_token", { err: String(err) });
    throw new AppError("FORBIDDEN", "Invalid or expired refresh token");
  }

  // Ensure user still exists
  const user = await usersRepo.findByEmail(decoded.email, trx);
  if (!user) {
    log?.warn("refreshAccessToken:user_not_found", {
      email: decoded.email,
      userId: decoded.userId,
    });
    throw new AppError("FORBIDDEN", "Invalid or expired refresh token");
  }

  const accessToken = jwt.sign(
    { userId: decoded.userId, email: decoded.email },
    jwtSecret,
    { expiresIn: "1h" },
  );

  const csrfToken = jwt.sign(
    { userId: decoded.userId, email: decoded.email, issuedAt: Date.now() },
    csrfSecret,
  );

  log?.info("refreshAccessToken:success", {
    userId: decoded.userId,
    email: decoded.email,
  });

  return {
    userId: decoded.userId,
    email: decoded.email,
    accessToken,
    csrfToken,
  };
}

export async function getUserProfile({
  userId,
  log,
  trx,
}: GetUserProfileArgs): Promise<PublicUser> {
  if (!userId) {
    throw new AppError("UNAUTHORIZED");
  }

  log?.info("getUserProfile:start", { userId });

  const user = await usersRepo.findPublicUserById(userId, trx);
  if (!user) {
    log?.warn("getUserProfile:not_found", { userId });
    throw new AppError("NOT_FOUND", "User not found");
  }

  log?.info("getUserProfile:success", { userId });
  return user;
}
