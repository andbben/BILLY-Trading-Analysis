import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PORTFOLIO_COLORS, STARTER_HOLDINGS, STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { classifySentiment, computeRiskScore } from '../utils/indicators';
import { fmt, fmtPct, fmtPrice, timeAgo } from '../utils/formatters';
import RiskGauge from '../components/charts/RiskGauge';
import Sparkline from '../components/charts/Sparkline';
import NewsArticleModal from '../components/modals/NewsArticleModal';
import StockModal from '../components/modals/StockModal';

const DIVERSITY_COLORS = {
  domestic: '#00c2a8',
  foreign: '#4f7cff',
  bonds: '#ffb84d',
  shortTerm: '#9be564',
  other: '#ff6fb1',
  unknown: '#b58cff',
};

const DIVERSITY_LABELS = {
  domestic: 'Domestic stock',
  foreign: 'Foreign stock',
  bonds: 'Bonds',
  shortTerm: 'Short term',
  other: 'Other',
  unknown: 'Unknown',
};

function normalizePosition(position) {
  return {
    id: position.id,
    ticker: position.ticker,
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

function priceFor(ticker, position, quotes) {
  return Number(quotes[ticker]?.c || position?.avgCost || 0);
}

function accountRows(account, quotes) {
  return (account?.positions || []).map((position, index) => {
    const quote = quotes[position.ticker] || {};
    const cur = priceFor(position.ticker, position, quotes);
    const val = cur * position.shares;
    const costTotal = position.avgCost * position.shares;
    return {
      ...position,
      cur,
      val,
      costTotal,
      dayGl: Number(quote.d || 0) * position.shares,
      dayPct: Number(quote.dp || 0),
      totalGL: val - costTotal,
      totalPct: costTotal ? ((val - costTotal) / costTotal) * 100 : 0,
      high52: Number(quote.h || cur * 1.18),
      low52: Number(quote.l || cur * 0.82),
      color: PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length],
    };
  });
}

function accountValue(account, quotes) {
  return Number(account?.balance || 0) + accountRows(account, quotes).reduce((sum, row) => sum + row.val, 0);
}

function accountSeries(account, quotes) {
  const value = Math.max(1, accountValue(account, quotes));
  return [0.97, 0.985, 0.992, 1.006, 1.001, 1.016, 1].map((factor) => value * factor);
}

function accountStats(account, quotes) {
  const rows = accountRows(account, quotes);
  const totalVal = rows.reduce((sum, row) => sum + row.val, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costTotal, 0);
  const totalGL = totalVal - totalCost;
  const dayGL = rows.reduce((sum, row) => sum + row.dayGl, 0);
  return {
    rows,
    cash: Number(account?.balance || 0),
    accountTotal: Number(account?.balance || 0) + totalVal,
    holdingsValue: totalVal,
    totalGL,
    totalPct: totalCost ? (totalGL / totalCost) * 100 : 0,
    dayGL,
    dayPct: totalVal ? (dayGL / totalVal) * 100 : 0,
  };
}

function diversityBreakdown(accounts, quotes) {
  const totals = { domestic: 0, foreign: 0, bonds: 0, shortTerm: 0, other: 0, unknown: 0 };
  accounts.forEach((account) => {
    totals.shortTerm += Number(account.balance || 0);
    accountRows(account, quotes).forEach((row) => {
      if (STOCKS_BASE[row.ticker]) totals.domestic += row.val;
      else totals.unknown += row.val;
    });
  });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(totals).map(([key, value]) => ({ key, value, pct: (value / total) * 100 }));
}

function AllocationPie({ breakdown }) {
  const gradient = breakdown.reduce((parts, item, index) => {
    const start = breakdown.slice(0, index).reduce((sum, prior) => sum + prior.pct, 0);
    const end = start + item.pct;
    return [...parts, `${DIVERSITY_COLORS[item.key]} ${start}% ${end}%`];
  }, []).join(', ');

  return (
    <div className="allocation-pie-wrap">
      <div className="allocation-pie" style={{ background: `conic-gradient(${gradient})` }} />
      <div className="legend-grid allocation-legend">
        {breakdown.map((item) => (
          <span key={item.key}><i style={{ background: DIVERSITY_COLORS[item.key] }} />{DIVERSITY_LABELS[item.key]} {fmt(item.pct, 1)}%</span>
        ))}
      </div>
    </div>
  );
}

function RangeIndicator({ low, high, current }) {
  const span = Math.max(1, high - low);
  const pct = Math.min(100, Math.max(0, ((current - low) / span) * 100));
  return (
    <span className="range-indicator">
      <i style={{ left: `${pct}%` }} />
      <small>{fmtPrice(low)} - {fmtPrice(high)}</small>
    </span>
  );
}

function relatedTickers(article) {
  return (article.related || '').split(',').map((ticker) => ticker.trim()).filter((ticker) => STOCKS_BASE[ticker]);
}

export default function AccountPage({ marketData }) {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [tradeIntent, setTradeIntent] = useState('buy');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [positionSort, setPositionSort] = useState('dayPct');
  const [positionSortDir, setPositionSortDir] = useState('desc');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const loadPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      setAccounts((data.billyAccounts || []).map(normalizeAccount));
      setError('');
    } catch (err) {
      const fallback = {
        id: 'portfolio-fallback',
        source: 'portfolio',
        type: 'billy',
        label: 'My Portfolio',
        accountNumber: '0001',
        balance: 50000,
        positions: STARTER_HOLDINGS.map(normalizePosition),
      };
      setAccounts([fallback]);
      setError(`${err.message || 'Failed to load account.'} Showing starter demo holdings.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const stats = accountStats(selectedAccount, quotes);
  const diversity = diversityBreakdown(selectedAccount ? [selectedAccount] : [], quotes);
  const sectors = [...new Set(stats.rows.map((row) => STOCKS_BASE[row.ticker]?.sector || 'Unknown'))].sort();
  const filteredRows = sectorFilter === 'all'
    ? stats.rows
    : stats.rows.filter((row) => (STOCKS_BASE[row.ticker]?.sector || 'Unknown') === sectorFilter);
  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = Number(a[positionSort] ?? 0);
    const bv = Number(b[positionSort] ?? 0);
    return positionSortDir === 'asc' ? av - bv : bv - av;
  });

  const accountTickers = (selectedAccount?.positions || []).map((position) => position.ticker);

  const accountNews = (marketData.news || [])
    .map((item, index) => {
      const sentiment = classifySentiment(item.headline || item.title || '', item.summary || '');
      const tickers = relatedTickers(item);
      return { ...item, ...sentiment, tickers, index };
    })
    .filter((item) => item.tickers.some((ticker) => accountTickers.includes(ticker)))
    .slice(0, 6);

  const executeStockModalTrade = async ({ mode, ticker, shares, price, accountId: tradeAccountId, orderType }) => {
    await api.executeTrade({ mode, ticker, shares, price, accountId: tradeAccountId, orderType });
    await loadPortfolio();
  };

  if (loading) return <div className="page"><p className="status">Loading account summary...</p></div>;

  if (!selectedAccount) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <span className="section-eyebrow">Account</span>
            <h1>Account not found</h1>
            <p>Select an available Billy account from the Portfolio & Risk Overview.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => navigate('/portfolio')}>Back to Portfolio</button>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">{selectedAccount.label}</span>
          <h1>Account Summary</h1>
          <p>Account {selectedAccount.accountNumber} - balance, buying power, risk, positions, and related news.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate('/portfolio')}>Back to Portfolio</button>
      </header>

      {error && <p className="status warning">{error}</p>}

      <section className="panel account-workspace">
        <header className="panel-header">
          <div>
            <h2>{selectedAccount.label}</h2>
            <p>Latest account value trend and cash available to trade or transfer.</p>
          </div>
        </header>
        <Sparkline data={accountSeries(selectedAccount, quotes)} color={stats.dayGL >= 0 ? '#00c2a8' : '#ff4f7b'} height={130} />
      </section>

      <section className="stat-grid">
        <article className="stat-card"><span>Total Value</span><strong>{fmtPrice(stats.accountTotal)}</strong><em>cash plus positions</em></article>
        <article className="stat-card"><span>Cash Available</span><strong>{fmtPrice(stats.cash)}</strong><em>buying power</em></article>
        <article className="stat-card"><span>Total Gain / Loss</span><strong className={stats.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(stats.totalGL)}</strong><em>{fmtPct(stats.totalPct)}</em></article>
        <article className="stat-card"><span>Day G/L</span><strong className={stats.dayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(stats.dayGL)}</strong><em>{fmtPct(stats.dayPct)}</em></article>
      </section>

      <div className="two-column">
        <section className="panel">
          <header className="panel-header"><h2>Account Diversity</h2></header>
          <AllocationPie breakdown={diversity} />
        </section>
        <section className="panel risk-panel">
          <header className="panel-header"><h2>Account Risk Assessment</h2></header>
          <RiskGauge score={computeRiskScore(stats.rows)} />
        </section>
      </div>

      <section className="panel positions-list">
        <header className="panel-header">
          <div>
            <h2>Positions</h2>
            <p>Select a holding to buy or sell shares within this account.</p>
          </div>
        </header>
        <div className="inline-controls position-sort-controls">
          <label className="form-field">
            <span>Sort holdings by</span>
            <select value={positionSort} onChange={(event) => setPositionSort(event.target.value)}>
              <option value="dayPct">Day % change</option>
              <option value="dayGl">Day $ change</option>
              <option value="totalPct">Total % gain/loss</option>
              <option value="totalGL">Total $ gain/loss</option>
              <option value="val">Current value</option>
              <option value="shares">Shares</option>
              <option value="avgCost">Average cost</option>
            </select>
          </label>
          <label className="form-field">
            <span>Industry</span>
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              <option value="all">All industries</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <button className="secondary-button" type="button" onClick={() => setPositionSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}>
            {positionSortDir === 'asc' ? 'Low to high' : 'High to low'}
          </button>
        </div>
        {sortedRows.map((row) => {
          const accountPct = stats.accountTotal ? (row.val / stats.accountTotal) * 100 : 0;
          const movementClass = row.dayGl >= 0 ? 'movement-up' : 'movement-down';
          const openTrade = (mode) => {
            setTradeIntent(mode);
            setSelected(row.ticker);
          };
          return (
            <article
              className={`position-entry compact-position ${movementClass}`}
              key={row.ticker}
              style={{ '--movement-color': row.dayGl >= 0 ? '#00c2a8' : '#ff4f7b' }}
            >
              <div className="position-entry-title">
                <span className="ticker-logo" style={{ background: row.color }}>{row.ticker.slice(0, 2)}</span>
                <span><strong>{row.ticker}</strong><small>{STOCKS_BASE[row.ticker]?.name}</small></span>
                <span className="sector-chip">{STOCKS_BASE[row.ticker]?.sector || 'Unknown'}</span>
                <span className="compact-price"><strong>{fmtPrice(row.cur)}</strong><small className={row.dayPct >= 0 ? 'pos' : 'neg'}>{fmtPct(row.dayPct)}</small></span>
                <span className="row-actions">
                  <button className="secondary-button" type="button" onClick={() => openTrade('buy')}>Buy</button>
                  <button className="secondary-button" type="button" onClick={() => openTrade('sell')}>Sell</button>
                </span>
              </div>
              <div className="position-compact-metrics">
                <span>Today <strong className={row.dayGl >= 0 ? 'pos' : 'neg'}>{fmtPrice(row.dayGl)} / {fmtPct(row.dayPct)}</strong></span>
                <span>Total <strong className={row.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(row.totalGL)} / {fmtPct(row.totalPct)}</strong></span>
                <span>Value <strong>{fmtPrice(row.val)}</strong></span>
                <span>Weight <strong>{fmtPct(accountPct)}</strong></span>
                <span>Shares <strong>{fmt(row.shares, 4)}</strong></span>
                <span>Avg cost <strong>{fmtPrice(row.avgCost)}</strong></span>
                <span className="compact-range">52w <RangeIndicator low={row.low52} high={row.high52} current={row.cur} /></span>
              </div>
            </article>
          );
        })}
        {!sortedRows.length && <div className="empty-state">No positions are currently held in this account.</div>}
        <article className={`position-entry totals-entry ${stats.dayGL >= 0 ? 'movement-up' : 'movement-down'}`} style={{ '--movement-color': stats.dayGL >= 0 ? '#00c2a8' : '#ff4f7b' }}>
          <div className="position-entry-title">
            <strong>Account totals</strong>
            <span className="row-actions">
              <button className="secondary-button" type="button" onClick={() => navigate(`/portfolio/accounts/${encodeURIComponent(selectedAccount.id)}/orders`)}>
                View account orders
              </button>
            </span>
          </div>
          <div className="position-metrics">
            <span>Today $ <strong className={stats.dayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(stats.dayGL)}</strong></span>
            <span>Today % <strong className={stats.dayPct >= 0 ? 'pos' : 'neg'}>{fmtPct(stats.dayPct)}</strong></span>
            <span>Total $ <strong className={stats.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(stats.totalGL)}</strong></span>
            <span>Total % <strong className={stats.totalPct >= 0 ? 'pos' : 'neg'}>{fmtPct(stats.totalPct)}</strong></span>
            <span>Current value <strong>{fmtPrice(stats.accountTotal)}</strong></span>
          </div>
        </article>
      </section>

      <section className="panel account-news">
        <header className="panel-header">
          <div>
            <h2>Account News Sentiment</h2>
            <p>Article analysis based only on stocks held in this account.</p>
          </div>
        </header>
        <div className="news-list">
          {accountNews.map((item) => (
            <button className="news-item" type="button" key={`${item.index}-${item.headline || item.title}`} onClick={() => setSelectedArticle(item)}>
              <div className="news-meta">
                <span>{item.source || 'News'}</span>
                <span>{timeAgo(item.datetime)}</span>
                <span className={`sent-score ${item.sentiment}`}>{item.sentiment} {fmt(item.score, 1)}/10</span>
              </div>
              <strong>{item.headline || item.title}</strong>
              <div className="tag-row">
                {item.tickers.filter((ticker) => accountTickers.includes(ticker)).map((ticker) => <span key={ticker}>{ticker}</span>)}
              </div>
            </button>
          ))}
          {!accountNews.length && <div className="empty-state">No news matched this account's current holdings.</div>}
        </div>
      </section>

      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          tradeAccounts={accounts}
          defaultAccountId={selectedAccount.id}
          defaultTradeMode={tradeIntent}
          onExecuteTrade={executeStockModalTrade}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedArticle && <NewsArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </div>
  );
}
