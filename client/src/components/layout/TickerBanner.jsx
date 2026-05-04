import { ALL_FETCH_SYMBOLS, INDEX_SYMS, STOCKS_BASE } from '../../data/market';
import { fmt, fmtPct } from '../../utils/formatters';

export default function TickerBanner({ quotes }) {
  const items = ALL_FETCH_SYMBOLS.map((symbol) => {
    const quote = quotes[symbol];
    if (!quote?.c) return null;
    return {
      symbol,
      name: STOCKS_BASE[symbol]?.name || INDEX_SYMS[symbol] || symbol,
      price: quote.c,
      change: quote.dp || 0,
    };
  }).filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="ticker-banner" aria-label="Live market prices">
      <div className="ticker-label">LIVE</div>
      <div className="ticker-track">
        {[...items, ...items].map((item, index) => (
          <div className="ticker-item" title={item.name} key={`${item.symbol}-${index}`}>
            <span>{item.symbol}</span>
            <strong>${fmt(item.price)}</strong>
            <em className={item.change >= 0 ? 'pos' : 'neg'}>{fmtPct(item.change)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
