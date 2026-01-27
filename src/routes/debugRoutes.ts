import { Router, Request, Response } from 'express';
import { createCanvas } from 'canvas';
import { calculatePnL, formatTokenPrice } from '../utils/pnlCalculator';
import { renderCard, Theme, CardData } from '../services/cardRenderer';

const router = Router();

router.get('/canvas-test', (req: Request, res: Response) => {
  try {
    const canvas = createCanvas(400, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = '#00ff88'; ctx.font = 'bold 32px Roboto'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Canvas OK', 200, 100);

    if (req.query.format === 'image') res.set('Content-Type', 'image/png').send(canvas.toBuffer('image/png'));
    else res.json({ success: true, image: canvas.toDataURL('image/png') });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown' });
  }
});

router.get('/pnl-test', (_req: Request, res: Response) => {
  const tests = [
    [0.0000024, 0.0000120, 'Meme 5x'], [0.10, 0.05, '50% loss'], [100, 150, '50% gain'],
    [0.00000001, 0.0001, '10000x'], [50000, 25000, 'BTC drop']
  ].map(([entry, current, desc]) => ({
    desc, entry, current,
    entryFmt: formatTokenPrice(entry as number),
    currentFmt: formatTokenPrice(current as number),
    result: calculatePnL(entry as number, current as number)
  }));
  res.json({ tests });
});

function testCard(profit: boolean): CardData {
  const [entry, current] = profit ? [0.0000024, 0.0000120] : [0.10, 0.05];
  const pnl = calculatePnL(entry, current);
  if ('error' in pnl) throw new Error(pnl.message);
  return {
    tokenSymbol: profit ? 'PEPE' : 'WOJAK', entryPrice: entry, currentPrice: current, pnl,
    walletTag: '0x1234...abcd',
    timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
}

const themeHandler = (theme: Theme) => (req: Request, res: Response) => {
  try {
    const data = testCard(req.query.loss !== 'true');
    const buf = renderCard(data, theme);
    if (req.query.format === 'json') res.json({ theme, image: `data:image/png;base64,${buf.toString('base64')}` });
    else res.set('Content-Type', 'image/png').send(buf);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown' });
  }
};

router.get('/render-dark', themeHandler('dark'));
router.get('/render-light', themeHandler('light'));
router.get('/render-degen', themeHandler('degen'));

export default router;
