import type { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { APIError } from '../errors/APIError';

/**
 * Middleware that verifies the GitHub webhook signature (X-Hub-Signature-256).
 *
 * GitHub signs every webhook payload with the shared secret using HMAC-SHA256.
 * This middleware recomputes the signature and compares using timingSafeEqual
 * to prevent timing attacks.
 *
 * Must be used BEFORE express.json() on webhook routes, because it needs
 * the raw body. If the body is already parsed, we use JSON.stringify as a
 * fallback (works for JSON payloads).
 */
export const verifyWebhookSignature = (secret: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

    if (!signatureHeader) {
      next(new APIError('Missing X-Hub-Signature-256 header', 401));
      return;
    }

    // Get the raw body — express.json() with verify option stores it, or we stringify
    const rawBody: string =
      (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

    const expectedSignature =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      next(new APIError('Invalid webhook signature', 401));
      return;
    }

    next();
  };
};
