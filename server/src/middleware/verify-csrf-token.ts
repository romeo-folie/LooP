import { NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import _ from "lodash";
import { AppRequestHandler } from "../types";

dotenv.config();

export const verifyCsrfToken: AppRequestHandler = (
  req,
  res,
  next: NextFunction,
) => {
  const tokenInCookie = req.cookies["CSRF-TOKEN"];
  const tokenInHeader = req.headers["x-csrf-token"];

  if (!tokenInCookie || !tokenInHeader) {
    res.status(403).json({ error: "CSRF token is missing" });
    return;
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
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
};
