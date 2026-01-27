import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`${req.method} ${req.path}`, err);

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, error: 'Invalid JSON' });
    return;
  }

  if (err.message?.match(/canvas|font/i)) {
    res.status(500).json({ success: false, error: 'Render failed' });
    return;
  }

  res.status(500).json({ success: false, error: 'Server error' });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `${req.method} ${req.path} not found` });
}

export function sanitizeString(input: string, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\x00-\x1F\x7F<>]/g, '').trim().slice(0, maxLength);
}

export function sanitizeTicker(ticker: string): string {
  if (typeof ticker !== 'string') return '';
  return ticker.toUpperCase().replace(/[^A-Z0-9$]/g, '').slice(0, 20);
}
