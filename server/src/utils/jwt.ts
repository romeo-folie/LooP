import jwt from "jsonwebtoken";
import type { StringValue } from "ms"
import path from "path";

import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

const SECRET_KEY = process.env.REFRESH_SECRET as string;

export function generateRefreshToken(payload: object, expiresIn: StringValue = "15m" ) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

export function generateExpiredRefreshToken(payload: object) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: "-1s" }); 
}
