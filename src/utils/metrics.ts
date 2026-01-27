import { Request, Response, NextFunction } from 'express';

interface Metrics {
  requests: number;
  errors: number;
  latencySum: number;
  latencyCount: number;
  startTime: number;
}

const metrics: Metrics = {
  requests: 0,
  errors: 0,
  latencySum: 0,
  latencyCount: 0,
  startTime: Date.now()
};

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  metrics.requests++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.latencySum += duration;
    metrics.latencyCount++;
    if (res.statusCode >= 400) metrics.errors++;
  });

  next();
}

export function getMetrics() {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  const avgLatency = metrics.latencyCount > 0 ? Math.round(metrics.latencySum / metrics.latencyCount) : 0;
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : '0.00';

  return {
    uptime_seconds: Math.round(uptime),
    total_requests: metrics.requests,
    total_errors: metrics.errors,
    error_rate_percent: parseFloat(errorRate),
    avg_latency_ms: avgLatency,
    requests_per_minute: metrics.requests > 0 ? Math.round(metrics.requests / (uptime / 60)) : 0
  };
}

