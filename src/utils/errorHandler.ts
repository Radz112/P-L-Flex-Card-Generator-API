// Error handling middleware and input sanitization
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`${req.method} ${req.path}`, err);

  // JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body'
    });
    return;
  }

  // Canvas/font errors
  if (err.message?.match(/canvas|font/i)) {
    res.status(500).json({
      success: false,
      error: 'Image rendering failed'
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { details: [err.message] })
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    details: [`${req.method} ${req.path} does not exist`]
  });
}

export function sanitizeString(input: string, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x1F\x7F<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeTicker(ticker: string): string {
  if (typeof ticker !== 'string') return '';
  return ticker.toUpperCase().replace(/[^A-Z0-9$]/g, '').slice(0, 20);
}
