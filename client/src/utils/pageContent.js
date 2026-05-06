export const FEATURES = [
  { id: 'realtime', name: 'Real-Time Tracking', desc: 'Live quotes through server-side market routes, index cards, movers, and refreshed dashboard data.' },
  { id: 'signals', name: 'Signal Intelligence', desc: 'Rules-based RSI, MACD, SMA, and momentum signals with confidence explanations.' },
  { id: 'portfolio', name: 'Portfolio Analytics', desc: 'Buy and sell flow, live portfolio value, cash, allocation, gain/loss, and risk scoring.' },
  { id: 'alerts', name: 'Smart Alerts', desc: 'Price, technical, and news alert creation with active, paused, and triggered states.' },
  { id: 'news', name: 'News Sentiment', desc: 'Market news feed, ticker tags, keyword sentiment, and article analysis modal.' },
  { id: 'learn', name: 'Learn', desc: 'Expandable reference cards for the financial indicators used in the app.' },
];

export const LEARN_ITEMS_FULL = [
  {
    term: 'RSI - Relative Strength Index',
    def: 'A momentum oscillator that measures whether a stock is potentially overbought or oversold. It ranges from 0 to 100.',
    formula: 'RSI = 100 - 100 / (1 + RS)\nRS = Average Gain / Average Loss',
    tips: ['RSI below 30 can indicate oversold conditions.', 'RSI above 70 can indicate overbought conditions.', 'Use RSI with trend context rather than alone.'],
  },
  {
    term: 'MACD - Moving Average Convergence Divergence',
    def: 'A trend-following momentum indicator that compares short and long exponential moving averages.',
    formula: 'MACD Line = EMA(12) - EMA(26)\nSignal Line = EMA(9) of MACD',
    tips: ['MACD above signal is bullish momentum.', 'MACD below signal is bearish momentum.', 'Histogram expansion shows acceleration.'],
  },
  {
    term: 'SMA - Simple Moving Average',
    def: 'A moving average smooths price data to make trend direction easier to read.',
    formula: 'SMA(n) = Sum of last n closes / n',
    tips: ['Price above SMA 20 can support short-term bullish reads.', 'SMA 50 gives medium-term context.', 'Moving averages can act as support or resistance.'],
  },
  {
    term: 'Portfolio Beta',
    def: 'Beta estimates how much a holding or portfolio tends to move compared with the broader market.',
    formula: 'Portfolio Beta = Sum(Position Weight x Position Beta)',
    tips: ['Beta above 1 implies higher market sensitivity.', 'High-beta portfolios can swing more during selloffs.', 'Diversification can reduce concentration risk.'],
  },
  {
    term: 'Value at Risk',
    def: 'VaR estimates a possible loss threshold over a time period at a given confidence level.',
    formula: 'VaR(95%, 1 day) ~= 1.645 x Daily Volatility x Portfolio Value',
    tips: ['VaR is not a worst-case loss.', 'Use it with stress testing.', 'It is a risk lens, not a prediction.'],
  },
];
