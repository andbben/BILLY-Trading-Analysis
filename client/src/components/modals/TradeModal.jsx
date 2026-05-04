import { useMemo, useState } from 'react';
import { ALL_STOCK_SYMBOLS, STOCKS_BASE } from '../../data/market';
import { fmt, fmtPrice } from '../../utils/formatters';

export default function TradeModal({ mode, ticker: initialTicker, quotes, holdings, balance, onClose, onConfirm }) {
  const [ticker, setTicker] = useState(initialTicker || 'AAPL');
  const [shares, setShares] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isBuy = mode === 'buy';
  const quote = quotes[ticker] || {};
  const price = quote.c || 0;
  const sharesNum = Number.parseFloat(shares) || 0;
  const total = sharesNum * price;
  const existing = useMemo(() => holdings.find((item) => item.ticker === ticker), [holdings, ticker]);
  const maxSell = existing?.shares || 0;
  const canSubmit = sharesNum > 0 && price > 0 && (isBuy ? total <= balance : sharesNum <= maxSell);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({ mode, ticker, shares: sharesNum, price });
    } catch (err) {
      setError(err.message || 'Trade failed.');
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal trade-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="modal-kicker">{isBuy ? 'Buy Order' : 'Sell Order'}</span>
            <h2>{isBuy ? 'Buy' : 'Sell'} {ticker}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
        </header>

        {!initialTicker && isBuy && (
          <label className="form-field">
            <span>Stock</span>
            <select value={ticker} onChange={(event) => setTicker(event.target.value)}>
              {ALL_STOCK_SYMBOLS.map((symbol) => (
                <option key={symbol} value={symbol}>{symbol} - {STOCKS_BASE[symbol].name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="trade-quote">
          <div>
            <strong>{ticker}</strong>
            <span>{STOCKS_BASE[ticker]?.name}</span>
          </div>
          <strong>{fmtPrice(price)}</strong>
        </div>

        <label className="form-field">
          <span>Shares {isBuy ? 'to buy' : 'to sell'}</span>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            placeholder="0.000"
          />
        </label>

        {!isBuy && <p className="form-hint">Available to sell: {fmt(maxSell, 4)} shares</p>}
        {isBuy && sharesNum > 0 && total > balance && <p className="status error">Insufficient cash for this order.</p>}
        {!isBuy && sharesNum > maxSell && <p className="status error">You do not own enough shares.</p>}
        {error && <p className="status error">{error}</p>}

        <div className="trade-summary">
          <div><span>Price</span><strong>{fmtPrice(price)}</strong></div>
          <div><span>Shares</span><strong>{fmt(sharesNum, 4)}</strong></div>
          <div><span>{isBuy ? 'Total cost' : 'Proceeds'}</span><strong>{fmtPrice(total)}</strong></div>
          <div><span>Cash after trade</span><strong>{fmtPrice(isBuy ? balance - total : balance + total)}</strong></div>
        </div>

        <button className={isBuy ? 'buy-button full' : 'sell-button full'} type="button" disabled={!canSubmit || saving} onClick={submit}>
          {saving ? 'Placing order...' : `${isBuy ? 'Buy' : 'Sell'} ${sharesNum > 0 ? fmt(sharesNum, 4) : ''} shares`}
        </button>
      </section>
    </div>
  );
}
