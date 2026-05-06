import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../../data/market';
import { api } from '../../services/api';
import { fmt, fmtPct, fmtPrice, timeAgo } from '../../utils/formatters';
import { genSyntheticCandles } from '../../utils/indicators';
import LineChart from '../charts/LineChart';

const emptyForm = {
  kind: 'price',
  condition: 'above',
  target: '',
  technical: 'RSI > 70',
  news: 'Negative sentiment < 4.0',
};

export default function AlertComposer({
  marketData,
  initialTicker = '',
  onClose,
  onCreated,
}) {
  const [query, setQuery] = useState('');
  const [ticker, setTicker] = useState(initialTicker);
  const [form, setForm] = useState(emptyForm);
  const [chartData, setChartData] = useState(null);
  const [stockNews, setStockNews] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;
  const info = ticker ? STOCKS_BASE[ticker] : null;
  const quote = ticker ? quotes[ticker] || {} : {};
  const profileSeed = ticker ? ticker.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) : 0;
  const peRatio = ticker ? 14 + (profileSeed % 28) + ((quote.dp || 0) / 10) : 0;

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return Object.entries(STOCKS_BASE)
      .filter(([symbol, stock]) => symbol.toLowerCase().includes(term) || stock.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [query]);

  useEffect(() => {
    if (!ticker) return undefined;
    let cancelled = false;
    setChartData(null);
    fetchStockCandles(ticker, '3M').then((data) => {
      if (!cancelled) setChartData(data?.c?.length ? data.c : genSyntheticCandles(ticker, quote.c || 100, 90));
    });
    fetchCompanyNews(ticker).then((items) => {
      if (!cancelled) setStockNews((items || []).slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCompanyNews, fetchStockCandles, quote.c, ticker]);

  const selectTicker = (symbol) => {
    setTicker(symbol);
    setQuery('');
    setError('');
  };

  const createAlert = async () => {
    if (!ticker) {
      setError('Select a stock before creating an alert.');
      return;
    }
    if (form.kind === 'price' && !form.target) {
      setError('Price alerts need a target price.');
      return;
    }

    const condition = form.kind === 'price' ? form.condition : form.kind === 'technical' ? form.technical : form.news;
    setSubmitting(true);
    setError('');
    try {
      await api.createAlert({
        ticker,
        alert_kind: form.kind,
        alert_type: form.condition,
        condition,
        price_target: form.kind === 'price' ? Number(form.target) : null,
      });
      setForm(emptyForm);
      await onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create alert.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal alert-composer" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="section-eyebrow">Alert center</span>
            <h2>{ticker ? `Create alert for ${ticker}` : 'Find a stock'}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
        </header>

        <div className="alert-search-shell">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticker or company name" />
          {results.length > 0 && (
            <div className="alert-search-results">
              {results.map(([symbol, stock]) => (
                <button type="button" key={symbol} onClick={() => selectTicker(symbol)}>
                  <span className="ticker-logo" style={{ background: stock.color }}>{symbol.slice(0, 2)}</span>
                  <span><strong>{symbol}</strong><small>{stock.name}</small></span>
                  <em>{fmtPrice(quotes[symbol]?.c)}</em>
                </button>
              ))}
            </div>
          )}
        </div>

        {info && (
          <>
            <section className="alert-asset-overview">
              <div className="ticker-cell">
                <span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span>
                <span><strong>{ticker}</strong><small>{info.name}</small></span>
              </div>
              <div className="alert-mini-metrics">
                <span>Last <strong>{fmtPrice(quote.c)}</strong></span>
                <span>Change <strong className={(quote.dp || 0) >= 0 ? 'pos' : 'neg'}>{fmtPct(quote.dp || 0)}</strong></span>
                <span>Last close <strong>{fmtPrice(quote.pc)}</strong></span>
                <span>P/E <strong>{fmt(peRatio, 2)}</strong></span>
              </div>
              <LineChart data={chartData} color={(quote.dp || 0) >= 0 ? '#00c2a8' : '#ff4f7b'} height={170} />
            </section>

            <section className="stock-trade-panel alert-options-panel">
              <header className="panel-header">
                <div>
                  <h2>Alert options</h2>
                  <p>Choose how Billy should watch this asset.</p>
                </div>
              </header>
              <div className="trade-controls-grid">
                <label className="form-field">
                  <span>Alert type</span>
                  <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                    <option value="price">Price</option>
                    <option value="technical">Technical</option>
                    <option value="news">News sentiment</option>
                  </select>
                </label>
                {form.kind === 'price' && (
                  <>
                    <label className="form-field">
                      <span>Condition</span>
                      <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
                        <option value="above">Price goes above</option>
                        <option value="below">Price goes below</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Target price</span>
                      <input type="number" step="0.01" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
                    </label>
                  </>
                )}
                {form.kind === 'technical' && (
                  <label className="form-field">
                    <span>Indicator trigger</span>
                    <select value={form.technical} onChange={(event) => setForm({ ...form, technical: event.target.value })}>
                      <option>{'RSI > 70'}</option>
                      <option>{'RSI < 30'}</option>
                      <option>MACD bullish crossover</option>
                      <option>MACD bearish crossover</option>
                      <option>Price crosses above SMA 50</option>
                      <option>Price crosses below SMA 50</option>
                    </select>
                  </label>
                )}
                {form.kind === 'news' && (
                  <label className="form-field">
                    <span>News condition</span>
                    <select value={form.news} onChange={(event) => setForm({ ...form, news: event.target.value })}>
                      <option>{'Negative sentiment < 4.0'}</option>
                      <option>{'Positive sentiment > 7.0'}</option>
                      <option>Any high-impact news</option>
                      <option>Earnings report published</option>
                    </select>
                  </label>
                )}
              </div>
              {error && <p className="status error">{error}</p>}
              <button type="button" disabled={submitting} onClick={createAlert}>{submitting ? 'Creating...' : 'Create alert'}</button>
            </section>

            <section className="modal-news">
              <span className="section-eyebrow">Recent articles</span>
              {stockNews.map((item) => (
                <article key={`${item.headline || item.title}-${item.datetime}`}>
                  <div><span>{item.source || 'News'}</span><span>{timeAgo(item.datetime)}</span></div>
                  <strong>{item.headline || item.title}</strong>
                </article>
              ))}
              {!stockNews.length && <div className="empty-state">No recent related articles loaded yet.</div>}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
