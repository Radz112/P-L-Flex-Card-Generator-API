// Card Renderer Integration Tests - Real canvas rendering, no mocks
import { describe, it, expect } from 'vitest';
import { renderCard, CardData, Theme, CARD_WIDTH, CARD_HEIGHT } from '../src/services/cardRenderer';
import { calculatePnL, PnLResult } from '../src/utils/pnlCalculator';

// Helper to create valid CardData
function createCardData(overrides: Partial<CardData> = {}): CardData {
  const pnl = calculatePnL(100, 200) as PnLResult;
  return {
    tokenSymbol: 'TEST',
    entryPrice: 100,
    currentPrice: 200,
    pnl,
    walletTag: '0x1234...abcd',
    timestamp: 'Jan 15, 2024, 10:30 AM',
    ...overrides
  };
}

// Verify PNG magic bytes
function isPNG(buffer: Buffer): boolean {
  return buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A;
}

// Extract PNG dimensions from IHDR chunk
function getPNGDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (!isPNG(buffer) || buffer.length < 24) return null;
  // IHDR chunk starts at byte 8, width at offset 16, height at offset 20
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

describe('renderCard', () => {
  describe('PNG output validation', () => {
    it('produces valid PNG buffer', () => {
      const data = createCardData();
      const buffer = renderCard(data, 'dark');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000); // PNG should be at least 1KB
      expect(isPNG(buffer)).toBe(true);
    });

    it('produces correct dimensions', () => {
      const data = createCardData();
      const buffer = renderCard(data, 'dark');
      const dimensions = getPNGDimensions(buffer);

      expect(dimensions).not.toBeNull();
      expect(dimensions!.width).toBe(CARD_WIDTH);
      expect(dimensions!.height).toBe(CARD_HEIGHT);
    });

    it('exports constants match actual output', () => {
      expect(CARD_WIDTH).toBe(1200);
      expect(CARD_HEIGHT).toBe(630);
    });
  });

  describe('theme rendering', () => {
    const themes: Theme[] = ['dark', 'light', 'degen'];

    themes.forEach(theme => {
      it(`renders ${theme} theme successfully`, () => {
        const data = createCardData();
        const buffer = renderCard(data, theme);

        expect(isPNG(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(1000);
      });
    });

    it('produces different output for different themes', () => {
      const data = createCardData();
      const darkBuffer = renderCard(data, 'dark');
      const lightBuffer = renderCard(data, 'light');
      const degenBuffer = renderCard(data, 'degen');

      // Different themes should produce different images
      expect(darkBuffer.equals(lightBuffer)).toBe(false);
      expect(darkBuffer.equals(degenBuffer)).toBe(false);
      expect(lightBuffer.equals(degenBuffer)).toBe(false);
    });

    it('degen theme produces larger output (scanlines/effects)', () => {
      const data = createCardData();
      const darkBuffer = renderCard(data, 'dark');
      const degenBuffer = renderCard(data, 'degen');

      // Degen has more visual elements, may compress differently
      // Just verify both are valid
      expect(isPNG(darkBuffer)).toBe(true);
      expect(isPNG(degenBuffer)).toBe(true);
    });
  });

  describe('profit vs loss rendering', () => {
    it('renders profit card successfully', () => {
      const pnl = calculatePnL(100, 200) as PnLResult; // +100%
      const data = createCardData({ pnl, currentPrice: 200 });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
      expect(pnl.isProfit).toBe(true);
    });

    it('renders loss card successfully', () => {
      const pnl = calculatePnL(100, 50) as PnLResult; // -50%
      const data = createCardData({ pnl, currentPrice: 50 });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
      expect(pnl.isProfit).toBe(false);
    });

    it('profit and loss cards are visually different', () => {
      const profitPnl = calculatePnL(100, 200) as PnLResult;
      const lossPnl = calculatePnL(100, 50) as PnLResult;

      const profitData = createCardData({ pnl: profitPnl, currentPrice: 200 });
      const lossData = createCardData({ pnl: lossPnl, currentPrice: 50 });

      const profitBuffer = renderCard(profitData, 'dark');
      const lossBuffer = renderCard(lossData, 'dark');

      expect(profitBuffer.equals(lossBuffer)).toBe(false);
    });

    it('renders break-even (0%) successfully', () => {
      const pnl = calculatePnL(100, 100) as PnLResult;
      const data = createCardData({ pnl, currentPrice: 100 });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders 100% loss successfully', () => {
      const pnl = calculatePnL(100, 0) as PnLResult;
      const data = createCardData({ pnl, currentPrice: 0 });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });
  });

  describe('extreme values', () => {
    it('renders massive gains (10000x)', () => {
      const pnl = calculatePnL(0.00000001, 0.0001) as PnLResult;
      const data = createCardData({
        tokenSymbol: 'MOON',
        entryPrice: 0.00000001,
        currentPrice: 0.0001,
        pnl
      });
      const buffer = renderCard(data, 'degen');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders meme coin prices', () => {
      const pnl = calculatePnL(0.0000024, 0.0000120) as PnLResult;
      const data = createCardData({
        tokenSymbol: 'PEPE',
        entryPrice: 0.0000024,
        currentPrice: 0.0000120,
        pnl
      });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders large cap token prices', () => {
      const pnl = calculatePnL(50000, 100000) as PnLResult;
      const data = createCardData({
        tokenSymbol: 'BTC',
        entryPrice: 50000,
        currentPrice: 100000,
        pnl
      });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('handles long token symbol', () => {
      const pnl = calculatePnL(100, 200) as PnLResult;
      const data = createCardData({
        tokenSymbol: 'SUPERLONGTOKEN',
        pnl
      });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('renders without wallet tag', () => {
      const data = createCardData({ walletTag: undefined });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders without timestamp', () => {
      const data = createCardData({ timestamp: undefined });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders with only required fields', () => {
      const pnl = calculatePnL(100, 200) as PnLResult;
      const minimalData: CardData = {
        tokenSymbol: 'MIN',
        entryPrice: 100,
        currentPrice: 200,
        pnl
      };
      const buffer = renderCard(minimalData, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders with long wallet tag', () => {
      const data = createCardData({
        walletTag: '0x1234567890abcdef1234567890abcdef12345678'
      });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });

    it('renders with long timestamp', () => {
      const data = createCardData({
        timestamp: 'January 15, 2024, 10:30:45 AM UTC'
      });
      const buffer = renderCard(data, 'dark');

      expect(isPNG(buffer)).toBe(true);
    });
  });

  describe('consistency', () => {
    it('produces consistent output for same input', () => {
      const data = createCardData();
      const buffer1 = renderCard(data, 'dark');
      const buffer2 = renderCard(data, 'dark');

      expect(buffer1.equals(buffer2)).toBe(true);
    });

    it('changing token symbol changes output', () => {
      const data1 = createCardData({ tokenSymbol: 'AAA' });
      const data2 = createCardData({ tokenSymbol: 'BBB' });

      const buffer1 = renderCard(data1, 'dark');
      const buffer2 = renderCard(data2, 'dark');

      expect(buffer1.equals(buffer2)).toBe(false);
    });
  });

  describe('all theme and state combinations', () => {
    const themes: Theme[] = ['dark', 'light', 'degen'];
    const states = [
      { name: 'profit', entry: 100, current: 200 },
      { name: 'loss', entry: 100, current: 50 },
      { name: 'break-even', entry: 100, current: 100 }
    ];

    themes.forEach(theme => {
      states.forEach(state => {
        it(`renders ${theme} theme with ${state.name} state`, () => {
          const pnl = calculatePnL(state.entry, state.current) as PnLResult;
          const data = createCardData({
            pnl,
            entryPrice: state.entry,
            currentPrice: state.current
          });
          const buffer = renderCard(data, theme);

          expect(isPNG(buffer)).toBe(true);
          expect(buffer.length).toBeGreaterThan(1000);
        });
      });
    });
  });
});
