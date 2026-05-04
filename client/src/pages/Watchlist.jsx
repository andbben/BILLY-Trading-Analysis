import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { fmtPct, fmtPrice } from '../utils/formatters';
import Sparkline from '../components/charts/Sparkline';
import StockModal from '../components/modals/StockModal';

export default function Watchlist({ marketData }) {
  const [watchlist, setWatchlist] = useState([]);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const tickers = useMemo(
    () => watchlist.map((item) => (typeof item === 'string' ? item : item.ticker)).filter(Boolean),
    [watchlist],
  );

  const loadWatchlist = async () => {
    try {
      const data = await api.getWatchlist();
      setWatchlist(data.watchlist || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load watchlist.');
    }
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  const addTicker = async () => {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    if (!STOCKS_BASE[ticker]) {
      setError('That ticker is not in the current demo universe.');
      return;
    }
    try {
      await api.addToWatchlist(ticker);
      setInput('');
      await loadWatchlist();
    } catch (err) {
      setError(err.message || 'Failed to add ticker.');
    }
  };

  const removeTicker = async (ticker) => {
    try {
      await api.removeFromWatchlist(ticker);
      await loadWatchlist();
    } catch (err) {
      setError(err.message || 'Failed to remove ticker.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Watchlist</span>
          <h1>Track stocks you care about</h1>
          <p>{tickers.length} symbols - click any row for chart and indicators.</p>
        </div>
      </header>

      <section className="panel">
        <div className="inline-controls">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addTicker()}
            placeholder="Enter ticker, e.g. AAPL"
          />
          <button type="button" onClick={addTicker}>Add</button>
        </div>
        <p className="form-hint">Available: {Object.keys(STOCKS_BASE).join(', ')}</p>
        {error && <p className="status error">{error}</p>}
      </section>

      <section className="panel">
        <div className="data-table watch-table">
          <div className="table-head">
            <span>Symbol</span><span>Price</span><span>Change</span><span>Signal</span><span>Chart</span><span></span>
          </div>
          {tickers.map((ticker) => {
            const info = STOCKS_BASE[ticker];
            const quote = quotes[ticker] || {};
            const up = (quote.dp || 0) >= 0;
            const signal = (quote.dp || 0) > 2 ? 'BUY' : (quote.dp || 0) < -2 ? 'SELL' : 'HOLD';
            return (
              <button className="table-row" type="button" key={ticker} onClick={() => setSelected(ticker)}>
                <span className="ticker-cell">
                  <span className="ticker-logo" style={{ background: info?.color }}>{ticker.slice(0, 2)}</span>
                  <span><strong>{ticker}</strong><small>{info?.name}</small></span>
                </span>
                <span className="mono">{fmtPrice(quote.c)}</span>
                <span className={up ? 'pos mono' : 'neg mono'}>{fmtPct(quote.dp || 0)}</span>
                <span><i className={`badge badge-${signal.toLowerCase()}`}>{signal}</i></span>
                <Sparkline data={[quote.l || quote.c * 0.99, quote.o || quote.c, quote.h || quote.c * 1.01, quote.c].filter(Boolean)} color={up ? '#00e676' : '#ff3d71'} height={34} />
                <span className="row-actions">
                  <button className="icon-btn" type="button" onClick={(event) => { event.stopPropagation(); removeTicker(ticker); }}>x</button>
                </span>
              </button>
            );
          })}
          {!tickers.length && <div className="empty-state">Add stocks using the input above.</div>}
        </div>
      </section>

      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
