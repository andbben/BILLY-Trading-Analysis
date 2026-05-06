import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { fmtPrice } from '../utils/formatters';
import { getPlanRules } from '../utils/plans';
import AlertComposer from '../components/modals/AlertComposer';

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
  const [error, setError] = useState('');
  const { quotes } = marketData;
  const planRules = getPlanRules();
  const alertFilters = ['all', 'active', 'triggered', ...planRules.alertKinds];

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
          <h1>{planRules.plan === 'free' ? 'Price Alerts' : planRules.plan === 'plus' ? 'Price and News Alerts' : 'Price, Technical, and News Alerts'}</h1>
          <p>{processed.filter((alert) => alert.status === 'active').length} active - {processed.filter((alert) => alert.status === 'triggered').length} triggered.</p>
        </div>
        <button className="secondary-button alert-create-button" type="button" onClick={() => setShowModal(true)}>Create Alert</button>
      </header>

      <div className="filter-row">
        {alertFilters.map((item) => (
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
        <AlertComposer marketData={marketData} onClose={() => setShowModal(false)} onCreated={loadAlerts} />
      )}
    </div>
  );
}
