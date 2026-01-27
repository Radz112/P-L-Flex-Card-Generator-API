import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cardRoutes from '../src/routes/cardRoutes';
import { loadFonts } from '../src/utils/fontLoader';
import { errorHandler, notFoundHandler } from '../src/utils/errorHandler';
import { metricsMiddleware, getMetrics, resetMetrics } from '../src/utils/metrics';

function createTestApp() {
  const fontStatus = loadFonts();
  const app = express();
  app.use(metricsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => {
    const ok = fontStatus.success;
    res.status(ok ? 200 : 503).json({ status: ok ? 'healthy' : 'degraded', fonts: { loaded: fontStatus.loaded.length, failed: fontStatus.failed.length } });
  });
  app.get('/metrics', (_req, res) => res.json(getMetrics()));
  app.use('/api/v1', cardRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function request(server: http.Server, method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const req = http.request({ hostname: 'localhost', port: address.port, path, method, headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function rawRequest(server: http.Server, path: string, rawBody: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const req = http.request({ hostname: 'localhost', port: address.port, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

describe('API', () => {
  let server: http.Server;
  beforeAll(() => { server = createTestApp().listen(0); });
  afterAll(() => server.close());

  describe('GET /health', () => {
    it('returns healthy when fonts loaded', async () => {
      const res = await request(server, 'GET', '/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.fonts.loaded).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/generate-card', () => {
    it('returns API docs', async () => {
      const res = await request(server, 'GET', '/api/v1/generate-card');
      expect(res.status).toBe(200);
      expect(res.body.endpoint).toBe('/api/v1/generate-card');
      expect(res.body.method).toBe('POST');
      expect(res.body.params).toBeDefined();
      expect(res.body.price).toBe('$0.02');
    });
  });

  describe('POST /api/v1/generate-card - Valid', () => {
    it('generates card', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 50000, current_price: 100000 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.image).toMatch(/^data:image\/png;base64,/);
      expect(res.body.metadata.ticker).toBe('BTC');
      expect(res.body.metadata.gain).toBe(100);
      expect(res.body.metadata.profit).toBe(true);
    });

    it('generates loss card', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'LOSS', entry_price: 100, current_price: 25 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.gain).toBe(-75);
      expect(res.body.metadata.profit).toBe(false);
      expect(res.body.metadata.formatted).toBe('-75.0%');
    });

    it('returns valid PNG', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'PNG', entry_price: 100, current_price: 200 });
      const buf = Buffer.from(res.body.image.replace('data:image/png;base64,', ''), 'base64');
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
    });
  });

  describe('POST - Themes', () => {
    ['dark', 'light', 'degen'].forEach(theme => {
      it(`generates ${theme} theme`, async () => {
        const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'TEST', entry_price: 100, current_price: 200, theme });
        expect(res.status).toBe(200);
        expect(res.body.metadata.theme).toBe(theme);
      });
    });
  });

  describe('POST - APIX402', () => {
    it('handles wrapped body', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { body: { ticker: 'APIX', entry_price: 100, current_price: 150 } });
      expect(res.status).toBe(200);
      expect(res.body.metadata.ticker).toBe('APIX');
    });
  });

  describe('POST - Validation', () => {
    it('rejects missing ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { entry_price: 100, current_price: 200 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('ticker required');
    });

    it('rejects empty ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: '', entry_price: 100, current_price: 200 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('ticker required');
    });

    it('rejects invalid ticker chars', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: '!@#', entry_price: 100, current_price: 200 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('ticker must contain A-Z, 0-9, or $');
    });

    it('rejects missing entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', current_price: 200 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price required');
    });

    it('rejects missing current_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 100 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('current_price required');
    });

    it('rejects zero entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 0, current_price: 100 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be > 0');
    });

    it('rejects negative entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: -100, current_price: 100 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be > 0');
    });

    it('rejects negative current_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 100, current_price: -50 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('current_price cannot be negative');
    });

    it('allows zero current_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'RUG', entry_price: 100, current_price: 0 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.gain).toBe(-100);
    });

    it('rejects non-numeric entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 'hundred', current_price: 200 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be number');
    });

    it('rejects invalid theme', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'BTC', entry_price: 100, current_price: 200, theme: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('theme must be: dark, light, degen');
    });
  });

  describe('POST - Boundary', () => {
    it('handles min entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'TINY', entry_price: 1e-20, current_price: 1e-19 });
      expect(res.status).toBe(200);
    });

    it('handles max price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'HUGE', entry_price: 1e14, current_price: 1e15 });
      expect(res.status).toBe(200);
    });

    it('rejects entry_price below min', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'FAIL', entry_price: 1e-21, current_price: 100 });
      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price out of range');
    });

    it('truncates long ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'THISTICKERISWAYTOOLONG', entry_price: 100, current_price: 200 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.ticker).toBe('THISTICKERISWAYTOOLO');
    });
  });

  describe('POST - Meme coins', () => {
    it('handles 5x gain', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'PEPE', entry_price: 0.0000024, current_price: 0.0000120 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.gain).toBe(400);
    });

    it('handles 10000x gain', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'MOON', entry_price: 0.00000001, current_price: 0.0001, theme: 'degen' });
      expect(res.status).toBe(200);
      expect(res.body.metadata.profit).toBe(true);
      expect(res.body.metadata.formatted).toMatch(/K%/);
    });

    it('handles 90% loss', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'WOJAK', entry_price: 0.0001, current_price: 0.00001 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.gain).toBe(-90);
      expect(res.body.metadata.profit).toBe(false);
    });
  });

  describe('POST - Sanitization', () => {
    it('sanitizes XSS', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: '<script>alert(1)</script>', entry_price: 100, current_price: 200 });
      expect(res.status).toBe(200);
      expect(res.body.metadata.ticker).toBe('SCRIPTALERT1SCRIPT');
    });

    it('uppercases ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'lowercase', entry_price: 100, current_price: 200 });
      expect(res.body.metadata.ticker).toBe('LOWERCASE');
    });

    it('keeps $ in ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: '$BTC', entry_price: 100, current_price: 200 });
      expect(res.body.metadata.ticker).toBe('$BTC');
    });
  });

  describe('Errors', () => {
    it('404 for unknown', async () => {
      const res = await request(server, 'GET', '/api/v1/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('handles malformed JSON', async () => {
      const res = await rawRequest(server, '/api/v1/generate-card', '{bad}');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON');
    });
  });

  describe('Response structure', () => {
    it('success response', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', { ticker: 'TEST', entry_price: 100, current_price: 200 });
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('image');
      expect(res.body.metadata).toHaveProperty('ticker');
      expect(res.body.metadata).toHaveProperty('gain');
      expect(res.body.metadata).toHaveProperty('formatted');
      expect(res.body.metadata).toHaveProperty('profit');
      expect(res.body.metadata).toHaveProperty('theme');
    });

    it('error response', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {});
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /metrics', () => {
    it('returns metrics', async () => {
      const res = await request(server, 'GET', '/metrics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uptime_seconds');
      expect(res.body).toHaveProperty('total_requests');
      expect(res.body).toHaveProperty('total_errors');
      expect(res.body).toHaveProperty('error_rate_percent');
      expect(res.body).toHaveProperty('avg_latency_ms');
      expect(res.body).toHaveProperty('requests_per_minute');
      expect(typeof res.body.total_requests).toBe('number');
      expect(res.body.total_requests).toBeGreaterThan(0);
    });
  });
});
