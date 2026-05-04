import { useMemo, useState } from 'react';
import { INDEX_SYMS, STOCKS_BASE } from '../data/market';
import { fmt, fmtPct, fmtPrice } from '../utils/formatters';
import Sparkline from '../components/charts/Sparkline';
import StockModal from '../components/modals/StockModal';

function MarketMoverList({ title, items, quotes, onSelect }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
      </header>
      <div className="mover-list">
        {items.map(({ ticker, dp }) => {
          const quote = quotes[ticker] || {};
          const info = STOCKS_BASE[ticker];
          return (
            <button className="mover-row" type="button" key={ticker} onClick={() => onSelect(ticker)}>
              <span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span>
              <span>
                <strong>{ticker}</strong>
                <small>{info.name}</small>
              </span>
              <span className="mono">{fmtPrice(quote.c)}</span>
              <em className={dp >= 0 ? 'pos' : 'neg'}>{fmtPct(dp)}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HotStocks({ quotes, onSelect }) {
  const scored = useMemo(() => Object.keys(STOCKS_BASE)
    .map((ticker) => {
      const quote = quotes[ticker] || {};
      const absMove = Math.abs(quote.dp || 0);
      const beta = STOCKS_BASE[ticker].beta || 1;
      return { ticker, score: absMove * 12 + beta * 8, quote };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5), [quotes]);

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Hot Stocks</h2>
          <p>Ranked by movement and volatility profile.</p>
        </div>
      </header>
      <div className="hot-grid">
        {scored.map(({ ticker, score, quote }, index) => {
          const info = STOCKS_BASE[ticker];
          return (
            <button className="hot-card" type="button" key={ticker} onClick={() => onSelect(ticker)}>
              <span className="rank">#{index + 1}</span>
              <span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span>
              <strong>{ticker}</strong>
              <small>{info.sector}</small>
              <span className="mono">{fmtPrice(quote.c)}</span>
              <em className={(quote.dp || 0) >= 0 ? 'pos' : 'neg'}>{fmtPct(quote.dp || 0)}</em>
              <span className="score-bar"><i style={{ width: `${Math.min(100, score)}%` }} /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ marketData }) {
  const [selected, setSelected] = useState(null);
  const { quotes, mktStatus, lastUpdate, fetchStockCandles, fetchCompanyNews } = marketData;

  const sortedByChange = useMemo(() => Object.keys(STOCKS_BASE)
    .map((ticker) => ({ ticker, dp: quotes[ticker]?.dp || 0 }))
    .sort((a, b) => b.dp - a.dp), [quotes]);

  const gainers = sortedByChange.slice(0, 3);
  const losers = [...sortedByChange].reverse().slice(0, 3);

  const insights = useMemo(() => sortedByChange
    .filter(({ ticker }) => quotes[ticker]?.c)
    .slice(0, 4)
    .map(({ ticker, dp }) => {
      const quote = quotes[ticker];
      const up = dp >= 0;
      return {
        ticker,
        type: up ? 'bull' : 'bear',
        text: `${ticker} is ${up ? 'up' : 'down'} ${fmt(Math.abs(dp))}% today at ${fmtPrice(quote.c)}. Watch ${up ? fmtPrice(quote.h) : fmtPrice(quote.l)} as the next intraday level.`,
        conf: Math.min(90, Math.max(55, 62 + Math.abs(dp) * 5)),
      };
    }), [quotes, sortedByChange]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Market Overview</span>
          <h1>Live market intelligence</h1>
          <p>{mktStatus?.label} - REST polling through the server proxy{lastUpdate ? ` - updated ${lastUpdate.toLocaleTimeString()}` : ''}</p>
        </div>
      </header>

      <section className="stat-grid">
        {Object.entries(INDEX_SYMS).map(([symbol, label]) => {
          const quote = quotes[symbol] || {};
          const up = (quote.dp || 0) >= 0;
          return (
            <article className="stat-card" key={symbol}>
              <span>{label}</span>
              <strong>{fmtPrice(quote.c)}</strong>
              <em className={up ? 'pos' : 'neg'}>{fmtPct(quote.dp || 0)}</em>
              <Sparkline data={[quote.l || quote.c * 0.99, quote.o || quote.c, quote.h || quote.c * 1.01, quote.c].filter(Boolean)} color={up ? '#00e676' : '#ff3d71'} />
            </article>
          );
        })}
        <article className="stat-card">
          <span>Market Movers</span>
          <strong>{gainers.filter((item) => item.dp > 0).length}/{Object.keys(STOCKS_BASE).length}</strong>
          <em>gainers today</em>
        </article>
      </section>

      <div className="two-column">
        <MarketMoverList title="Top Gainers" items={gainers} quotes={quotes} onSelect={setSelected} />
        <MarketMoverList title="Top Losers" items={losers} quotes={quotes} onSelect={setSelected} />
      </div>

      <HotStocks quotes={quotes} onSelect={setSelected} />

      <section className="panel signal-panel">
        <header className="panel-header">
          <div>
            <h2>Signal Intelligence</h2>
            <p>Rules-based momentum, daily move, and intraday range explanations.</p>
          </div>
          <span className="live-pill">Live</span>
        </header>
        <div className="insight-grid">
          {insights.map((insight) => (
            <button className={`insight-card ${insight.type}`} type="button" key={insight.ticker} onClick={() => setSelected(insight.ticker)}>
              <strong>{insight.ticker} - {insight.type === 'bull' ? 'Bullish' : 'Bearish'}</strong>
              <p>{insight.text}</p>
              <span>Confidence {insight.conf.toFixed(0)}%</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>All Stocks</h2>
            <p>Click a row for chart, indicators, and related news.</p>
          </div>
        </header>
        <div className="data-table stock-table">
          <div className="table-head">
            <span>Symbol</span><span>Price</span><span>Change</span><span>High / Low</span><span>Signal</span><span>Chart</span>
          </div>
          {Object.entries(STOCKS_BASE).map(([ticker, info]) => {
            const quote = quotes[ticker] || {};
            const up = (quote.dp || 0) >= 0;
            const signal = (quote.dp || 0) > 2 ? 'BUY' : (quote.dp || 0) < -2 ? 'SELL' : 'HOLD';
            return (
              <button className="table-row" type="button" key={ticker} onClick={() => setSelected(ticker)}>
                <span className="ticker-cell">
                  <span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span>
                  <span><strong>{ticker}</strong><small>{info.name}</small></span>
                </span>
                <span className="mono">{fmtPrice(quote.c)}</span>
                <span className={up ? 'pos mono' : 'neg mono'}>{fmtPct(quote.dp || 0)}</span>
                <span className="mono muted">{fmtPrice(quote.h)} / {fmtPrice(quote.l)}</span>
                <span><i className={`badge badge-${signal.toLowerCase()}`}>{signal}</i></span>
                <Sparkline data={[quote.l || quote.c * 0.99, quote.o || quote.c, quote.h || quote.c * 1.01, quote.c].filter(Boolean)} color={up ? '#00e676' : '#ff3d71'} height={34} />
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
