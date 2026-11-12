import { Request, Response, NextFunction, RequestHandler } from 'express';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  });
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  if (rows.length === 0) {
    return headers ? headers.join(',') + '\n' : '';
  }
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = val instanceof Date ? val.toISOString() : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))];
  return lines.join('\n');
}

