import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { fmt, fmtPrice } from '../utils/formatters';

export default function TransferHistoryPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [order, setOrder] = useState('newest');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTransfers()
      .then((data) => setItems([...(data.transfers || []), ...(data.assetTransfers || [])]))
      .catch((err) => setError(err.message || 'Failed to load transfer history.'));
  }, []);

  const filtered = useMemo(() => items
    .filter((item) => {
      const haystack = `${item.from_label || item.from_account} ${item.to_label || item.to_account} ${item.ticker || ''}`.toLowerCase();
      const created = item.created_at ? new Date(item.created_at) : new Date();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (fromDate && created < new Date(fromDate)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    })
    .sort((a, b) => {
      const ad = new Date(a.created_at || 0).getTime();
      const bd = new Date(b.created_at || 0).getTime();
      return order === 'oldest' ? ad - bd : bd - ad;
    }), [fromDate, items, order, query, toDate]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Transfers</span>
          <h1>Transfer History</h1>
          <p>Search by account or stock and filter by date range.</p>
        </div>
      </header>
      <section className="panel">
        <div className="inline-controls">
          <label className="form-field"><span>Search Account or Stock</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Billy Growth, AAPL..." /></label>
          <label className="form-field"><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="form-field"><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="form-field"><span>Order</span><select value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">Newest To Oldest</option><option value="oldest">Oldest To Newest</option></select></label>
        </div>
        {error && <p className="status error">{error}</p>}
      </section>
      <section className="panel">
        <div className="transfer-list">
          {filtered.map((transfer) => (
            <article className="transfer-row" key={`${transfer.ticker || transfer.transfer_type}-${transfer.id}`}>
              <span><strong>{transfer.from_label || transfer.from_account}</strong><small>to {transfer.to_label || transfer.to_account}</small></span>
              <span className="mono">{transfer.ticker ? `${transfer.ticker} ${fmt(transfer.shares, 4)}` : fmtPrice(transfer.amount)}</span>
              <span className="status-pill active">{transfer.status}</span>
            </article>
          ))}
          {!filtered.length && <div className="empty-state">No transfers match these filters.</div>}
        </div>
      </section>
    </div>
  );
}
