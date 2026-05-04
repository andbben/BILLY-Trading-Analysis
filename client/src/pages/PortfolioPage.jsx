import { useEffect, useMemo, useState } from 'react';
import { PORTFOLIO_COLORS, STARTER_HOLDINGS, STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { computeRiskScore } from '../utils/indicators';
import { fmt, fmtPct, fmtPrice } from '../utils/formatters';
import RiskGauge from '../components/charts/RiskGauge';
import StockModal from '../components/modals/StockModal';
import TradeModal from '../components/modals/TradeModal';

function normalizePosition(position) {
  return {
    ticker: position.ticker,
    shares: Number(position.shares ?? position.quantity ?? 0),
    avgCost: Number(position.avg_cost ?? position.avgCost ?? position.purchase_price ?? 0),
  };
}

export default function PortfolioPage({ marketData }) {
  const [portfolio, setPortfolio] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [trade, setTrade] = useState(null);
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const loadPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolio(data.portfolio || { cash_balance: 50000 });
      setHoldings((data.positions || []).map(normalizePosition));
      setError('');
    } catch (err) {
      setPortfolio({ cash_balance: 50000 });
      setHoldings(STARTER_HOLDINGS);
      setError(`${err.message || 'Failed to load portfolio.'} Showing starter demo holdings.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const rows = useMemo(() => holdings.map((holding, index) => {
    const quote = quotes[holding.ticker] || {};
    const cur = Number(quote.c || 0);
    const val = cur * holding.shares;
    const costTotal = holding.avgCost * holding.shares;
    const gainLoss = val - costTotal;
    const gainLossPct = costTotal ? (gainLoss / costTotal) * 100 : 0;
    const dayGl = Number(quote.d || 0) * holding.shares;
    return {
      ...holding,
      q: quote,
      cur,
      val,
      costTotal,
      gainLoss,
      gainLossPct,
      dayGl,
      color: PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length],
    };
  }), [holdings, quotes]);

  const totalVal = rows.reduce((sum, row) => sum + row.val, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costTotal, 0);
  const totalGL = totalVal - totalCost;
  const totalPct = totalCost ? (totalGL / totalCost) * 100 : 0;
  const totalDayGL = rows.reduce((sum, row) => sum + row.dayGl, 0);
  const cash = Number(portfolio?.cash_balance ?? 50000);
  const riskScore = computeRiskScore(rows);
  const weightedBeta = rows.reduce((sum, row) => sum + (STOCKS_BASE[row.ticker]?.beta || 1) * (row.val / (totalVal || 1)), 0);

  const executeTrade = async ({ mode, ticker, shares, price }) => {
    const data = await api.executeTrade({ mode, ticker, shares, price });
    setPortfolio(data.portfolio);
    setHoldings((data.positions || []).map(normalizePosition));
    setTrade(null);
  };

  if (loading) return <div className="page"><p className="status">Loading portfolio...</p></div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Portfolio</span>
          <h1>Portfolio and risk workspace</h1>
          <p>{holdings.length} positions - live value, allocation, risk, and trading.</p>
        </div>
        <button type="button" onClick={() => setTrade({ mode: 'buy', ticker: null })}>Buy Stock</button>
      </header>

      {error && <p className="status warning">{error}</p>}

      <section className="stat-grid">
        <article className="stat-card"><span>Total Value</span><strong>{fmtPrice(totalVal)}</strong><em>live market value</em></article>
        <article className="stat-card"><span>Cash Available</span><strong className="pos">{fmtPrice(cash)}</strong><em>buying power</em></article>
        <article className="stat-card"><span>Total Gain / Loss</span><strong className={totalGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(totalGL)}</strong><em>{fmtPct(totalPct)} all-time</em></article>
        <article className="stat-card"><span>Day G/L</span><strong className={totalDayGL >= 0 ? 'pos' : 'neg'}>{fmtPrice(totalDayGL)}</strong><em>today</em></article>
      </section>

      <div className="two-column">
        <section className="panel">
          <header className="panel-header"><h2>Asset Allocation</h2></header>
          <div className="allocation-bar">
            {rows.map((row) => <i key={row.ticker} style={{ width: `${totalVal ? (row.val / totalVal) * 100 : 0}%`, background: row.color }} />)}
          </div>
          <div className="legend-grid">
            {rows.map((row) => <span key={row.ticker}><i style={{ background: row.color }} />{row.ticker} {totalVal ? fmt((row.val / totalVal) * 100, 1) : '0.0'}%</span>)}
          </div>
        </section>

        <section className="panel risk-panel">
          <header className="panel-header"><h2>Portfolio Risk Assessment</h2></header>
          <RiskGauge score={riskScore} />
          <div className="risk-factors">
            <div><span>Portfolio Beta</span><strong>{fmt(weightedBeta)}</strong></div>
            <div><span>Positions</span><strong>{holdings.length}</strong></div>
            <div><span>Sectors</span><strong>{new Set(holdings.map((item) => STOCKS_BASE[item.ticker]?.sector)).size}</strong></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel-header"><h2>Holdings</h2></header>
        <div className="data-table holdings-table">
          <div className="table-head">
            <span>Symbol</span><span>Shares</span><span>Avg Cost</span><span>Cur Price</span><span>Mkt Value</span><span>G/L</span><span>Actions</span>
          </div>
          {rows.map((row) => (
            <button className="table-row" type="button" key={row.ticker} onClick={() => setSelected(row.ticker)}>
              <span className="ticker-cell">
                <span className="ticker-logo" style={{ background: row.color }}>{row.ticker.slice(0, 2)}</span>
                <span><strong>{row.ticker}</strong><small>{STOCKS_BASE[row.ticker]?.name}</small></span>
              </span>
              <span className="mono">{fmt(row.shares, row.shares % 1 === 0 ? 0 : 4)}</span>
              <span className="mono">{fmtPrice(row.avgCost)}</span>
              <span className="mono">{fmtPrice(row.cur)}</span>
              <span className="mono">{fmtPrice(row.val)}</span>
              <span className={row.gainLoss >= 0 ? 'pos mono' : 'neg mono'}>{fmtPct(row.gainLossPct)}</span>
              <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                <button className="buy-button" type="button" onClick={() => setTrade({ mode: 'buy', ticker: row.ticker })}>Buy</button>
                <button className="sell-button" type="button" onClick={() => setTrade({ mode: 'sell', ticker: row.ticker })}>Sell</button>
              </span>
            </button>
          ))}
          {!rows.length && <div className="empty-state">No positions yet. Use Buy Stock to get started.</div>}
        </div>
      </section>

      {trade && (
        <TradeModal
          mode={trade.mode}
          ticker={trade.ticker}
          quotes={quotes}
          holdings={holdings}
          balance={cash}
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
          onTrade={(mode, ticker) => { setSelected(null); setTrade({ mode, ticker }); }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
