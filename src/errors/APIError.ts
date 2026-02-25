/**
 * Operational error with an HTTP status code.
 * Throw this from service layer for expected business-logic failures
 * (bad input, not found, unauthorized, etc.).
 * The central errorHandler middleware distinguishes APIError from
 * unexpected programming errors (which become 500s).
 */
export class APIError extends Error {
  public readonly statusCode: number;
  /** true = expected/operational; false = programming bug */
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
