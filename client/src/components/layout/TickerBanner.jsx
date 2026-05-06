import { STOCKS_BASE } from '../../data/market';
import { fmt, fmtPct } from '../../utils/formatters';

function buildItem(symbol, quotes) {
  const quote = quotes[symbol];
  if (!quote?.c) return null;
  return {
    symbol,
    name: STOCKS_BASE[symbol]?.name || symbol,
    price: quote.c,
    change: quote.dp || 0,
  };
}

function normalizeWatchlist(watchlist) {
  return [...new Set(watchlist
    .map((item) => (typeof item === 'string' ? item : item?.ticker))
    .filter(Boolean)
    .map((ticker) => ticker.toUpperCase())
    .filter((ticker) => STOCKS_BASE[ticker]))];
}

function getFallbackMovers(quotes) {
  const sorted = Object.keys(STOCKS_BASE)
    .map((symbol) => buildItem(symbol, quotes))
    .filter(Boolean)
    .sort((a, b) => b.change - a.change);

  return [
    ...sorted.slice(0, 3),
    ...[...sorted].reverse().slice(0, 3),
  ];
}

export default function TickerBanner({ quotes, watchlist = [] }) {
  const watchlistSymbols = normalizeWatchlist(watchlist);
  const watchlistItems = watchlistSymbols
    .map((symbol) => buildItem(symbol, quotes))
    .filter(Boolean);
  const items = watchlistItems.length ? watchlistItems : getFallbackMovers(quotes);

  if (!items.length) return null;

  const repeatCount = Math.max(3, Math.ceil(16 / items.length));
  const segmentItems = Array.from({ length: repeatCount }, () => items).flat();

  return (
    <div className="ticker-banner" aria-label="Live market prices">
      <div className="ticker-label">{watchlistItems.length ? 'WATCHLIST' : 'MOVERS'}</div>
      <div className="ticker-window">
        <div className="ticker-track">
          {[0, 1].map((segment) => (
            <div className="ticker-segment" aria-hidden={segment === 1} key={segment}>
              {segmentItems.map((item, index) => (
                <div className="ticker-item" title={item.name} key={`${segment}-${item.symbol}-${index}`}>
                  <span>{item.symbol}</span>
                  <strong>${fmt(item.price)}</strong>
                  <em className={item.change >= 0 ? 'pos' : 'neg'}>{fmtPct(item.change)}</em>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
