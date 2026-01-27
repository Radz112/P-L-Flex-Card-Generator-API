import { Request, Response, NextFunction } from 'express';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m' };
const methodColor: any = { GET: C.green, POST: C.blue, PUT: C.yellow, DELETE: C.red };

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const mc = methodColor[method] || C.reset;

  const originalSend = res.send;
  res.send = function(body): Response {
    const s = res.statusCode;
    const sc = s >= 500 ? C.red : s >= 400 ? C.yellow : s >= 300 ? C.cyan : C.green;
    console.log(`${C.dim}[${new Date().toISOString()}]${C.reset} ${mc}${method}${C.reset} ${req.path} ${sc}${s}${C.reset} ${C.dim}${Date.now() - start}ms${C.reset}`);
    return originalSend.call(this, body);
  };
  next();
}

export const logger = {
  info: (msg: string, data?: unknown) => console.log(`${C.dim}[${new Date().toISOString()}]${C.reset} ${C.blue}INFO${C.reset} ${msg}`, data || ''),
  warn: (msg: string, data?: unknown) => console.log(`${C.dim}[${new Date().toISOString()}]${C.reset} ${C.yellow}WARN${C.reset} ${msg}`, data || ''),
  error: (msg: string, err?: unknown) => console.log(`${C.dim}[${new Date().toISOString()}]${C.reset} ${C.red}ERROR${C.reset} ${msg}`, err instanceof Error ? err.message : ''),
  success: (msg: string) => console.log(`${C.dim}[${new Date().toISOString()}]${C.reset} ${C.green}OK${C.reset} ${msg}`)
};
