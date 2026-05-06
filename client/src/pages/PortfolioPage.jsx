import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PORTFOLIO_COLORS, STARTER_HOLDINGS, STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { computeRiskScore } from '../utils/indicators';
import { fmt, fmtPct, fmtPrice } from '../utils/formatters';
import RiskGauge from '../components/charts/RiskGauge';
import Sparkline from '../components/charts/Sparkline';
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

export default function PortfolioPage({ marketData }) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showBanks, setShowBanks] = useState(false);
  const [showMoreHoldings, setShowMoreHoldings] = useState(false);
  const [accountSetupMode, setAccountSetupMode] = useState(null);
  const [newBillyLabel, setNewBillyLabel] = useState('');
  const [bankDraft, setBankDraft] = useState({
    accountName: '',
    institutionName: '',
    accountType: 'Checking',
    routingNumber: '',
    accountNumber: '',
    agreements: {
      ownership: false,
      fdic: false,
      ach: false,
      privacy: false,
    },
  });
  const [accountSetupStatus, setAccountSetupStatus] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assetTransfers, setAssetTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const loadPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      const billyAccounts = (data.billyAccounts || []).map(normalizeAccount);
      setAccounts(billyAccounts);
      setBankAccounts((data.accounts || []).filter((account) => account.type === 'bank'));
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
      setError(`${err.message || 'Failed to load portfolio.'} Showing starter demo holdings.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    const stock = searchParams.get('stock');
    if (stock && STOCKS_BASE[stock]) setSelected(stock);
  }, [searchParams]);

  const allRows = useMemo(() => accounts.flatMap((account) => accountRows(account, quotes).map((row) => ({ ...row, account }))), [accounts, quotes]);
  const totalVal = allRows.reduce((sum, row) => sum + row.val, 0);
  const cash = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const totalCost = allRows.reduce((sum, row) => sum + row.costTotal, 0);
  const totalGL = totalVal - totalCost;
  const totalPct = totalCost ? (totalGL / totalCost) * 100 : 0;
  const totalDayGL = allRows.reduce((sum, row) => sum + row.dayGl, 0);
  const riskScore = computeRiskScore(allRows);
  const weightedBeta = allRows.reduce((sum, row) => sum + (STOCKS_BASE[row.ticker]?.beta || 1) * (row.val / (totalVal || 1)), 0);
  const topActive = [...allRows].sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct)).slice(0, showMoreHoldings ? 10 : 5);
  const diversity = diversityBreakdown(accounts, quotes);

  const portfolioSeries = useMemo(() => {
    const value = Math.max(1, totalVal + cash);
    return [0.965, 0.979, 0.991, 1.002, 0.996, 1.011, 1].map((factor) => value * factor);
  }, [cash, totalVal]);

  const executeStockModalTrade = async ({ mode, ticker, shares, price, accountId, orderType }) => {
    await api.executeTrade({ mode, ticker, shares, price, accountId, orderType });
    await loadPortfolio();
  };

  const openBillyAccount = async () => {
    try {
      await api.createBillyAccount({ label: newBillyLabel });
      setNewBillyLabel('');
      setAccountSetupMode(null);
      setAccountSetupStatus('New Billy account opened.');
      await loadPortfolio();
    } catch (err) {
      setError(err.message || 'Failed to open Billy account.');
    }
  };

  const connectBankAccount = async () => {
    try {
      await api.connectBankAccount(bankDraft);
      setBankDraft({
        accountName: '',
        institutionName: '',
        accountType: 'Checking',
        routingNumber: '',
        accountNumber: '',
        agreements: { ownership: false, fdic: false, ach: false, privacy: false },
      });
      setAccountSetupMode(null);
      setAccountSetupStatus('Bank account connected for demo transfers.');
      await loadPortfolio();
    } catch (err) {
      setError(err.message || 'Failed to connect bank account.');
    }
  };

  const updateAgreement = (key, checked) => {
    setBankDraft((draft) => ({
      ...draft,
      agreements: { ...draft.agreements, [key]: checked },
    }));
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
      </header>

      {error && <p className="status warning">{error}</p>}
      {accountSetupStatus && <p className="status success">{accountSetupStatus}</p>}

      <section className="panel portfolio-summary-chart">
        <header className="panel-header">
          <div>
            <h2>Portfolio Summary</h2>
            <p>Combined account value trend across Billy accounts.</p>
          </div>
        </header>
        <Sparkline data={portfolioSeries} color="#2f8f25" height={130} />
      </section>

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
          <div><h2>Accounts</h2><p>Select a Billy account to view all holdings and account-specific risk.</p></div>
          <button className="secondary-button" type="button" onClick={() => setShowBanks((value) => !value)}>
            {showBanks ? 'Hide bank accounts' : 'View bank accounts'}
          </button>
        </header>
        <div className="data-table accounts-table">
          <div className="table-head"><span>Account</span><span>Type</span><span>Cash</span><span>Total Value</span><span>Positions</span></div>
          {[...accounts, ...(showBanks ? bankAccounts : [])].map((account) => (
            <button
              className="table-row"
              type="button"
              key={account.id}
              onClick={() => account.type === 'billy' && navigate(`/portfolio/accounts/${encodeURIComponent(account.id)}`)}
            >
              <span><strong>{account.label}</strong><small>{account.accountNumber ? `Account ${account.accountNumber}` : 'Connected bank'}</small></span>
              <span>{account.type === 'bank' ? 'Bank' : account.source === 'portfolio' ? 'Primary Billy' : 'Billy'}</span>
              <span className="mono">{account.type === 'bank' ? 'Hidden' : fmtPrice(account.balance || 0)}</span>
              <span className="mono">{account.type === 'bank' ? 'Connected' : fmtPrice(accountValue(account, quotes))}</span>
              <span>{account.positions?.length || 0}</span>
            </button>
          ))}
        </div>
        <div className="account-setup-actions">
          <button className="secondary-button" type="button" onClick={() => setAccountSetupMode('billy')}>Open new Billy account</button>
          <button className="secondary-button" type="button" onClick={() => setAccountSetupMode('bank')}>Connect bank account</button>
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
          <div className="table-head"><span>Holding</span><span>Account</span><span>Last</span><span>Day G/L</span><span>Value</span><span>Day Range</span></div>
          {topActive.map((row) => (
            <button className="table-row" type="button" key={`${row.account.id}-${row.ticker}`} onClick={() => setSelected(row.ticker)}>
              <span className="ticker-cell"><span className="ticker-logo" style={{ background: row.color }}>{row.ticker.slice(0, 2)}</span><span><strong>{row.ticker}</strong><small>{STOCKS_BASE[row.ticker]?.name}</small></span></span>
              <span>{row.account.label}</span>
              <span className="mono">{fmtPrice(row.cur)} ({fmtPct(row.dayPct)})</span>
              <span className={row.dayGl >= 0 ? 'pos mono' : 'neg mono'}>{fmtPrice(row.dayGl)}</span>
              <span className="mono">{fmtPrice(row.val)}</span>
              <RangeIndicator low={row.low52} high={row.high52} current={row.cur} />
            </button>
          ))}
          {!topActive.length && <div className="empty-state">No active holdings yet.</div>}
        </div>
      </section>

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

      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          tradeAccounts={accounts}
          defaultAccountId={accounts[0]?.id}
          onExecuteTrade={executeStockModalTrade}
          onClose={() => { setSelected(null); setSearchParams({}); }}
        />
      )}

      {accountSetupMode === 'billy' && (
        <div className="overlay" onClick={() => setAccountSetupMode(null)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="section-eyebrow">Billy account</span>
                <h2>Open a new account</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setAccountSetupMode(null)} aria-label="Close">x</button>
            </header>
            <label className="form-field">
              <span>Account name</span>
              <input type="text" value={newBillyLabel} onChange={(event) => setNewBillyLabel(event.target.value)} placeholder="Billy Income Account" />
            </label>
            <p className="form-hint">This opens an empty Billy account with no positions and zero cash until funded.</p>
            <button type="button" onClick={openBillyAccount}>Open account</button>
          </section>
        </div>
      )}

      {accountSetupMode === 'bank' && (
        <div className="overlay" onClick={() => setAccountSetupMode(null)}>
          <section className="modal modal-bank-connect" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="section-eyebrow">Bank connection</span>
                <h2>Connect a bank account</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setAccountSetupMode(null)} aria-label="Close">x</button>
            </header>
            <div className="trade-controls-grid">
              <label className="form-field">
                <span>Account name</span>
                <input type="text" value={bankDraft.accountName} onChange={(event) => setBankDraft({ ...bankDraft, accountName: event.target.value })} placeholder="Primary Checking" />
              </label>
              <label className="form-field">
                <span>Bank or institution</span>
                <input type="text" value={bankDraft.institutionName} onChange={(event) => setBankDraft({ ...bankDraft, institutionName: event.target.value })} placeholder="Example National Bank" />
              </label>
              <label className="form-field">
                <span>Account type</span>
                <select value={bankDraft.accountType} onChange={(event) => setBankDraft({ ...bankDraft, accountType: event.target.value })}>
                  <option>Checking</option>
                  <option>Savings</option>
                  <option>Money Market</option>
                </select>
              </label>
              <label className="form-field">
                <span>Routing number</span>
                <input type="text" inputMode="numeric" value={bankDraft.routingNumber} onChange={(event) => setBankDraft({ ...bankDraft, routingNumber: event.target.value })} placeholder="021000021" />
              </label>
              <label className="form-field">
                <span>Account number</span>
                <input type="text" inputMode="numeric" value={bankDraft.accountNumber} onChange={(event) => setBankDraft({ ...bankDraft, accountNumber: event.target.value })} placeholder="000123456789" />
              </label>
            </div>
            <div className="agreement-list">
              <label className="check-row"><input type="checkbox" checked={bankDraft.agreements.ownership} onChange={(event) => updateAgreement('ownership', event.target.checked)} /><span>I certify I own or am authorized to use this bank account.</span></label>
              <label className="check-row"><input type="checkbox" checked={bankDraft.agreements.fdic} onChange={(event) => updateAgreement('fdic', event.target.checked)} /><span>I acknowledge FDIC coverage depends on the receiving banking institution and account registration.</span></label>
              <label className="check-row"><input type="checkbox" checked={bankDraft.agreements.ach} onChange={(event) => updateAgreement('ach', event.target.checked)} /><span>I authorize simulated ACH/EFT verification and transfer instructions for this demo app.</span></label>
              <label className="check-row"><input type="checkbox" checked={bankDraft.agreements.privacy} onChange={(event) => updateAgreement('privacy', event.target.checked)} /><span>I consent to storing masked banking details for demonstration purposes.</span></label>
            </div>
            <button type="button" onClick={connectBankAccount}>Connect bank</button>
          </section>
        </div>
      )}
    </div>
  );
}
