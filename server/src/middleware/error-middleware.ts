import type { ErrorRequestHandler } from 'express';
import AppError from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const status =
      err.code === 'BAD_REQUEST'  ? 400 :
      err.code === 'UNAUTHORIZED' ? 401 :
      err.code === 'FORBIDDEN'    ? 403 :
      err.code === 'NOT_FOUND'    ? 404 :
      err.code === 'CONFLICT'     ? 409 : 500;
    res.status(status).json({ error: err.code, message: (err.message ?? err.code) });
  }
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
