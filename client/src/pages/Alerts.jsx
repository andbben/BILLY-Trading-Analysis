import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { fmtPrice } from '../utils/formatters';

function normalizeAlert(alert, quotes) {
  const kind = alert.alert_kind || alert.type || 'price';
  const condition = alert.condition || alert.alert_type || 'above';
  const target = alert.price_target == null ? null : Number(alert.price_target);
  let status = alert.status || (alert.is_active ? 'active' : 'inactive');

  if (kind === 'price' && alert.is_active !== false && target != null) {
    const current = quotes[alert.ticker]?.c;
    if (current) status = condition === 'above' ? (current > target ? 'triggered' : 'active') : (current < target ? 'triggered' : 'active');
  }

  return { ...alert, kind, condition, target, status };
}

export default function Alerts({ marketData }) {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    ticker: 'AAPL',
    kind: 'price',
    condition: 'above',
    target: '',
    technical: 'RSI > 70',
    news: 'Negative sentiment < 4.0',
  });
  const [error, setError] = useState('');
  const { quotes } = marketData;

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data.alerts || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load alerts.');
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const processed = useMemo(() => alerts.map((alert) => normalizeAlert(alert, quotes)), [alerts, quotes]);
  const filtered = processed.filter((alert) => filter === 'all' || alert.kind === filter || alert.status === filter);

  const createAlert = async () => {
    const condition = form.kind === 'price' ? form.condition : form.kind === 'technical' ? form.technical : form.news;
    if (form.kind === 'price' && !form.target) {
      setError('Price alerts need a target price.');
      return;
    }

    try {
      await api.createAlert({
        ticker: form.ticker,
        alert_kind: form.kind,
        alert_type: form.condition,
        condition,
        price_target: form.kind === 'price' ? Number(form.target) : null,
      });
      setShowModal(false);
      setForm({ ticker: 'AAPL', kind: 'price', condition: 'above', target: '', technical: 'RSI > 70', news: 'Negative sentiment < 4.0' });
      await loadAlerts();
    } catch (err) {
      setError(err.message || 'Failed to create alert.');
    }
  };

  const toggleAlert = async (id) => {
    try {
      await api.toggleAlert(id);
      await loadAlerts();
    } catch (err) {
      setError(err.message || 'Failed to toggle alert.');
    }
  };

  const deleteAlert = async (id) => {
    try {
      await api.deleteAlert(id);
      await loadAlerts();
    } catch (err) {
      setError(err.message || 'Failed to delete alert.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Alerts</span>
          <h1>Price, technical, and news alerts</h1>
          <p>{processed.filter((alert) => alert.status === 'active').length} active - {processed.filter((alert) => alert.status === 'triggered').length} triggered.</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)}>Create Alert</button>
      </header>

      <div className="filter-row">
        {['all', 'active', 'triggered', 'price', 'technical', 'news'].map((item) => (
          <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>

      {error && <p className="status error">{error}</p>}

      <section className="panel">
        <div className="alert-list">
          {filtered.map((alert) => (
            <article className="alert-item" key={alert.id}>
              <span className={`alert-dot ${alert.status}`} />
              <div>
                <strong>{alert.ticker} - {alert.kind} alert</strong>
                <p>
                  {alert.kind === 'price'
                    ? `Price ${alert.condition} ${fmtPrice(alert.target)}${quotes[alert.ticker]?.c ? ` - now ${fmtPrice(quotes[alert.ticker].c)}` : ''}`
                    : alert.condition}
                </p>
              </div>
              <span className={`status-pill ${alert.status}`}>{alert.status}</span>
              <button className="secondary-button" type="button" onClick={() => toggleAlert(alert.id)}>
                {alert.is_active === false ? 'Enable' : 'Pause'}
              </button>
              <button className="danger-button" type="button" onClick={() => deleteAlert(alert.id)}>Delete</button>
            </article>
          ))}
          {!filtered.length && <div className="empty-state">No alerts match this filter.</div>}
        </div>
      </section>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2>Create Alert</h2>
              <button className="icon-btn" type="button" onClick={() => setShowModal(false)}>x</button>
            </header>
            <label className="form-field">
              <span>Stock</span>
              <select value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value })}>
                {Object.keys(STOCKS_BASE).map((ticker) => <option key={ticker} value={ticker}>{ticker} - {STOCKS_BASE[ticker].name}</option>)}
              </select>
            </label>
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
            <button type="button" onClick={createAlert}>Create Alert</button>
          </section>
        </div>
      )}
    </div>
  );
}
