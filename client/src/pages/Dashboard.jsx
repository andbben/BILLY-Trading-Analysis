import { useEffect, useMemo, useState } from 'react';
import { INDEX_SYMS, PORTFOLIO_COLORS, STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { fmt, fmtPct, fmtPrice } from '../utils/formatters';
import Sparkline from '../components/charts/Sparkline';
import StockModal from '../components/modals/StockModal';

function normalizePosition(position) {
  return {
    ...position,
    shares: Number(position.shares ?? position.quantity ?? 0),
    avgCost: Number(position.avg_cost ?? position.avgCost ?? position.purchase_price ?? 0),
  };
}

function normalizeAccount(account, index = 0) {
  return {
    ...account,
    balance: Number(account.balance || 0),
    positions: (account.positions || []).map(normalizePosition),
    color: PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length],
  };
}

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

export default function Dashboard({ marketData }) {
  const [selected, setSelected] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [watchlistTickers, setWatchlistTickers] = useState([]);
  const { quotes, mktStatus, lastUpdate, fetchStockCandles, fetchCompanyNews } = marketData;

  const loadPortfolioAccounts = async () => {
    try {
      const data = await api.getPortfolio();
      setAccounts((data.billyAccounts || []).map(normalizeAccount));
    } catch {
      setAccounts([]);
    }
  };

  useEffect(() => {
    loadPortfolioAccounts();
    api.getWatchlist()
      .then((data) => setWatchlistTickers((data.watchlist || []).map((item) => (typeof item === 'string' ? item : item.ticker)).filter(Boolean)))
      .catch(() => setWatchlistTickers([]));
  }, []);

  const executeStockModalTrade = async ({ mode, ticker, shares, price, accountId, orderType }) => {
    await api.executeTrade({ mode, ticker, shares, price, accountId, orderType });
    await loadPortfolioAccounts();
  };

  const sortedByChange = useMemo(() => Object.keys(STOCKS_BASE)
    .map((ticker) => ({ ticker, dp: quotes[ticker]?.dp || 0 }))
    .sort((a, b) => b.dp - a.dp), [quotes]);

  const gainers = sortedByChange.slice(0, 3);
  const losers = [...sortedByChange].reverse().slice(0, 3);
  const recommended = useMemo(() => {
    const source = watchlistTickers.length ? watchlistTickers : ['NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM'];
    return source.filter((ticker) => STOCKS_BASE[ticker]).slice(0, 8);
  }, [watchlistTickers]);

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
          <h1>Live Market Intelligence</h1>
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

      <section className="panel hot-stocks-panel">
        <header className="panel-header">
          <div>
            <h2>{watchlistTickers.length ? 'Watchlist Focus' : 'Analyst Recommended Stocks'}</h2>
            <p>{watchlistTickers.length ? 'Primary movers from your watchlist.' : 'Eight daily demo recommendations ranked by quality and activity.'}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => window.location.assign('/movers')}>View Movers</button>
        </header>
        <div className="hot-grid">
          {recommended.map((ticker, index) => {
            const quote = quotes[ticker] || {};
            const info = STOCKS_BASE[ticker];
            const score = Math.abs(quote.dp || 0) * 12 + (info.beta || 1) * 8;
            return (
              <button className="hot-card kelly-bordered" type="button" key={ticker} onClick={() => setSelected(ticker)}>
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

      <section className="panel signal-panel kelly-panel">
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
          tradeAccounts={accounts}
          defaultAccountId={accounts[0]?.id}
          onExecuteTrade={executeStockModalTrade}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
