import { Router, Request, Response } from 'express';
import { calculatePnL } from '../utils/pnlCalculator';
import { renderCard, Theme, CardData } from '../services/cardRenderer';
import { sanitizeString, sanitizeTicker } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const THEMES: Theme[] = ['dark', 'light', 'degen'];
const MAX_PRICE = 1e15, MIN_PRICE = 1e-20;

interface CardRequest {
  ticker: string;
  entry_price: number;
  current_price: number;
  theme?: Theme;
  wallet_tag?: string;
  timestamp?: string;
}

interface RawBody {
  ticker?: unknown;
  entry_price?: unknown;
  current_price?: unknown;
  theme?: unknown;
  wallet_tag?: unknown;
  timestamp?: unknown;
  body?: RawBody;
}

function extractBody(body: RawBody): CardRequest {
  const d = body?.body && typeof body.body === 'object' ? body.body : body;
  return {
    ticker: d?.ticker as string,
    entry_price: d?.entry_price as number,
    current_price: d?.current_price as number,
    theme: d?.theme as Theme | undefined,
    wallet_tag: d?.wallet_tag as string | undefined,
    timestamp: d?.timestamp as string | undefined
  };
}

function validate(b: CardRequest): string[] {
  const e: string[] = [];
  if (!b.ticker || typeof b.ticker !== 'string' || !b.ticker.trim()) e.push('ticker required');
  else if (!sanitizeTicker(b.ticker)) e.push('ticker must contain A-Z, 0-9, or $');

  if (b.entry_price == null) e.push('entry_price required');
  else if (typeof b.entry_price !== 'number' || !isFinite(b.entry_price)) e.push('entry_price must be number');
  else if (b.entry_price <= 0) e.push('entry_price must be > 0');
  else if (b.entry_price < MIN_PRICE || b.entry_price > MAX_PRICE) e.push('entry_price out of range');

  if (b.current_price == null) e.push('current_price required');
  else if (typeof b.current_price !== 'number' || !isFinite(b.current_price)) e.push('current_price must be number');
  else if (b.current_price < 0) e.push('current_price cannot be negative');
  else if (b.current_price > MAX_PRICE) e.push('current_price out of range');

  if (b.theme && !THEMES.includes(b.theme)) e.push(`theme must be: ${THEMES.join(', ')}`);
  if (b.wallet_tag && (typeof b.wallet_tag !== 'string' || b.wallet_tag.length > 50)) e.push('wallet_tag invalid');
  if (b.timestamp && (typeof b.timestamp !== 'string' || b.timestamp.length > 100)) e.push('timestamp invalid');
  return e;
}

router.get('/generate-card', (_req: Request, res: Response) => {
  res.json({
    endpoint: '/api/v1/generate-card',
    method: 'POST',
    params: {
      ticker: 'string, required',
      entry_price: 'number, required',
      current_price: 'number, required',
      theme: `optional: ${THEMES.join('|')}`,
      wallet_tag: 'optional string',
      timestamp: 'optional string'
    },
    price: '$0.02'
  });
});

router.post('/generate-card', (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const body = extractBody(req.body);
    const errors = validate(body);
    if (errors.length) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors });
      return;
    }

    const pnl = calculatePnL(body.entry_price, body.current_price);
    if ('error' in pnl) {
      res.status(400).json({ success: false, error: pnl.message });
      return;
    }

    const theme: Theme = body.theme || 'dark';
    const cardData: CardData = {
      tokenSymbol: sanitizeTicker(body.ticker),
      entryPrice: body.entry_price,
      currentPrice: body.current_price,
      pnl,
      walletTag: body.wallet_tag ? sanitizeString(body.wallet_tag, 50) : undefined,
      timestamp: body.timestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    };

    const buffer = renderCard(cardData, theme);
    logger.info(`Card: ${cardData.tokenSymbol} ${pnl.formattedGain} [${Date.now() - start}ms]`);

    res.json({
      success: true,
      image: `data:image/png;base64,${buffer.toString('base64')}`,
      metadata: { ticker: cardData.tokenSymbol, gain: pnl.percentageGain, formatted: pnl.formattedGain, profit: pnl.isProfit, theme }
    });
  } catch (err) {
    logger.error('generate-card failed', err);
    res.status(500).json({ success: false, error: 'Failed to generate card' });
  }
});

export default router;
