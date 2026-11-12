import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/apiResponse';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists.',
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[Backend Error]', err);
  return res.status(500).json({
    success: false,
    message,
  });
}

