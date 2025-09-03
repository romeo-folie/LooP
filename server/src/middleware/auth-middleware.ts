import { NextFunction } from "express";
import dotenv from "dotenv";
import { AppRequestHandler } from "../types";
import { verifyJwt } from "../lib/jwt";
import AppError from "../types/errors";

dotenv.config();

export const authenticateJWT: AppRequestHandler = (
  req,
  res,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];

  try {
    type UserJWTPayload = { userId: number; email: string };

    const decoded = verifyJwt<UserJWTPayload>(
      token as string,
      process.env.JWT_SECRET as string,
    );

    req.authUser = decoded;
    next();
  } catch (error: unknown) {
    next(new AppError("FORBIDDEN", "Invalid or expired token"));
  }
};
