// Input Sanitization Tests - Security edge cases
import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeTicker } from '../src/utils/errorHandler';

describe('sanitizeString', () => {
  describe('basic functionality', () => {
    it('returns string unchanged if valid', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
    });

    it('trims whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('respects max length', () => {
      expect(sanitizeString('abcdefghij', 5)).toBe('abcde');
    });

    it('uses default max length of 100', () => {
      const long = 'a'.repeat(150);
      expect(sanitizeString(long).length).toBe(100);
    });
  });

  describe('control character removal', () => {
    it('removes null bytes', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
    });

    it('removes ASCII control characters (0x00-0x1F)', () => {
      const input = 'a\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1Fb';
      expect(sanitizeString(input)).toBe('ab');
    });

    it('removes DEL character (0x7F)', () => {
      expect(sanitizeString('hello\x7Fworld')).toBe('helloworld');
    });

    it('preserves newlines and tabs after filtering', () => {
      // Actually \n (0x0A) and \t (0x09) are in 0x00-0x1F range
      expect(sanitizeString('hello\tworld')).toBe('helloworld');
      expect(sanitizeString('hello\nworld')).toBe('helloworld');
    });
  });

  describe('HTML/XSS prevention', () => {
    it('removes angle brackets', () => {
      expect(sanitizeString('<script>')).toBe('script');
      expect(sanitizeString('hello<world>test')).toBe('helloworldtest');
    });

    it('removes script tags', () => {
      expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });

    it('removes img onerror payloads', () => {
      expect(sanitizeString('<img onerror=alert(1)>')).toBe('img onerror=alert(1)');
    });

    it('removes nested tags', () => {
      expect(sanitizeString('<<script>>')).toBe('script');
    });

    it('handles encoded brackets', () => {
      // URL encoded brackets should pass through (they're not actual brackets)
      expect(sanitizeString('%3Cscript%3E')).toBe('%3Cscript%3E');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for non-string input', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString({} as any)).toBe('');
    });

    it('handles empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('handles string of only whitespace', () => {
      expect(sanitizeString('   ')).toBe('');
    });

    it('handles string of only control characters', () => {
      expect(sanitizeString('\x00\x01\x02')).toBe('');
    });

    it('preserves unicode characters', () => {
      expect(sanitizeString('hello 世界 🚀')).toBe('hello 世界 🚀');
    });

    it('preserves special but safe characters', () => {
      expect(sanitizeString('hello@world.com')).toBe('hello@world.com');
      expect(sanitizeString('user#123')).toBe('user#123');
      expect(sanitizeString('50%+10%')).toBe('50%+10%');
    });
  });

  describe('length edge cases', () => {
    it('handles maxLength of 0', () => {
      expect(sanitizeString('hello', 0)).toBe('');
    });

    it('handles maxLength of 1', () => {
      expect(sanitizeString('hello', 1)).toBe('h');
    });

    it('handles string shorter than maxLength', () => {
      expect(sanitizeString('hi', 100)).toBe('hi');
    });

    it('handles exact length match', () => {
      expect(sanitizeString('hello', 5)).toBe('hello');
    });
  });
});

describe('sanitizeTicker', () => {
  describe('basic functionality', () => {
    it('converts to uppercase', () => {
      expect(sanitizeTicker('btc')).toBe('BTC');
      expect(sanitizeTicker('Bitcoin')).toBe('BITCOIN');
    });

    it('allows alphanumeric characters', () => {
      expect(sanitizeTicker('BTC123')).toBe('BTC123');
      expect(sanitizeTicker('X2Y2')).toBe('X2Y2');
    });

    it('allows $ symbol', () => {
      expect(sanitizeTicker('$BTC')).toBe('$BTC');
      expect(sanitizeTicker('BTC$')).toBe('BTC$');
    });

    it('limits to 20 characters', () => {
      const long = 'A'.repeat(25);
      expect(sanitizeTicker(long).length).toBe(20);
    });
  });

  describe('character filtering', () => {
    it('removes spaces', () => {
      expect(sanitizeTicker('BIT COIN')).toBe('BITCOIN');
    });

    it('removes special characters except $', () => {
      expect(sanitizeTicker('BTC!')).toBe('BTC');
      expect(sanitizeTicker('ETH@2')).toBe('ETH2');
      expect(sanitizeTicker('SOL#1')).toBe('SOL1');
      expect(sanitizeTicker('DOT%')).toBe('DOT');
    });

    it('removes dashes and underscores', () => {
      expect(sanitizeTicker('BTC-USD')).toBe('BTCUSD');
      expect(sanitizeTicker('ETH_USDT')).toBe('ETHUSDT');
    });

    it('removes parentheses and brackets', () => {
      expect(sanitizeTicker('BTC(USD)')).toBe('BTCUSD');
      expect(sanitizeTicker('ETH[V2]')).toBe('ETHV2');
    });
  });

  describe('XSS/injection prevention', () => {
    it('removes script tags', () => {
      expect(sanitizeTicker('<script>alert(1)</script>')).toBe('SCRIPTALERT1SCRIPT');
    });

    it('removes HTML entities', () => {
      expect(sanitizeTicker('BTC&amp;ETH')).toBe('BTCAMPETH');
    });

    it('removes angle brackets completely', () => {
      expect(sanitizeTicker('<BTC>')).toBe('BTC');
    });

    it('handles complex injection attempts', () => {
      expect(sanitizeTicker('"><img src=x onerror=alert(1)>')).toBe('IMGSRCXONERRORALERT1');
    });
  });

  describe('unicode handling', () => {
    it('removes unicode characters', () => {
      expect(sanitizeTicker('BTC🚀')).toBe('BTC');
      expect(sanitizeTicker('币安')).toBe('');
    });

    it('removes accented characters', () => {
      expect(sanitizeTicker('BÎTçoin')).toBe('BTOIN');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for non-string input', () => {
      expect(sanitizeTicker(null as any)).toBe('');
      expect(sanitizeTicker(undefined as any)).toBe('');
      expect(sanitizeTicker(123 as any)).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeTicker('')).toBe('');
    });

    it('returns empty string for only invalid characters', () => {
      expect(sanitizeTicker('!@#%^&*()')).toBe('');
    });

    it('handles mixed valid and invalid', () => {
      expect(sanitizeTicker('!B@T#C$')).toBe('BTC$');
    });
  });

  describe('real-world ticker examples', () => {
    it('handles common crypto tickers', () => {
      expect(sanitizeTicker('BTC')).toBe('BTC');
      expect(sanitizeTicker('ETH')).toBe('ETH');
      expect(sanitizeTicker('USDT')).toBe('USDT');
      expect(sanitizeTicker('BNB')).toBe('BNB');
      expect(sanitizeTicker('SOL')).toBe('SOL');
      expect(sanitizeTicker('DOGE')).toBe('DOGE');
    });

    it('handles meme coin tickers', () => {
      expect(sanitizeTicker('PEPE')).toBe('PEPE');
      expect(sanitizeTicker('SHIB')).toBe('SHIB');
      expect(sanitizeTicker('WOJAK')).toBe('WOJAK');
      expect(sanitizeTicker('BONK')).toBe('BONK');
    });

    it('handles tickers with numbers', () => {
      expect(sanitizeTicker('1INCH')).toBe('1INCH');
      expect(sanitizeTicker('C98')).toBe('C98');
      expect(sanitizeTicker('GRT')).toBe('GRT');
    });

    it('handles wrapped token format', () => {
      expect(sanitizeTicker('WBTC')).toBe('WBTC');
      expect(sanitizeTicker('WETH')).toBe('WETH');
      expect(sanitizeTicker('stETH')).toBe('STETH');
    });
  });
});
