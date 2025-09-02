export default class AppError extends Error {
  constructor(
    public code: 'BAD_REQUEST'|'UNAUTHORIZED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'INTERNAL',
    message?: string,
  ) {
    super(message ?? code);
  }
}