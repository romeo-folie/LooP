import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
  };
}