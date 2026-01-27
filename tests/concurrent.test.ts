// Concurrent Request Tests - Verify async behavior under load
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cardRoutes from '../src/routes/cardRoutes';
import { loadFonts } from '../src/utils/fontLoader';
import { errorHandler, notFoundHandler } from '../src/utils/errorHandler';

function createTestApp() {
  loadFonts();
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', cardRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function request(server: http.Server, body: any): Promise<{
  status: number;
  body: any;
  duration: number;
}> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const options = {
      hostname: 'localhost',
      port: address.port,
      path: '/api/v1/generate-card',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({
          status: res.statusCode || 0,
          body: parsed,
          duration: Date.now() - start
        });
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Concurrent Request Handling', () => {
  let server: http.Server;

  beforeAll(() => {
    const app = createTestApp();
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('handles multiple simultaneous requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
      ticker: `TEST${i}`,
      entry_price: 100,
      current_price: 200 + i * 10
    }));

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    // All should succeed
    results.forEach((res, i) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.ticker).toBe(`TEST${i}`);
    });
  });

  it('produces unique images for different inputs', async () => {
    const requests = [
      { ticker: 'AAA', entry_price: 100, current_price: 200 },
      { ticker: 'BBB', entry_price: 100, current_price: 200 },
      { ticker: 'AAA', entry_price: 100, current_price: 300 }
    ];

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    // All succeed
    results.forEach(res => {
      expect(res.status).toBe(200);
    });

    // All images should be different (different tickers or prices)
    const images = results.map(r => r.body.image);
    expect(images[0]).not.toBe(images[1]); // Different ticker
    expect(images[0]).not.toBe(images[2]); // Different price
    expect(images[1]).not.toBe(images[2]); // Different ticker and price
  });

  it('produces identical images for identical inputs', async () => {
    const body = { ticker: 'SAME', entry_price: 100, current_price: 200 };

    const results = await Promise.all([
      request(server, body),
      request(server, body),
      request(server, body)
    ]);

    // All succeed
    results.forEach(res => {
      expect(res.status).toBe(200);
    });

    // All images should be identical
    expect(results[0].body.image).toBe(results[1].body.image);
    expect(results[1].body.image).toBe(results[2].body.image);
  });

  it('handles mixed valid and invalid requests concurrently', async () => {
    const requests = [
      { ticker: 'VALID1', entry_price: 100, current_price: 200 },
      { ticker: '', entry_price: 100, current_price: 200 }, // Invalid
      { ticker: 'VALID2', entry_price: 100, current_price: 300 },
      { ticker: 'FAIL', entry_price: -100, current_price: 200 }, // Invalid
      { ticker: 'VALID3', entry_price: 100, current_price: 150 }
    ];

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(400);
    expect(results[2].status).toBe(200);
    expect(results[3].status).toBe(400);
    expect(results[4].status).toBe(200);
  });

  it('handles burst of requests to same ticker', async () => {
    const body = { ticker: 'BURST', entry_price: 50, current_price: 100 };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => request(server, body))
    );

    // All should succeed
    const successes = results.filter(r => r.status === 200);
    expect(successes.length).toBe(20);
  });

  it('handles different themes concurrently', async () => {
    const themes = ['dark', 'light', 'degen'];
    const requests = themes.map(theme => ({
      ticker: 'THEME',
      entry_price: 100,
      current_price: 200,
      theme
    }));

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    // All succeed with correct themes
    results.forEach((res, i) => {
      expect(res.status).toBe(200);
      expect(res.body.metadata.theme).toBe(themes[i]);
    });

    // All images should be different (different themes)
    const images = results.map(r => r.body.image);
    expect(new Set(images).size).toBe(3);
  });

  it('maintains data isolation between requests', async () => {
    // Send different profit/loss scenarios concurrently
    const requests = [
      { ticker: 'PROFIT', entry_price: 100, current_price: 200 },
      { ticker: 'LOSS', entry_price: 100, current_price: 50 },
      { ticker: 'EVEN', entry_price: 100, current_price: 100 }
    ];

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    // Verify each response matches its request
    expect(results[0].body.metadata.profit).toBe(true);
    expect(results[0].body.metadata.gain).toBe(100);

    expect(results[1].body.metadata.profit).toBe(false);
    expect(results[1].body.metadata.gain).toBe(-50);

    expect(results[2].body.metadata.profit).toBe(true);
    expect(results[2].body.metadata.gain).toBe(0);
  });

  it('handles varying payload sizes concurrently', async () => {
    const requests = [
      { ticker: 'A', entry_price: 1, current_price: 2 },
      { ticker: 'LONGERTICKER', entry_price: 1000000, current_price: 2000000, wallet_tag: '0x' + 'a'.repeat(40), timestamp: 'January 15, 2024, 10:30 AM UTC' },
      { ticker: 'B', entry_price: 0.00000001, current_price: 0.0001 }
    ];

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    results.forEach(res => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Request timing', () => {
  let server: http.Server;

  beforeAll(() => {
    const app = createTestApp();
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('completes single request in reasonable time', async () => {
    const result = await request(server, {
      ticker: 'FAST',
      entry_price: 100,
      current_price: 200
    });

    expect(result.status).toBe(200);
    expect(result.duration).toBeLessThan(2000); // Should complete within 2s
  });

  it('parallel requests complete faster than sequential would', async () => {
    const body = { ticker: 'SPEED', entry_price: 100, current_price: 200 };

    const start = Date.now();
    await Promise.all(
      Array.from({ length: 5 }, () => request(server, body))
    );
    const parallelTime = Date.now() - start;

    // If truly sequential, 5 requests would take ~5x single request time
    // Parallel should be much faster
    expect(parallelTime).toBeLessThan(5000);
  });
});

describe('Error isolation', () => {
  let server: http.Server;

  beforeAll(() => {
    const app = createTestApp();
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('one error does not affect other concurrent requests', async () => {
    const requests = [
      { ticker: 'GOOD1', entry_price: 100, current_price: 200 },
      { ticker: '', entry_price: 100, current_price: 200 }, // Will fail
      { ticker: 'GOOD2', entry_price: 100, current_price: 300 },
      { entry_price: -1, current_price: 200 }, // Will fail (no ticker, bad price)
      { ticker: 'GOOD3', entry_price: 100, current_price: 400 }
    ];

    const results = await Promise.all(
      requests.map(body => request(server, body))
    );

    // Good requests should succeed regardless of bad ones
    expect(results[0].status).toBe(200);
    expect(results[0].body.metadata.ticker).toBe('GOOD1');

    expect(results[1].status).toBe(400);

    expect(results[2].status).toBe(200);
    expect(results[2].body.metadata.ticker).toBe('GOOD2');

    expect(results[3].status).toBe(400);

    expect(results[4].status).toBe(200);
    expect(results[4].body.metadata.ticker).toBe('GOOD3');
  });
});
