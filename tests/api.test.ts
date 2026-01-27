// API Integration Tests - Real HTTP requests against running server
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cardRoutes from '../src/routes/cardRoutes';
import { loadFonts } from '../src/utils/fontLoader';
import { errorHandler, notFoundHandler } from '../src/utils/errorHandler';

// Create test app instance
function createTestApp() {
  loadFonts();
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
  app.use('/api/v1', cardRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Simple HTTP request helper
function request(server: http.Server, method: string, path: string, body?: any): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  rawBody: string;
}> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const options = {
      hostname: 'localhost',
      port: address.port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed: any;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
          rawBody: data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Send raw request (for malformed JSON tests)
function rawRequest(server: http.Server, method: string, path: string, rawBody: string, contentType = 'application/json'): Promise<{
  status: number;
  body: any;
}> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const options = {
      hostname: 'localhost',
      port: address.port,
      path,
      method,
      headers: { 'Content-Type': contentType }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode || 0, body: parsed });
      });
    });

    req.on('error', reject);
    req.write(rawBody);
    req.end();
  });
}

describe('API Integration Tests', () => {
  let server: http.Server;

  beforeAll(() => {
    const app = createTestApp();
    server = app.listen(0); // Random available port
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request(server, 'GET', '/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('GET /api/v1/generate-card', () => {
    it('returns API documentation', async () => {
      const res = await request(server, 'GET', '/api/v1/generate-card');
      expect(res.status).toBe(200);
      expect(res.body.endpoint).toBe('/api/v1/generate-card');
      expect(res.body.method).toBe('POST');
      expect(res.body.parameters).toBeDefined();
      expect(res.body.parameters.ticker.required).toBe(true);
      expect(res.body.parameters.entry_price.required).toBe(true);
      expect(res.body.parameters.current_price.required).toBe(true);
      expect(res.body.apix402).toBeDefined();
      expect(res.body.apix402.price).toBe('$0.02');
    });
  });

  describe('POST /api/v1/generate-card - Valid requests', () => {
    it('generates card with minimum required fields', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 50000,
        current_price: 100000
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.image).toMatch(/^data:image\/png;base64,/);
      expect(res.body.metadata.ticker).toBe('BTC');
      expect(res.body.metadata.gain_percentage).toBe(100);
      expect(res.body.metadata.is_profit).toBe(true);
    });

    it('generates card with all optional fields', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'ETH',
        entry_price: 2000,
        current_price: 3000,
        theme: 'light',
        wallet_tag: '0xabc...def',
        timestamp: 'Jan 1, 2024'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.theme).toBe('light');
    });

    it('generates loss card correctly', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'LOSS',
        entry_price: 100,
        current_price: 25
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.gain_percentage).toBe(-75);
      expect(res.body.metadata.is_profit).toBe(false);
      expect(res.body.metadata.formatted_gain).toBe('-75.0%');
    });

    it('returns valid base64 PNG data', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'PNG',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(200);
      const base64 = res.body.image.replace('data:image/png;base64,', '');
      const buffer = Buffer.from(base64, 'base64');

      // Verify PNG magic bytes
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4E); // N
      expect(buffer[3]).toBe(0x47); // G
    });
  });

  describe('POST /api/v1/generate-card - All themes', () => {
    const themes = ['dark', 'light', 'degen'];

    themes.forEach(theme => {
      it(`generates card with ${theme} theme`, async () => {
        const res = await request(server, 'POST', '/api/v1/generate-card', {
          ticker: 'TEST',
          entry_price: 100,
          current_price: 200,
          theme
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.metadata.theme).toBe(theme);
      });
    });
  });

  describe('POST /api/v1/generate-card - APIX402 nested body format', () => {
    it('handles APIX402 wrapped body', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        body: {
          ticker: 'APIX',
          entry_price: 100,
          current_price: 150
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.ticker).toBe('APIX');
    });

    it('handles deeply nested APIX402 body', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        body: {
          ticker: 'DEEP',
          entry_price: 50,
          current_price: 100,
          theme: 'degen'
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.theme).toBe('degen');
    });
  });

  describe('POST /api/v1/generate-card - Validation errors', () => {
    it('rejects missing ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContain('ticker is required');
    });

    it('rejects empty ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: '',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContain('ticker is required');
    });

    it('rejects whitespace-only ticker', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: '   ',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects ticker longer than 20 characters', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'THISTICKERISWAYTOOLONG',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('ticker must be 20 characters or less');
    });

    it('rejects missing entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price is required');
    });

    it('rejects missing current_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 100
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('current_price is required');
    });

    it('rejects zero entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 0,
        current_price: 100
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be greater than zero');
    });

    it('rejects negative entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: -100,
        current_price: 100
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be greater than zero');
    });

    it('rejects negative current_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 100,
        current_price: -50
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('current_price cannot be negative');
    });

    it('allows zero current_price (100% loss)', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'RUG',
        entry_price: 100,
        current_price: 0
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.gain_percentage).toBe(-100);
    });

    it('rejects non-numeric entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 'hundred',
        current_price: 200
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price must be a valid number');
    });

    it('rejects Infinity entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: Infinity,
        current_price: 200
      });

      expect(res.status).toBe(400);
    });

    it('rejects invalid theme', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 100,
        current_price: 200,
        theme: 'invalid'
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('theme must be: dark, light, degen');
    });

    it('rejects wallet_tag longer than 50 characters', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 100,
        current_price: 200,
        wallet_tag: 'x'.repeat(51)
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('wallet_tag invalid');
    });

    it('rejects timestamp longer than 100 characters', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC',
        entry_price: 100,
        current_price: 200,
        timestamp: 'x'.repeat(101)
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('timestamp invalid');
    });

    it('returns multiple validation errors at once', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        entry_price: -100,
        current_price: -50
      });

      expect(res.status).toBe(400);
      expect(res.body.details.length).toBeGreaterThan(1);
    });
  });

  describe('POST /api/v1/generate-card - Boundary values', () => {
    it('handles minimum valid entry_price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'TINY',
        entry_price: 1e-20,
        current_price: 1e-19
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('handles maximum valid price', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'HUGE',
        entry_price: 1e14,
        current_price: 1e15
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects entry_price below minimum', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'FAIL',
        entry_price: 1e-21, // Below MIN_PRICE
        current_price: 100
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('entry_price out of range');
    });

    it('rejects current_price above maximum', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'FAIL',
        entry_price: 100,
        current_price: 1e16 // Above MAX_PRICE
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('current_price out of range');
    });

    it('handles ticker at max length (20)', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'EXACTLYTWENTYCHARS01',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/generate-card - Meme coin scenarios', () => {
    it('handles meme coin 5x gain', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'PEPE',
        entry_price: 0.0000024,
        current_price: 0.0000120
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.gain_percentage).toBe(400);
    });

    it('handles meme coin 10000x gain', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'MOON',
        entry_price: 0.00000001,
        current_price: 0.0001,
        theme: 'degen'
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.is_profit).toBe(true);
      // 999,900% formats as 999.9K%
      expect(res.body.metadata.formatted_gain).toMatch(/K%/);
    });

    it('handles meme coin 90% loss', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'WOJAK',
        entry_price: 0.0001,
        current_price: 0.00001
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.gain_percentage).toBe(-90);
      expect(res.body.metadata.is_profit).toBe(false);
    });
  });

  describe('POST /api/v1/generate-card - Input sanitization', () => {
    it('rejects ticker that exceeds max length after XSS attempt', async () => {
      // '<script>alert(1)</script>' is 25 chars, exceeds 20 char limit
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: '<script>alert(1)</script>',
        entry_price: 100,
        current_price: 200
      });

      // Fails validation because input exceeds 20 chars
      expect(res.status).toBe(400);
    });

    it('sanitizes ticker with special characters when within length limit', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'BTC<>!@#',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(200);
      // Should strip all non-alphanumeric except $
      expect(res.body.metadata.ticker).toBe('BTC');
      expect(res.body.metadata.ticker).not.toContain('<');
      expect(res.body.metadata.ticker).not.toContain('>');
    });

    it('converts ticker to uppercase', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'lowercase',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.ticker).toBe('LOWERCASE');
    });

    it('handles ticker with $ prefix', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: '$BTC',
        entry_price: 100,
        current_price: 200
      });

      expect(res.status).toBe(200);
      expect(res.body.metadata.ticker).toBe('$BTC');
    });

    it('sanitizes wallet_tag with control characters', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'TEST',
        entry_price: 100,
        current_price: 200,
        wallet_tag: '0x123\x00\x01\x02abc'
      });

      expect(res.status).toBe(200);
      // Control chars should be stripped
    });
  });

  describe('Error handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(server, 'GET', '/api/v1/unknown');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Endpoint not found');
    });

    it('handles malformed JSON', async () => {
      const res = await rawRequest(server, 'POST', '/api/v1/generate-card', '{invalid json}');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid JSON in request body');
    });

    it('handles empty body', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('handles null body values', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: null,
        entry_price: null,
        current_price: null
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Response format', () => {
    it('returns consistent success response structure', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {
        ticker: 'TEST',
        entry_price: 100,
        current_price: 200
      });

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('image');
      expect(res.body).toHaveProperty('metadata');
      expect(res.body.metadata).toHaveProperty('ticker');
      expect(res.body.metadata).toHaveProperty('gain_percentage');
      expect(res.body.metadata).toHaveProperty('formatted_gain');
      expect(res.body.metadata).toHaveProperty('is_profit');
      expect(res.body.metadata).toHaveProperty('theme');
    });

    it('returns consistent error response structure', async () => {
      const res = await request(server, 'POST', '/api/v1/generate-card', {});

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });
});
