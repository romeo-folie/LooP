import { NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import _ from "lodash";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";

dotenv.config();

export const verifyCsrfToken: AppRequestHandler = (
  req,
  res,
  next: NextFunction,
) => {
  try {
    const tokenInCookie = req.cookies["CSRF-TOKEN"];
    const tokenInHeader = req.headers["x-csrf-token"];

    if (!tokenInCookie || !tokenInHeader) {
      throw new AppError("FORBIDDEN", "CSRF token is missing");
    }

    const decodedCookie = jwt.verify(
      tokenInCookie,
      process.env.CSRF_SECRET_KEY as string,
    );
    const decodedHeader = jwt.verify(
      tokenInHeader as string,
      process.env.CSRF_SECRET_KEY as string,
    );

    if (!_.isEqual(decodedCookie, decodedHeader)) {
      throw new AppError("FORBIDDEN", "Invalid CSRF token");
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
};
