export const STOCKS_BASE = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology', beta: 1.24, color: '#5f7cff' },
  MSFT: { name: 'Microsoft Corp.', sector: 'Technology', beta: 0.9, color: '#00a6ed' },
  NVDA: { name: 'NVIDIA Corp.', sector: 'Semiconductors', beta: 1.72, color: '#00e676' },
  TSLA: { name: 'Tesla Inc.', sector: 'Consumer Discretionary', beta: 2.28, color: '#ff3d71' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', beta: 1.16, color: '#ffb700' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services', beta: 1.05, color: '#00d4ff' },
  META: { name: 'Meta Platforms Inc.', sector: 'Communication Services', beta: 1.21, color: '#7c5cfc' },
  JPM: { name: 'JPMorgan Chase & Co.', sector: 'Financials', beta: 1.08, color: '#34d399' },
  AMD: { name: 'Advanced Micro Devices', sector: 'Semiconductors', beta: 1.66, color: '#ff7a45' },
  NFLX: { name: 'Netflix Inc.', sector: 'Communication Services', beta: 1.27, color: '#e11d48' },
};

export const INDEX_SYMS = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ',
  DIA: 'Dow Jones',
};

export const ALL_STOCK_SYMBOLS = Object.keys(STOCKS_BASE);
export const ALL_FETCH_SYMBOLS = [...ALL_STOCK_SYMBOLS, ...Object.keys(INDEX_SYMS)];

export const PORTFOLIO_COLORS = [
  '#00d4ff',
  '#00e676',
  '#ffb700',
  '#7c5cfc',
  '#ff3d71',
  '#00ffea',
  '#ff9900',
];

export const FALLBACK_PRICES = {
  AAPL: 213.49,
  MSFT: 415.22,
  NVDA: 875.4,
  TSLA: 174.9,
  AMZN: 189.34,
  GOOGL: 172.63,
  META: 517.8,
  JPM: 198.45,
  AMD: 158.72,
  NFLX: 641.3,
  SPY: 534.1,
  QQQ: 452.8,
  DIA: 397.5,
};

export const STARTER_HOLDINGS = [
  { ticker: 'AAPL', shares: 24, avgCost: 182.45 },
  { ticker: 'NVDA', shares: 8, avgCost: 721.3 },
  { ticker: 'MSFT', shares: 15, avgCost: 389.2 },
  { ticker: 'AMZN', shares: 12, avgCost: 171.8 },
];

export const PLANS = [
  {
    id: 'free',
    name: 'Starter',
    price: 0,
    color: '#00d4ff',
    features: ['Live dashboard', 'Basic watchlist', 'Price alerts'],
    locked: ['Advanced news analysis', 'Portfolio risk intelligence'],
  },
  {
    id: 'plus',
    name: 'Bronco Plus',
    price: 9,
    color: '#00e676',
    features: ['Unlimited watchlist', 'Technical alerts', 'News sentiment', 'Risk dashboard'],
    locked: ['Priority signal intelligence'],
  },
  {
    id: 'pro',
    name: 'Bronco Pro',
    price: 19,
    color: '#7c5cfc',
    features: ['Everything in Plus', 'AI news summaries', 'Advanced signals', 'Priority market refresh'],
  },
];

export const DEMO_NEWS = [
  {
    source: 'Market Desk',
    headline: 'Technology shares edge higher as chip demand remains resilient',
    summary: 'Large-cap technology names moved higher as investors focused on data center demand and earnings quality.',
    related: 'NVDA,AMD,MSFT',
    datetime: Math.floor(Date.now() / 1000) - 1800,
    url: 'https://finnhub.io',
  },
  {
    source: 'Equity Wire',
    headline: 'Consumer growth stocks mixed after cautious retail commentary',
    summary: 'Analysts highlighted divergent consumer trends, with online platforms holding up better than higher-ticket purchases.',
    related: 'AMZN,TSLA',
    datetime: Math.floor(Date.now() / 1000) - 5400,
    url: 'https://finnhub.io',
  },
  {
    source: 'Global Markets',
    headline: 'Major indexes hold steady while investors wait for rate guidance',
    summary: 'The broader market traded in a tight range as investors weighed earnings revisions and central bank expectations.',
    related: 'SPY,QQQ,DIA',
    datetime: Math.floor(Date.now() / 1000) - 8800,
    url: 'https://finnhub.io',
  },
];
