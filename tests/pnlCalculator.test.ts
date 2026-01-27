// P&L Calculator Integration Tests - No mocks, real calculations
import { describe, it, expect } from 'vitest';
import { calculatePnL, formatTokenPrice, PnLResult } from '../src/utils/pnlCalculator';

describe('calculatePnL', () => {
  describe('valid calculations', () => {
    it('calculates profit correctly', () => {
      const result = calculatePnL(100, 150);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(50);
      expect(pnl.isProfit).toBe(true);
      expect(pnl.formattedGain).toBe('+50.0%');
    });

    it('calculates loss correctly', () => {
      const result = calculatePnL(100, 50);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(-50);
      expect(pnl.isProfit).toBe(false);
      expect(pnl.formattedGain).toBe('-50.0%');
    });

    it('handles break-even (0% change)', () => {
      const result = calculatePnL(100, 100);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(0);
      expect(pnl.isProfit).toBe(true); // 0% is considered not a loss
      expect(pnl.formattedGain).toBe('+0.0000%');
    });

    it('handles 100% loss (current price = 0)', () => {
      const result = calculatePnL(100, 0);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(-100);
      expect(pnl.isProfit).toBe(false);
      expect(pnl.formattedGain).toBe('-100.0%');
    });

    it('handles 100% gain (2x)', () => {
      const result = calculatePnL(100, 200);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(100);
      expect(pnl.formattedGain).toBe('+100.0%');
    });
  });

  describe('meme coin scenarios (tiny prices)', () => {
    it('handles meme coin 5x gain', () => {
      const result = calculatePnL(0.0000024, 0.0000120);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(400);
      expect(pnl.isProfit).toBe(true);
      expect(pnl.formattedGain).toBe('+400.0%'); // Formatted with 1 decimal for values 10-999
    });

    it('handles meme coin 10000x gain', () => {
      const result = calculatePnL(0.00000001, 0.0001);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      // (0.0001 - 0.00000001) / 0.00000001 * 100 = 999,900%
      expect(pnl.percentageGain).toBe(999900);
      expect(pnl.formattedGain).toBe('+999.9K%'); // Formatted in thousands
    });

    it('handles tiny fractional changes', () => {
      const result = calculatePnL(0.0000001, 0.00000011);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBeCloseTo(10, 0);
      expect(pnl.isProfit).toBe(true);
    });

    it('handles extremely small entry price', () => {
      const result = calculatePnL(1e-18, 1e-17);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(900);
      expect(pnl.isProfit).toBe(true);
    });
  });

  describe('large value scenarios', () => {
    it('handles Bitcoin-scale prices', () => {
      const result = calculatePnL(50000, 100000);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(100);
    });

    it('handles very large prices', () => {
      const result = calculatePnL(1e12, 2e12);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(100);
    });

    it('formats large percentage gains with K suffix', () => {
      const result = calculatePnL(1, 150);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(14900);
      expect(pnl.formattedGain).toBe('+14.9K%');
    });
  });

  describe('boundary conditions', () => {
    it('handles minimum valid entry price', () => {
      const result = calculatePnL(1e-20, 2e-20);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(100);
    });

    it('handles maximum valid price', () => {
      const result = calculatePnL(1e15, 1.5e15);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(50);
    });

    it('handles fractional percentage changes', () => {
      const result = calculatePnL(100, 100.5);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(0.5);
      expect(pnl.formattedGain).toBe('+0.5000%');
    });

    it('handles very small percentage changes', () => {
      const result = calculatePnL(100, 100.001);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBeCloseTo(0.001, 4);
    });
  });

  describe('error conditions', () => {
    it('rejects zero entry price', () => {
      const result = calculatePnL(0, 100);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.message).toBe('Entry price must be greater than zero');
      }
    });

    it('rejects negative entry price', () => {
      const result = calculatePnL(-100, 100);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.message).toBe('Entry price must be greater than zero');
      }
    });

    it('rejects negative current price', () => {
      const result = calculatePnL(100, -50);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.message).toBe('Current price cannot be negative');
      }
    });

    it('allows zero current price (100% loss)', () => {
      const result = calculatePnL(100, 0);
      expect('error' in result).toBe(false);
    });
  });

  describe('precision and rounding', () => {
    it('rounds large values to integers', () => {
      const result = calculatePnL(1, 11.111);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(1011); // Rounded to integer
    });

    it('maintains 2 decimal precision for medium values', () => {
      const result = calculatePnL(100, 133.333);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(33.33);
    });

    it('maintains 4 decimal precision for tiny values', () => {
      const result = calculatePnL(100, 100.001234);
      expect('error' in result).toBe(false);
      const pnl = result as PnLResult;
      expect(pnl.percentageGain).toBe(0.0012);
    });
  });
});

describe('formatTokenPrice', () => {
  describe('standard prices', () => {
    it('formats whole dollar amounts', () => {
      expect(formatTokenPrice(100)).toBe('$100.00');
      expect(formatTokenPrice(1)).toBe('$1.00');
      expect(formatTokenPrice(99.99)).toBe('$99.99');
    });

    it('formats cents', () => {
      // formatTokenPrice uses toFixed(4) for prices >= 0.01 and < 1
      expect(formatTokenPrice(0.5)).toBe('$0.5000');
      expect(formatTokenPrice(0.01)).toBe('$0.0100');
      expect(formatTokenPrice(0.99)).toBe('$0.9900');
    });

    it('formats thousands with locale formatting', () => {
      const result = formatTokenPrice(1234.56);
      // toLocaleString may use comma or space depending on locale
      expect(result).toMatch(/\$1[,\s]?234/);
    });

    it('formats millions with M suffix', () => {
      expect(formatTokenPrice(1000000)).toBe('$1.00M');
      expect(formatTokenPrice(5500000)).toBe('$5.50M');
    });
  });

  describe('meme coin prices (tiny decimals)', () => {
    it('formats tiny prices with subscript notation', () => {
      const result = formatTokenPrice(0.0000024);
      // Regex captures up to 4 significant digits after leading zeros
      expect(result).toBe('$0.0{5}2400');
    });

    it('formats very tiny prices', () => {
      const result = formatTokenPrice(0.00000001);
      expect(result).toBe('$0.0{7}1000');
    });

    it('formats medium-tiny prices with standard decimals', () => {
      expect(formatTokenPrice(0.00001)).toBe('$0.000010');
      expect(formatTokenPrice(0.0001)).toBe('$0.000100');
    });

    it('handles prices just above the subscript threshold', () => {
      expect(formatTokenPrice(0.000012)).toBe('$0.000012');
    });

    it('handles prices just below the subscript threshold', () => {
      // 0.000009 < 0.00001 so uses subscript notation
      const result = formatTokenPrice(0.000009);
      expect(result).toBe('$0.0{5}9000');
    });
  });

  describe('boundary conditions', () => {
    it('returns $0 for zero price', () => {
      expect(formatTokenPrice(0)).toBe('$0');
    });

    it('returns $0 for negative price', () => {
      expect(formatTokenPrice(-100)).toBe('$0');
    });

    it('handles extremely small prices with exponential', () => {
      const result = formatTokenPrice(1e-25);
      expect(result).toMatch(/\$\d\.\d+e-\d+/);
    });

    it('formats billion-dollar prices', () => {
      const result = formatTokenPrice(1000000000);
      expect(result).toBe('$1000.00M');
    });
  });

  describe('precision edge cases', () => {
    it('handles floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      // formatTokenPrice uses toFixed(4) for prices >= 0.01 and < 1
      const result = formatTokenPrice(0.1 + 0.2);
      expect(result).toBe('$0.3000');
    });

    it('handles price at exact threshold boundaries', () => {
      // toLocaleString may use space or comma depending on locale
      expect(formatTokenPrice(1000)).toMatch(/\$1[,\s]?000/);
      expect(formatTokenPrice(999.99)).toBe('$999.99');
    });
  });
});
