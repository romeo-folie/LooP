/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export type Success<T> = T;
export type Failure = { error: string; code?: string };
export type ApiResponse<T> = Success<T> | Failure;

export interface AuthContext {
  authUser?: { userId: number; email: string };
  cookies: {
    refresh_token?: string;
    access_token?: string;
    "CSRF-TOKEN"?: string;
    "XSRF-TOKEN"?: string;
  };
}

export type AppRequest<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
> = Request<P, ResBody, ReqBody, ReqQuery, Locals> & AuthContext;

export type AppRequestHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
> = (
  req: AppRequest<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ApiResponse<ResBody>, Locals>,
  next: NextFunction,
) => void | Promise<void>;

export interface IReminder {
  due_datetime: Date;
  is_completed: boolean;
}

export interface IProblem {
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  date_solved: Date;
  notes?: string;
  reminders?: IReminder[];
}

export interface GitHubOAuthAccessTokenSuccess {
  access_token: string;
  token_type: "bearer";
  scope: string;
  expires_in?: number; // seconds until access_token expires
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds until refresh_token expires
}
