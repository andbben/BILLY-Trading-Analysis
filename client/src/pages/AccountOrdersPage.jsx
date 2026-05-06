import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { fmt, fmtPrice } from '../utils/formatters';
import TransactionReceiptModal from '../components/modals/TransactionReceiptModal';

function normalizeAccount(account) {
  return {
    ...account,
    balance: Number(account.balance || 0),
    positions: account.positions || [],
  };
}

export default function AccountOrdersPage() {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const [account, setAccount] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [receiptItem, setReceiptItem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadOrders = async () => {
      try {
        const data = await api.getPortfolio();
        if (cancelled) return;
        const accounts = (data.billyAccounts || []).map(normalizeAccount);
        const selectedAccount = accounts.find((item) => item.id === accountId);
        setAccount(selectedAccount || null);
        setOrders((data.orders || []).filter((order) => (
          order.account_id === accountId
          || order.accountId === accountId
          || (!order.account_id && selectedAccount?.source === 'portfolio')
        )));
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load account orders.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (loading) return <div className="page"><p className="status">Loading account orders...</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Orders</span>
          <h1>{account ? `${account.label} Orders` : 'Account Orders'}</h1>
          <p>Completed stock order activity associated with this Billy account.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate(`/portfolio/accounts/${encodeURIComponent(accountId)}`)}>Back to Account</button>
      </header>

      {error && <p className="status warning">{error}</p>}
      {!account && <p className="status warning">This Billy account was not found.</p>}

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Account Order History</h2>
            <p>Buy and sell orders routed through this account.</p>
          </div>
        </header>
        <div className="data-table account-orders-table">
          <div className="table-head"><span>Date</span><span>Action</span><span>Symbol</span><span>Shares</span><span>Price</span><span>Total</span><span>Receipt</span></div>
          {orders.map((order) => (
            <article className="table-row" key={order.id}>
              <span>{order.created_at ? new Date(order.created_at).toLocaleString() : 'Current session'}</span>
              <span className={order.trade_type === 'buy' ? 'pos' : 'neg'}>{String(order.trade_type || '').toUpperCase()}</span>
              <span className="mono">{order.ticker}</span>
              <span className="mono">{fmt(order.shares, 4)}</span>
              <span className="mono">{fmtPrice(order.price)}</span>
              <span className="mono">{fmtPrice(order.total)}</span>
              <button className="secondary-button alert-create-button plan-action-button" type="button" onClick={() => setReceiptItem({ ...order, kind: 'order' })}>Receipt</button>
            </article>
          ))}
          {!orders.length && <div className="empty-state">No orders have been recorded for this account yet.</div>}
        </div>
      </section>
      <TransactionReceiptModal item={receiptItem} onClose={() => setReceiptItem(null)} />
    </div>
  );
}
