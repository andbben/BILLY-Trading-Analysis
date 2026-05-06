import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { fmt, fmtPrice } from '../utils/formatters';

export default function PortfolioTransactionsPage() {
  const [orders, setOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [order, setOrder] = useState('newest');

  useEffect(() => {
    api.getPortfolio().then((data) => {
      setOrders(data.orders || []);
      setTransfers([...(data.transfers || []), ...(data.assetTransfers || [])]);
    });
  }, []);

  const rows = useMemo(() => [
    ...orders.map((item) => ({ ...item, kind: 'order', label: `${item.trade_type} ${item.ticker}`, search: `${item.ticker} ${item.account_label || ''}` })),
    ...transfers.map((item) => ({ ...item, kind: 'transfer', label: item.ticker ? `${item.ticker} share transfer` : item.transfer_type, search: `${item.ticker || ''} ${item.from_label || ''} ${item.to_label || ''}` })),
  ].filter((item) => {
    const created = item.created_at ? new Date(item.created_at) : new Date();
    if (query && !item.search.toLowerCase().includes(query.toLowerCase())) return false;
    if (fromDate && created < new Date(fromDate)) return false;
    if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  }).sort((a, b) => {
    const ad = new Date(a.created_at || 0).getTime();
    const bd = new Date(b.created_at || 0).getTime();
    return order === 'oldest' ? ad - bd : bd - ad;
  }), [fromDate, order, orders, query, toDate, transfers]);

  return (
    <div className="page">
      <header className="page-header"><div><span className="section-eyebrow">Portfolio</span><h1>Portfolio Transactions</h1><p>All stock orders, cash transfers, and share transfers.</p></div></header>
      <section className="panel">
        <div className="inline-controls">
          <label className="form-field"><span>Search Stock or Account</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="form-field"><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="form-field"><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="form-field"><span>Order</span><select value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">Newest To Oldest</option><option value="oldest">Oldest To Newest</option></select></label>
        </div>
      </section>
      <section className="panel">
        <div className="transfer-list">
          {rows.map((item) => (
            <article className="transfer-row" key={`${item.kind}-${item.id}`}>
              <span><strong>{item.label}</strong><small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Current session'}</small></span>
              <span className="mono">{item.kind === 'order' ? `${fmt(item.shares, 4)} @ ${fmtPrice(item.price)}` : item.ticker ? `${item.ticker} ${fmt(item.shares, 4)}` : fmtPrice(item.amount)}</span>
              <span className="status-pill active">{item.status || 'completed'}</span>
            </article>
          ))}
          {!rows.length && <div className="empty-state">No transactions match these filters.</div>}
        </div>
      </section>
    </div>
  );
}
