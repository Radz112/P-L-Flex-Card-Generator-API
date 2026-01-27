export interface PnLResult {
  percentageGain: number;
  isProfit: boolean;
  formattedGain: string;
}

export interface PnLError {
  error: true;
  message: string;
}

export type PnLCalculation = PnLResult | PnLError;

export function calculatePnL(entryPrice: number, currentPrice: number): PnLCalculation {
  if (entryPrice <= 0) return { error: true, message: 'Entry price must be > 0' };
  if (currentPrice < 0) return { error: true, message: 'Current price cannot be negative' };

  const pct = ((currentPrice - entryPrice) / entryPrice) * 100;
  return {
    percentageGain: roundPrecision(pct),
    isProfit: pct >= 0,
    formattedGain: formatPct(pct)
  };
}

function roundPrecision(v: number): number {
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v);
  if (abs >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 10000) / 10000;
}

function formatPct(pct: number): string {
  const prefix = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  if (abs >= 1000000) return `${prefix}${(pct / 1000000).toFixed(1)}M%`;
  if (abs >= 10000) return `${prefix}${(pct / 1000).toFixed(1)}K%`;
  if (abs >= 1000) return `${prefix}${Math.round(pct).toLocaleString()}%`;
  if (abs >= 10) return `${prefix}${pct.toFixed(1)}%`;
  if (abs >= 1) return `${prefix}${pct.toFixed(2)}%`;
  return `${prefix}${pct.toFixed(4)}%`;
}

export function formatTokenPrice(price: number): string {
  if (price <= 0) return '$0';

  // Meme coin format: $0.0{5}2400
  if (price < 0.00001) {
    const match = price.toFixed(20).match(/0\.(0*)([1-9]\d{0,3})/);
    if (match) return `$0.0{${match[1].length}}${match[2]}`;
  }

  if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.00001) return `$${price.toFixed(6)}`;
  return `$${price.toExponential(2)}`;
}
