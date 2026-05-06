import { useEffect, useMemo, useState } from 'react';
import { PORTFOLIO_COLORS, STARTER_HOLDINGS, STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { classifySentiment, computeRiskScore } from '../utils/indicators';
import { fmt, fmtPct, fmtPrice, timeAgo } from '../utils/formatters';
import RiskGauge from '../components/charts/RiskGauge';
import Sparkline from '../components/charts/Sparkline';
import NewsArticleModal from '../components/modals/NewsArticleModal';
import StockModal from '../components/modals/StockModal';
import TradeModal from '../components/modals/TradeModal';

const DIVERSITY_COLORS = {
  domestic: '#2f8f25',
  foreign: '#2457a7',
  bonds: '#b7791f',
  shortTerm: '#6b7280',
  other: '#7c5cfc',
  unknown: '#9ca3af',
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

export default function PortfolioPage({ marketData }) {
  const [accounts, setAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showBanks, setShowBanks] = useState(false);
  const [showMoreHoldings, setShowMoreHoldings] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [trade, setTrade] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assetTransfers, setAssetTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const loadPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      const billyAccounts = (data.billyAccounts || []).map(normalizeAccount);
      setAccounts(billyAccounts);
      setBankAccounts((data.accounts || []).filter((account) => account.type === 'bank'));
      setSelectedAccountId((current) => current || billyAccounts[0]?.id || '');
      setOrders(data.orders || []);
      setTransfers(data.transfers || []);
      setAssetTransfers(data.assetTransfers || []);
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
      setSelectedAccountId(fallback.id);
      setError(`${err.message || 'Failed to load portfolio.'} Showing starter demo holdings.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const allRows = useMemo(() => accounts.flatMap((account) => accountRows(account, quotes).map((row) => ({ ...row, account }))), [accounts, quotes]);
  const totalVal = allRows.reduce((sum, row) => sum + row.val, 0);
  const cash = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const totalCost = allRows.reduce((sum, row) => sum + row.costTotal, 0);
  const totalGL = totalVal - totalCost;
  const totalPct = totalCost ? (totalGL / totalCost) * 100 : 0;
  const totalDayGL = allRows.reduce((sum, row) => sum + row.dayGl, 0);
  const riskScore = computeRiskScore(allRows);
  const weightedBeta = allRows.reduce((sum, row) => sum + (STOCKS_BASE[row.ticker]?.beta || 1) * (row.val / (totalVal || 1)), 0);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const selectedStats = accountStats(selectedAccount, quotes);
  const selectedAccountTickers = (selectedAccount?.positions || []).map((position) => position.ticker);
  const accountNews = (marketData.news || [])
    .map((item, index) => {
      const sentiment = classifySentiment(item.headline || item.title || '', item.summary || '');
      const tickers = relatedTickers(item);
      return { ...item, ...sentiment, tickers, index };
    })
    .filter((item) => item.tickers.some((ticker) => selectedAccountTickers.includes(ticker)))
    .slice(0, 6);
  const topActive = [...allRows].sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct)).slice(0, showMoreHoldings ? 10 : 5);
  const diversity = diversityBreakdown(accounts, quotes);

  const executeTrade = async ({ mode, ticker, shares, price }) => {
    await api.executeTrade({ mode, ticker, shares, price, accountId: trade?.accountId || selectedAccount?.id });
    await loadPortfolio();
    setTrade(null);
  };

  if (loading) return <div className="page"><p className="status">Loading portfolio...</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Portfolio</span>
          <h1>Portfolio & Risk Overview</h1>
          <p>{accounts.length} Billy accounts - combined account value, allocation, risk, and trading.</p>
        </div>
        <button type="button" onClick={() => setTrade({ mode: 'buy', ticker: null, accountId: selectedAccount?.id })}>Buy Stock</button>
      </header>

      {error && <p className="status warning">{error}</p>}

      <section className="stat-grid">
        <article className="stat-card"><span>Total Value</span><strong>{fmtPrice(totalVal + cash)}</strong><em>cash plus holdings</em></article>
        <article className="stat-card"><span>Cash Available</span><strong className="pos">{fmtPrice(cash)}</strong><em>combined buying power</em></article>
        <article className="stat-card"><span>Total Gain / Loss</span><strong className={totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(totalGL)}</strong><em>{fmtPct(totalPct)} all-time</em></article>
        <article className="stat-card"><span>Day G/L</span><strong className={totalDayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(totalDayGL)}</strong><em>across accounts</em></article>
      </section>

      <div className="two-column">
        <section className="panel">
          <header className="panel-header"><h2>Account Diversity</h2></header>
          <AllocationPie breakdown={diversity} />
        </section>
        <section className="panel risk-panel">
          <header className="panel-header"><h2>Portfolio Risk Assessment</h2></header>
          <RiskGauge score={riskScore} />
          <div className="risk-factors">
            <div><span>Portfolio Beta</span><strong>{fmt(weightedBeta)}</strong></div>
            <div><span>Accounts</span><strong>{accounts.length}</strong></div>
            <div><span>Sectors</span><strong>{new Set(allRows.map((item) => STOCKS_BASE[item.ticker]?.sector)).size}</strong></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel-header">
          <div><h2>Accounts</h2><p>Select an account to view all holdings and account-specific risk.</p></div>
          <button className="secondary-button" type="button" onClick={() => setShowBanks((value) => !value)}>
            {showBanks ? 'Hide bank accounts' : 'View bank accounts'}
          </button>
        </header>
        <div className="data-table accounts-table">
          <div className="table-head"><span>Account</span><span>Type</span><span>Cash</span><span>Total Value</span><span>Positions</span></div>
          {[...accounts, ...(showBanks ? bankAccounts : [])].map((account) => (
            <button className="table-row" type="button" key={account.id} onClick={() => account.type === 'billy' && setSelectedAccountId(account.id)}>
              <span><strong>{account.label}</strong><small>{account.accountNumber ? `Account ${account.accountNumber}` : 'Connected bank'}</small></span>
              <span>{account.type === 'bank' ? 'Bank' : account.source === 'portfolio' ? 'Primary Billy' : 'Billy'}</span>
              <span className="mono">{fmtPrice(account.balance || 0)}</span>
              <span className="mono">{account.type === 'bank' ? fmtPrice(account.balance || 0) : fmtPrice(accountValue(account, quotes))}</span>
              <span>{account.positions?.length || 0}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><h2>Most Active Holdings</h2><p>Top movers across all Billy accounts.</p></div>
          <button className="secondary-button" type="button" onClick={() => setShowMoreHoldings((value) => !value)}>
            {showMoreHoldings ? 'Show top 5' : 'Show next 5'}
          </button>
        </header>
        <div className="data-table active-holdings-table">
          <div className="table-head"><span>Holding</span><span>Account</span><span>Last</span><span>Day G/L</span><span>Value</span><span>Actions</span></div>
          {topActive.map((row) => (
            <button className="table-row" type="button" key={`${row.account.id}-${row.ticker}`} onClick={() => setSelected(row.ticker)}>
              <span className="ticker-cell"><span className="ticker-logo" style={{ background: row.color }}>{row.ticker.slice(0, 2)}</span><span><strong>{row.ticker}</strong><small>{STOCKS_BASE[row.ticker]?.name}</small></span></span>
              <span>{row.account.label}</span>
              <span className="mono">{fmtPrice(row.cur)} ({fmtPct(row.dayPct)})</span>
              <span className={row.dayGl >= 0 ? 'pos mono' : 'neg mono'}>{fmtPrice(row.dayGl)}</span>
              <span className="mono">{fmtPrice(row.val)}</span>
              <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                <button className="buy-button" type="button" onClick={() => setTrade({ mode: 'buy', ticker: row.ticker, accountId: row.account.id })}>Buy</button>
                <button className="sell-button" type="button" onClick={() => setTrade({ mode: 'sell', ticker: row.ticker, accountId: row.account.id })}>Sell</button>
              </span>
            </button>
          ))}
          {!topActive.length && <div className="empty-state">No active holdings yet.</div>}
        </div>
      </section>

      {selectedAccount && (
        <section className="panel account-workspace">
          <header className="panel-header">
            <div>
              <span className="section-eyebrow">{selectedAccount.label}</span>
              <h2>Account Summary</h2>
              <p>Account {selectedAccount.accountNumber} - balance, risk, and all positions.</p>
            </div>
          </header>
          <Sparkline data={accountSeries(selectedAccount, quotes)} color="#2f8f25" height={120} />
          <section className="stat-grid">
            <article className="stat-card"><span>Total Value</span><strong>{fmtPrice(selectedStats.accountTotal)}</strong><em>cash plus positions</em></article>
            <article className="stat-card"><span>Cash Available</span><strong>{fmtPrice(selectedStats.cash)}</strong><em>buying power</em></article>
            <article className="stat-card"><span>Total Gain / Loss</span><strong className={selectedStats.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(selectedStats.totalGL)}</strong><em>{fmtPct(selectedStats.totalPct)}</em></article>
            <article className="stat-card"><span>Day G/L</span><strong className={selectedStats.dayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(selectedStats.dayGL)}</strong><em>{fmtPct(selectedStats.dayPct)}</em></article>
          </section>
          <div className="two-column">
            <section className="account-inner-panel"><header className="panel-header"><h2>Account Diversity</h2></header><AllocationPie breakdown={diversityBreakdown([selectedAccount], quotes)} /></section>
            <section className="account-inner-panel"><header className="panel-header"><h2>Account Risk Assessment</h2></header><RiskGauge score={computeRiskScore(selectedStats.rows)} /></section>
          </div>
          <section className="positions-list">
            {selectedStats.rows.map((row) => {
              const accountPct = selectedStats.accountTotal ? (row.val / selectedStats.accountTotal) * 100 : 0;
              return (
                <article className="position-entry" key={row.ticker}>
                  <div className="position-entry-title">
                    <span className="ticker-logo" style={{ background: row.color }}>{row.ticker.slice(0, 2)}</span>
                    <span><strong>{row.ticker}</strong><small>{STOCKS_BASE[row.ticker]?.name}</small></span>
                    <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="buy-button" type="button" onClick={() => setTrade({ mode: 'buy', ticker: row.ticker, accountId: selectedAccount.id })}>Buy</button>
                      <button className="sell-button" type="button" onClick={() => setTrade({ mode: 'sell', ticker: row.ticker, accountId: selectedAccount.id })}>Sell</button>
                    </span>
                  </div>
                  <div className="position-metrics">
                    <span>Last <strong>{fmtPrice(row.cur)}</strong></span>
                    <span>Last change <strong className={row.dayPct >= 0 ? 'pos' : 'neg'}>{fmtPct(row.dayPct)}</strong></span>
                    <span>Today $ <strong className={row.dayGl >= 0 ? 'pos' : 'neg'}>{fmtPrice(row.dayGl)}</strong></span>
                    <span>Today % <strong className={row.dayPct >= 0 ? 'pos' : 'neg'}>{fmtPct(row.dayPct)}</strong></span>
                    <span>Total $ <strong className={row.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(row.totalGL)}</strong></span>
                    <span>Total % <strong className={row.totalPct >= 0 ? 'pos' : 'neg'}>{fmtPct(row.totalPct)}</strong></span>
                    <span>Current value <strong>{fmtPrice(row.val)}</strong></span>
                    <span>% of account <strong>{fmtPct(accountPct)}</strong></span>
                    <span>Shares <strong>{fmt(row.shares, 4)}</strong></span>
                    <span>Avg cost <strong>{fmtPrice(row.avgCost)}</strong></span>
                    <span className="wide">52 week range <RangeIndicator low={row.low52} high={row.high52} current={row.cur} /></span>
                  </div>
                </article>
              );
            })}
            <article className="position-entry totals-entry">
              <strong>Account totals</strong>
              <div className="position-metrics">
                <span>Today $ <strong className={selectedStats.dayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(selectedStats.dayGL)}</strong></span>
                <span>Today % <strong className={selectedStats.dayPct >= 0 ? 'pos' : 'neg'}>{fmtPct(selectedStats.dayPct)}</strong></span>
                <span>Total $ <strong className={selectedStats.totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(selectedStats.totalGL)}</strong></span>
                <span>Total % <strong className={selectedStats.totalPct >= 0 ? 'pos' : 'neg'}>{fmtPct(selectedStats.totalPct)}</strong></span>
                <span>Current value <strong>{fmtPrice(selectedStats.accountTotal)}</strong></span>
              </div>
            </article>
          </section>
          <section className="account-news">
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
                    {item.tickers.filter((ticker) => selectedAccountTickers.includes(ticker)).map((ticker) => <span key={ticker}>{ticker}</span>)}
                  </div>
                </button>
              ))}
              {!accountNews.length && <div className="empty-state">No news matched this account's current holdings.</div>}
            </div>
          </section>
        </section>
      )}

      <section className="panel">
        <header className="panel-header">
          <div><h2>Portfolio Notifications</h2><p>Stock order activity and cash/share transfer status for this portfolio.</p></div>
        </header>
        <div className="two-column">
          <div className="activity-list">
            <h3>Stock Orders</h3>
            {orders.map((order) => (
              <article className="transfer-row" key={order.id}>
                <span><strong>{String(order.trade_type || '').toUpperCase()} {order.ticker}</strong><small>{order.created_at ? new Date(order.created_at).toLocaleString() : 'Current session'}</small></span>
                <span className="mono">{fmt(order.shares, 4)} @ {fmtPrice(order.price)}</span>
                <span className="status-pill active">completed</span>
              </article>
            ))}
            {!orders.length && <div className="empty-state">No stock order notifications yet.</div>}
          </div>
          <div className="activity-list">
            <h3>Cash and Share Transfers</h3>
            {[...transfers, ...assetTransfers].map((item) => (
              <article className="transfer-row" key={`${item.ticker || item.transfer_type}-${item.id}`}>
                <span><strong>{item.from_label || item.from_account}</strong><small>to {item.to_label || item.to_account}</small></span>
                <span className="mono">{item.ticker ? `${item.ticker} ${fmt(item.shares, 4)}` : fmtPrice(item.amount)}</span>
                <span className={`status-pill ${item.status === 'completed' || item.status === 'active' ? 'active' : 'inactive'}`}>{item.status}</span>
              </article>
            ))}
            {!transfers.length && !assetTransfers.length && <div className="empty-state">No transfer notifications yet.</div>}
          </div>
        </div>
      </section>

      {trade && (
        <TradeModal
          mode={trade.mode}
          ticker={trade.ticker}
          quotes={quotes}
          holdings={(accounts.find((account) => account.id === trade.accountId)?.positions || selectedAccount?.positions || []).map(normalizePosition)}
          balance={Number((accounts.find((account) => account.id === trade.accountId) || selectedAccount)?.balance || 0)}
          onClose={() => setTrade(null)}
          onConfirm={executeTrade}
        />
      )}
      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          onTrade={(mode, ticker) => { setSelected(null); setTrade({ mode, ticker, accountId: selectedAccount?.id }); }}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedArticle && <NewsArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </div>
  );
}
