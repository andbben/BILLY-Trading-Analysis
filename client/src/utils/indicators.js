import { FALLBACK_PRICES, STOCKS_BASE } from '../data/market';

export function calcEMA(data, period) {
  if (!Array.isArray(data) || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const out = [ema];

  for (let i = period; i < data.length; i += 1) {
    ema = data[i] * k + ema * (1 - k);
    out.push(ema);
  }

  return out;
}

export function calcRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcMACD(closes) {
  if (!Array.isArray(closes) || closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (!ema12 || !ema26) return null;

  const offset = 14;
  const macdLine = ema26.map((_, index) => ema12[index + offset] - ema26[index]);
  const signalLine = calcEMA(macdLine, 9);
  if (!signalLine) return null;

  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

export function calcSMA(closes, period) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function classifySentiment(headline = '', summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();
  const bull = ['surge', 'jump', 'rally', 'gain', 'beat', 'record', 'growth', 'profit', 'rise', 'boost', 'strong', 'positive', 'bullish', 'upgrade', 'soar'];
  const bear = ['fall', 'drop', 'decline', 'miss', 'loss', 'down', 'weak', 'negative', 'bearish', 'cut', 'crash', 'fear', 'concern', 'risk', 'disappoint', 'slump'];
  const bullHits = bull.filter((word) => text.includes(word)).length;
  const bearHits = bear.filter((word) => text.includes(word)).length;

  if (bullHits > bearHits) return { sentiment: 'bull', score: Math.min(10, 6 + bullHits * 0.8) };
  if (bearHits > bullHits) return { sentiment: 'bear', score: Math.max(0, 4 - bearHits * 0.8) };
  return { sentiment: 'neu', score: 5 };
}

export function generateSignal(closes, curPrice, prevClose) {
  if (!Array.isArray(closes) || closes.length < 55) {
    const dailyMove = prevClose ? ((curPrice - prevClose) / prevClose) * 100 : 0;
    return {
      signal: dailyMove > 1 ? 'BUY' : dailyMove < -1 ? 'SELL' : 'HOLD',
      conf: 55,
      factors: ['Limited historical data available', `Daily move ${dailyMove.toFixed(2)}%`],
    };
  }

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  let score = 0;
  const factors = [];

  if (rsi != null) {
    if (rsi < 30) {
      score += 1;
      factors.push('RSI is oversold');
    } else if (rsi > 70) {
      score -= 1;
      factors.push('RSI is overbought');
    } else {
      factors.push('RSI is neutral');
    }
  }

  if (macd) {
    if (macd.histogram > 0) {
      score += 1;
      factors.push('MACD momentum is positive');
    } else {
      score -= 1;
      factors.push('MACD momentum is negative');
    }
  }

  if (curPrice && sma20) {
    score += curPrice > sma20 ? 1 : -1;
    factors.push(curPrice > sma20 ? 'Price is above SMA 20' : 'Price is below SMA 20');
  }

  if (curPrice && sma50) {
    score += curPrice > sma50 ? 1 : -1;
    factors.push(curPrice > sma50 ? 'Price is above SMA 50' : 'Price is below SMA 50');
  }

  const signal = score >= 2 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD';
  const conf = Math.min(91, Math.max(50, 60 + Math.abs(score) * 7));
  return { signal, conf, rsi, macd, sma20, sma50, factors };
}

export function computeRiskScore(rows) {
  const totalValue = rows.reduce((sum, row) => sum + row.val, 0);
  if (!totalValue) return 0;

  const maxWeight = Math.max(...rows.map((row) => row.val / totalValue));
  const sectorCount = new Set(rows.map((row) => STOCKS_BASE[row.ticker]?.sector).filter(Boolean)).size;
  const weightedBeta = rows.reduce((sum, row) => {
    const beta = STOCKS_BASE[row.ticker]?.beta || 1.1;
    return sum + beta * (row.val / totalValue);
  }, 0);

  let score = 20;
  score += Math.max(0, maxWeight - 0.25) * 110;
  score += Math.max(0, weightedBeta - 1) * 24;
  score += Math.max(0, 4 - sectorCount) * 7;
  return Math.min(95, Math.round(score));
}

export function genSyntheticCandles(ticker, endPrice = FALLBACK_PRICES[ticker] || 100, days = 252) {
  let seed = ticker.split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 7);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const prices = [];
  let price = endPrice * (0.78 + random() * 0.3);
  for (let i = 0; i < days; i += 1) {
    const pull = ((endPrice - price) / endPrice) * 0.08;
    const noise = (random() - 0.49) * 0.025;
    price = Math.max(1, price * (1 + pull + noise));
    prices.push(Number(price.toFixed(2)));
  }

  prices[prices.length - 1] = endPrice;
  return prices;
}
