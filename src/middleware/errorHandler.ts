import type { Request, Response, NextFunction } from 'express';
import { APIError } from '../errors/APIError';

/**
 * Central Express error-handler middleware.
 * Must be registered LAST in app.ts (after all routes).
 * Signature must have 4 parameters for Express to treat it as an error handler.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof APIError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  // Unexpected / programming errors — never leak internal details in production
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      statusCode: 500,
    },
  });
};
