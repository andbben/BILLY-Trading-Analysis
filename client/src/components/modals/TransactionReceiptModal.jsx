import { fmt, fmtPrice } from '../../utils/formatters';

function seedFrom(value) {
  return String(value || 'BILLY').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function last4(value, fallbackSeed) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  return String(1000 + (fallbackSeed % 9000)).slice(-4);
}

function makeRouting(seed) {
  return String(110000000 + (seed % 78999999)).slice(0, 9);
}

function receiptId(item) {
  if (item.transaction_id) return item.transaction_id;
  const prefix = item.kind === 'order' || item.trade_type ? 'ORD' : item.ticker ? 'SHR' : 'TX';
  return `${prefix}-${String(item.id || seedFrom(item.ticker)).padStart(6, '0')}`;
}

function receiptRows(item) {
  const seed = seedFrom(`${item.id}-${item.ticker}-${item.from_account}-${item.account_id}`);
  const created = item.created_at ? new Date(item.created_at) : new Date();
  const isOrder = item.kind === 'order' || Boolean(item.trade_type);
  const isShareTransfer = !isOrder && Boolean(item.ticker);
  const institution = isOrder
    ? 'Billy Market Analyst Brokerage'
    : item.from_type === 'bank' || item.to_type === 'bank'
      ? 'Billy Secure EFT Network'
      : isShareTransfer
        ? 'Billy Internal Asset Transfer Desk'
        : 'Billy Internal Transfer Desk';

  if (isOrder) {
    return [
      ['Receipt Type', 'Stock order'],
      ['Transaction ID', receiptId(item)],
      ['Timestamp', created.toLocaleString()],
      ['Institution', institution],
      ['Account', item.account_label || item.account_id || 'Billy account'],
      ['Account Last 4', last4(item.account_id || item.account_label, seed)],
      ['Action', String(item.trade_type || '').toUpperCase()],
      ['Symbol', item.ticker],
      ['Shares', fmt(item.shares, 4)],
      ['Execution Price', fmtPrice(item.price)],
      ['Gross Total', fmtPrice(item.total)],
      ['Estimated Fees', '$0.00'],
      ['Settlement', 'T+1 simulated settlement'],
      ['Status', item.status || 'completed'],
    ];
  }

  return [
    ['Receipt Type', isShareTransfer ? 'Share transfer' : 'Cash transfer'],
    ['Transaction ID', receiptId(item)],
    ['Timestamp', created.toLocaleString()],
    ['Institution', institution],
    ['From Account', item.from_label || item.from_account],
    ['From Account Last 4', last4(item.from_account || item.from_label, seed)],
    ['From Routing Last 4', last4(makeRouting(seed), seed)],
    ['To Account', item.to_label || item.to_account],
    ['To Account Last 4', last4(item.to_account || item.to_label, seed + 47)],
    ['To Routing Last 4', last4(makeRouting(seed + 47), seed + 47)],
    ['Transfer Type', isShareTransfer ? 'Billy share movement' : String(item.transfer_type || 'cash transfer').replaceAll('_', ' ')],
    ['Amount', isShareTransfer ? `${item.ticker} ${fmt(item.shares, 4)} shares` : fmtPrice(item.amount)],
    ['Memo', item.memo || 'No memo provided'],
    ['Status', item.status || 'completed'],
  ];
}

export default function TransactionReceiptModal({ item, onClose }) {
  if (!item) return null;
  const rows = receiptRows(item);
  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal receipt-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="section-eyebrow">Receipt</span>
            <h2>Transaction Details</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
        </header>
        <div className="receipt-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="form-hint">Receipt data is generated for this demo workspace and includes simulated institution, routing, account, settlement, and transaction metadata.</p>
      </section>
    </div>
  );
}
