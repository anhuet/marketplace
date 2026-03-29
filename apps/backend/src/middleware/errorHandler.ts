import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Invalid or missing authentication token' },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unexpected error — log server-side, return generic message to client
  process.stderr.write(`[Unhandled Error] ${err.stack ?? err.message}\n`);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
