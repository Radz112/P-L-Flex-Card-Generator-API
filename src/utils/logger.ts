// Simple colored logger for terminal output
import { Request, Response, NextFunction } from 'express';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const methodColors: Record<string, string> = {
  GET: C.green, POST: C.blue, PUT: C.yellow, DELETE: C.red
};

function timestamp(): string {
  return new Date().toISOString();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const methodColor = methodColors[method] || C.reset;

  const originalSend = res.send;
  res.send = function(body): Response {
    const status = res.statusCode;
    const statusColor = status >= 500 ? C.red : status >= 400 ? C.yellow : status >= 300 ? C.cyan : C.green;
    console.log(
      `${C.dim}[${timestamp()}]${C.reset} ${methodColor}${method}${C.reset} ${req.path} ` +
      `${statusColor}${status}${C.reset} ${C.dim}${Date.now() - start}ms${C.reset}`
    );
    return originalSend.call(this, body);
  };

  next();
}

export const logger = {
  info: (msg: string, data?: unknown) =>
    console.log(`${C.dim}[${timestamp()}]${C.reset} ${C.blue}INFO${C.reset} ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg: string, data?: unknown) =>
    console.log(`${C.dim}[${timestamp()}]${C.reset} ${C.yellow}WARN${C.reset} ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg: string, err?: unknown) =>
    console.log(`${C.dim}[${timestamp()}]${C.reset} ${C.red}ERROR${C.reset} ${msg}`, err instanceof Error ? err.message : (err ? JSON.stringify(err) : '')),
  success: (msg: string, data?: unknown) =>
    console.log(`${C.dim}[${timestamp()}]${C.reset} ${C.green}SUCCESS${C.reset} ${msg}`, data ? JSON.stringify(data) : '')
};
