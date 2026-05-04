const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('bb_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const api = {
  // Auth
  register: (name, email, password) => request('POST', '/api/auth/register', { name, email, password }),
  login:    (email, password)        => request('POST', '/api/auth/login',    { email, password }),
  getProfile: ()                     => request('GET', '/api/users/profile'),
  updatePlan: (plan)                 => request('PATCH', '/api/users/plan', { plan }),

  // Portfolio
  getPortfolio:   ()                          => request('GET',    '/api/portfolio'),
  addPosition:    (ticker, shares, avg_cost)  => request('POST',   '/api/portfolio/positions', { ticker, shares, avg_cost }),
  deletePosition: (ticker)                    => request('DELETE',  `/api/portfolio/positions/${ticker}`),
  executeTrade:   (data)                      => request('POST',   '/api/portfolio/trades', data),

  // Watchlist
  getWatchlist:      ()       => request('GET',    '/api/watchlist'),
  addToWatchlist:    (ticker) => request('POST',   '/api/watchlist', { ticker }),
  removeFromWatchlist:(ticker) => request('DELETE', `/api/watchlist/${ticker}`),

  // Alerts
  getAlerts:    ()     => request('GET',    '/api/alerts'),
  createAlert:  (data) => request('POST',   '/api/alerts', data),
  deleteAlert:  (id)   => request('DELETE', `/api/alerts/${id}`),
  toggleAlert:  (id)   => request('PATCH',  `/api/alerts/${id}/toggle`),

  // Market data proxies
  getQuote:       (symbol)              => request('GET', `/api/market/quote/${symbol}`),
  getCandles:     (symbol, timeframe)   => request('GET', `/api/market/candles/${symbol}?timeframe=${encodeURIComponent(timeframe)}`),
  getMarketNews:  ()                    => request('GET', '/api/market/news'),
  getCompanyNews: (symbol)              => request('GET', `/api/market/company-news/${symbol}`),
  analyzeNews:    (article)             => request('POST', '/api/market/news/analyze', { article }),
};
