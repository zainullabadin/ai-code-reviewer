import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { APIError } from '../errors/APIError';

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * On success the parsed (and type-coerced) data replaces req.body.
 * On failure a 400 APIError is forwarded to the error handler.
 */
export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const messages = zodError.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      next(new APIError(`Validation error: ${messages}`, 400));
      return;
    }

    req.body = result.data;
    next();
  };
};
