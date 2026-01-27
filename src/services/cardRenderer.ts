import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { PnLResult, formatTokenPrice } from '../utils/pnlCalculator';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export type Theme = 'dark' | 'light' | 'degen';

export interface CardData {
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  pnl: PnLResult;
  walletTag?: string;
  timestamp?: string;
}

type Gradient = ReturnType<CanvasRenderingContext2D['createLinearGradient']>;

interface Colors {
  bg: string | Gradient;
  bgBox: string;
  text: string;
  textDim: string;
  profit: string;
  loss: string;
  border?: string;
}

function getColors(ctx: CanvasRenderingContext2D, theme: Theme): Colors {
  const grad = (y = true) => ctx.createLinearGradient(0, 0, y ? 0 : CARD_WIDTH, CARD_HEIGHT);

  if (theme === 'light') {
    const g = grad(); g.addColorStop(0, '#fff'); g.addColorStop(1, '#f0f0f5');
    return { bg: g, bgBox: '#e8e8f0', text: '#1a1a2e', textDim: '#666680', profit: '#00aa55', loss: '#dd3355', border: '#d0d0e0' };
  }
  if (theme === 'degen') {
    const g = grad(false); g.addColorStop(0, '#0a0015'); g.addColorStop(0.5, '#1a0030'); g.addColorStop(1, '#0f1a00');
    return { bg: g, bgBox: '#2a1050', text: '#fff', textDim: '#aa88ff', profit: '#0f0', loss: '#f06' };
  }
  const g = grad(); g.addColorStop(0, '#0d0d0d'); g.addColorStop(1, '#1a1a2e');
  return { bg: g, bgBox: '#252540', text: '#fff', textDim: '#888899', profit: '#00ff88', loss: '#f46' };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDegenEffects(ctx: CanvasRenderingContext2D) {
  // Scanlines
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#fff';
  for (let y = 0; y < CARD_HEIGHT; y += 4) ctx.fillRect(0, y, CARD_WIDTH, 1);

  // Corner accents
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#f0f';
  ctx.lineWidth = 3;
  const s = 100;
  [[0, s, 0, 0, s, 0], [CARD_WIDTH - s, 0, CARD_WIDTH, 0, CARD_WIDTH, s],
   [0, CARD_HEIGHT - s, 0, CARD_HEIGHT, s, CARD_HEIGHT], [CARD_WIDTH - s, CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT - s]
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

export function renderCard(data: CardData, theme: Theme): Buffer {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  const colors = getColors(ctx, theme);
  const pnlColor = data.pnl.isProfit ? colors.profit : colors.loss;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  if (theme === 'degen') drawDegenEffects(ctx);
  if (colors.border) { ctx.strokeStyle = colors.border; ctx.lineWidth = 2; ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2); }

  const pad = 60, cx = CARD_WIDTH / 2;

  // Header
  ctx.fillStyle = colors.text; ctx.font = 'bold 72px Roboto'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`$${data.tokenSymbol.toUpperCase()}`, pad, pad);
  ctx.fillStyle = colors.textDim; ctx.font = 'bold 28px Roboto'; ctx.textAlign = 'right';
  ctx.fillText('P&L CARD', CARD_WIDTH - pad, pad + 10);

  // Main percentage
  ctx.fillStyle = pnlColor; ctx.font = 'bold 140px Roboto'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(data.pnl.formattedGain, cx, 270);
  if (theme === 'degen') { ctx.shadowColor = pnlColor; ctx.shadowBlur = 30; ctx.fillText(data.pnl.formattedGain, cx, 270); ctx.shadowBlur = 0; }

  // Price boxes
  const boxW = 480, boxH = 100, boxY = 380, gap = 40;
  const entryX = cx - boxW - gap / 2, currX = cx + gap / 2;

  roundedRect(ctx, entryX, boxY, boxW, boxH, 16); ctx.fillStyle = colors.bgBox; ctx.fill();
  ctx.fillStyle = colors.textDim; ctx.font = 'bold 24px Roboto'; ctx.textBaseline = 'top';
  ctx.fillText('ENTRY', entryX + boxW / 2, boxY + 15);
  ctx.fillStyle = colors.text; ctx.font = 'bold 36px Roboto';
  ctx.fillText(formatTokenPrice(data.entryPrice), entryX + boxW / 2, boxY + 50);

  roundedRect(ctx, currX, boxY, boxW, boxH, 16); ctx.fillStyle = colors.bgBox; ctx.fill();
  ctx.fillStyle = colors.textDim; ctx.font = 'bold 24px Roboto';
  ctx.fillText('CURRENT', currX + boxW / 2, boxY + 15);
  ctx.fillStyle = pnlColor; ctx.font = 'bold 36px Roboto';
  ctx.fillText(formatTokenPrice(data.currentPrice), currX + boxW / 2, boxY + 50);

  ctx.fillStyle = colors.textDim; ctx.font = 'bold 40px Roboto'; ctx.textBaseline = 'middle';
  ctx.fillText('→', cx, boxY + boxH / 2);

  // Footer
  const footerY = CARD_HEIGHT - pad - 10;
  ctx.font = 'bold 24px Roboto'; ctx.textBaseline = 'bottom';
  if (data.walletTag) { ctx.fillStyle = colors.textDim; ctx.textAlign = 'left'; ctx.fillText(data.walletTag, pad, footerY); }
  if (data.timestamp) { ctx.fillStyle = colors.textDim; ctx.font = '22px Roboto'; ctx.textAlign = 'center'; ctx.fillText(data.timestamp, cx, footerY); }
  ctx.fillStyle = colors.textDim; ctx.font = 'bold 20px Roboto'; ctx.textAlign = 'right'; ctx.globalAlpha = 0.6;
  ctx.fillText('FLEX CARD', CARD_WIDTH - pad, footerY); ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png', { compressionLevel: 6 });
}
