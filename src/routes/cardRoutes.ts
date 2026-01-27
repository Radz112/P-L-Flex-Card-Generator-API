// P&L Flex Card Generator API Routes - APIX402 Pricing: $0.02 per call
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

function extractBody(body: any): CardRequest {
  const d = body?.body && typeof body.body === 'object' ? body.body : body;
  return { ticker: d.ticker, entry_price: d.entry_price, current_price: d.current_price, theme: d.theme, wallet_tag: d.wallet_tag, timestamp: d.timestamp };
}

function validate(b: CardRequest): string[] {
  const e: string[] = [];
  if (!b.ticker || typeof b.ticker !== 'string' || !b.ticker.trim()) e.push('ticker is required');
  else if (b.ticker.length > 20) e.push('ticker must be 20 characters or less');

  if (b.entry_price == null) e.push('entry_price is required');
  else if (typeof b.entry_price !== 'number' || !isFinite(b.entry_price)) e.push('entry_price must be a valid number');
  else if (b.entry_price <= 0) e.push('entry_price must be greater than zero');
  else if (b.entry_price < MIN_PRICE || b.entry_price > MAX_PRICE) e.push('entry_price out of range');

  if (b.current_price == null) e.push('current_price is required');
  else if (typeof b.current_price !== 'number' || !isFinite(b.current_price)) e.push('current_price must be a valid number');
  else if (b.current_price < 0) e.push('current_price cannot be negative');
  else if (b.current_price > MAX_PRICE) e.push('current_price out of range');

  if (b.theme != null && !THEMES.includes(b.theme as Theme)) e.push(`theme must be: ${THEMES.join(', ')}`);
  if (b.wallet_tag != null && (typeof b.wallet_tag !== 'string' || b.wallet_tag.length > 50)) e.push('wallet_tag invalid');
  if (b.timestamp != null && (typeof b.timestamp !== 'string' || b.timestamp.length > 100)) e.push('timestamp invalid');
  return e;
}

router.get('/generate-card', (_req: Request, res: Response) => {
  res.json({
    endpoint: '/api/v1/generate-card',
    method: 'POST',
    description: 'Generate P&L flex card image',
    parameters: {
      ticker: { type: 'string', required: true },
      entry_price: { type: 'number', required: true },
      current_price: { type: 'number', required: true },
      theme: { type: 'string', required: false, default: 'dark', options: THEMES },
      wallet_tag: { type: 'string', required: false },
      timestamp: { type: 'string', required: false }
    },
    apix402: { price: '$0.02', category: 'image-generation' }
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
      timestamp: body.timestamp ? sanitizeString(body.timestamp, 100) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    const buffer = renderCard(cardData, theme);
    logger.info(`Card: ${cardData.tokenSymbol} ${pnl.formattedGain} [${Date.now() - start}ms]`);

    res.json({
      success: true,
      image: `data:image/png;base64,${buffer.toString('base64')}`,
      metadata: { ticker: cardData.tokenSymbol, gain_percentage: pnl.percentageGain, formatted_gain: pnl.formattedGain, is_profit: pnl.isProfit, theme }
    });
  } catch (err) {
    logger.error('generate-card failed', err);
    res.status(500).json({ success: false, error: 'Failed to generate card' });
  }
});

export default router;
