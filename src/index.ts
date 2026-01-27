import express, { Request, Response } from 'express';
import cardRoutes from './routes/cardRoutes';
import debugRoutes from './routes/debugRoutes';
import { loadFonts } from './utils/fontLoader';
import { requestLogger, logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './utils/errorHandler';
import { metricsMiddleware, getMetrics } from './utils/metrics';

const fontStatus = loadFonts();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(metricsMiddleware);
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req: Request, res: Response) => {
  const ok = fontStatus.success;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    fonts: { loaded: fontStatus.loaded.length, failed: fontStatus.failed.length }
  });
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.json(getMetrics());
});

app.use('/api/v1', cardRoutes);
if (process.env.NODE_ENV !== 'production') app.use('/debug', debugRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => logger.success(`Server running on http://localhost:${PORT}`));

process.on('uncaughtException', (err) => { logger.error('Uncaught', err); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled', err); process.exit(1); });
