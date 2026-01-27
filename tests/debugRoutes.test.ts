import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import debugRoutes from '../src/routes/debugRoutes';
import { loadFonts } from '../src/utils/fontLoader';

function createDebugApp() {
  loadFonts();
  const app = express();
  app.use('/debug', debugRoutes);
  return app;
}

function request(server: http.Server, path: string): Promise<{ status: number; body: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const req = http.request({ hostname: 'localhost', port: address.port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        body: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || ''
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Debug Routes', () => {
  let server: http.Server;

  beforeAll(() => {
    server = createDebugApp().listen(0);
  });

  afterAll(() => {
    server.close();
  });

  describe('GET /debug/canvas-test', () => {
    it('returns JSON with base64 image by default', async () => {
      const res = await request(server, '/debug/canvas-test');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('application/json');
      const json = JSON.parse(res.body.toString());
      expect(json.success).toBe(true);
      expect(json.image).toMatch(/^data:image\/png;base64,/);
    });

    it('returns PNG image when format=image', async () => {
      const res = await request(server, '/debug/canvas-test?format=image');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('image/png');
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
      expect(res.body[2]).toBe(0x4e);
      expect(res.body[3]).toBe(0x47);
    });
  });

  describe('GET /debug/pnl-test', () => {
    it('returns test calculations', async () => {
      const res = await request(server, '/debug/pnl-test');
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body.toString());
      expect(json.tests).toBeInstanceOf(Array);
      expect(json.tests.length).toBe(5);

      const meme5x = json.tests.find((t: { desc: string }) => t.desc === 'Meme 5x');
      expect(meme5x).toBeDefined();
      expect(meme5x.entry).toBe(0.0000024);
      expect(meme5x.current).toBe(0.000012);
      expect(meme5x.result.percentageGain).toBe(400);
      expect(meme5x.result.isProfit).toBe(true);

      const loss50 = json.tests.find((t: { desc: string }) => t.desc === '50% loss');
      expect(loss50).toBeDefined();
      expect(loss50.result.percentageGain).toBe(-50);
      expect(loss50.result.isProfit).toBe(false);

      const gain10000x = json.tests.find((t: { desc: string }) => t.desc === '10000x');
      expect(gain10000x).toBeDefined();
      expect(gain10000x.result.percentageGain).toBe(999900);
    });

    it('includes formatted prices', async () => {
      const res = await request(server, '/debug/pnl-test');
      const json = JSON.parse(res.body.toString());
      const meme5x = json.tests.find((t: { desc: string }) => t.desc === 'Meme 5x');
      expect(meme5x.entryFmt).toMatch(/^\$0\.0\{/);
      expect(meme5x.currentFmt).toBe('$0.000012');
    });
  });

  describe('GET /debug/render-dark', () => {
    it('returns PNG image by default', async () => {
      const res = await request(server, '/debug/render-dark');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('image/png');
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
    });

    it('returns JSON when format=json', async () => {
      const res = await request(server, '/debug/render-dark?format=json');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('application/json');
      const json = JSON.parse(res.body.toString());
      expect(json.theme).toBe('dark');
      expect(json.image).toMatch(/^data:image\/png;base64,/);
    });

    it('renders profit card by default', async () => {
      const res = await request(server, '/debug/render-dark?format=json');
      const json = JSON.parse(res.body.toString());
      const imageData = json.image.replace('data:image/png;base64,', '');
      expect(imageData.length).toBeGreaterThan(1000);
    });

    it('renders loss card when loss=true', async () => {
      const res = await request(server, '/debug/render-dark?loss=true&format=json');
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body.toString());
      expect(json.theme).toBe('dark');
    });
  });

  describe('GET /debug/render-light', () => {
    it('returns light theme PNG', async () => {
      const res = await request(server, '/debug/render-light');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('image/png');
    });

    it('returns JSON with light theme', async () => {
      const res = await request(server, '/debug/render-light?format=json');
      const json = JSON.parse(res.body.toString());
      expect(json.theme).toBe('light');
    });
  });

  describe('GET /debug/render-degen', () => {
    it('returns degen theme PNG', async () => {
      const res = await request(server, '/debug/render-degen');
      expect(res.status).toBe(200);
      expect(res.contentType).toContain('image/png');
    });

    it('returns JSON with degen theme', async () => {
      const res = await request(server, '/debug/render-degen?format=json');
      const json = JSON.parse(res.body.toString());
      expect(json.theme).toBe('degen');
    });

    it('loss=true works with degen theme', async () => {
      const res = await request(server, '/debug/render-degen?loss=true&format=json');
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body.toString());
      expect(json.theme).toBe('degen');
    });
  });

  describe('Theme comparison', () => {
    it('produces different images for different themes', async () => {
      const [dark, light, degen] = await Promise.all([
        request(server, '/debug/render-dark?format=json'),
        request(server, '/debug/render-light?format=json'),
        request(server, '/debug/render-degen?format=json')
      ]);

      const darkJson = JSON.parse(dark.body.toString());
      const lightJson = JSON.parse(light.body.toString());
      const degenJson = JSON.parse(degen.body.toString());

      expect(darkJson.image).not.toBe(lightJson.image);
      expect(darkJson.image).not.toBe(degenJson.image);
      expect(lightJson.image).not.toBe(degenJson.image);
    });

    it('produces different images for profit vs loss', async () => {
      const [profit, loss] = await Promise.all([
        request(server, '/debug/render-dark?format=json'),
        request(server, '/debug/render-dark?loss=true&format=json')
      ]);

      const profitJson = JSON.parse(profit.body.toString());
      const lossJson = JSON.parse(loss.body.toString());

      expect(profitJson.image).not.toBe(lossJson.image);
    });
  });
});
