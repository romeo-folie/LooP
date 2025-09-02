import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const REFRESH_KEY = process.env.REFRESH_SECRET as string;
const RESET_KEY = process.env.RESET_PASSWORD_SECRET as string;

export function verifyJwt<T>(token: string, secret: string) {
  return jwt.verify(token, secret) as T;
}

export function generateRefreshToken(
  payload: object,
  expiresIn: StringValue = "15m",
) {
  return jwt.sign(payload, REFRESH_KEY, { expiresIn });
}

export function generateExpiredRefreshToken(payload: object) {
  return jwt.sign(payload, REFRESH_KEY, { expiresIn: "-1s" });
}

export function generatePasswordResetToken(
  payload: object,
  expiresIn: StringValue = "15m",
) {
  return jwt.sign(payload, RESET_KEY, { expiresIn });
}
