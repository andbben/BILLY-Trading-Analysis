import { useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { fmtPct, fmtPrice } from '../utils/formatters';
import Sparkline from '../components/charts/Sparkline';
import StockModal from '../components/modals/StockModal';

export default function MoversPage({ marketData }) {
  const [movement, setMovement] = useState('most-active');
  const [session, setSession] = useState('standard');
  const [selected, setSelected] = useState(null);
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;

  const rows = useMemo(() => Object.keys(STOCKS_BASE)
    .map((ticker) => {
      const quote = quotes[ticker] || {};
      const afterHoursLift = session === 'post-market' ? ((STOCKS_BASE[ticker].beta || 1) * 0.21) : 0;
      return { ticker, quote, move: Number(quote.dp || 0) + afterHoursLift, active: Math.abs(quote.dp || 0) + (STOCKS_BASE[ticker].beta || 1) };
    })
    .sort((a, b) => {
      if (movement === 'gainers') return b.move - a.move;
      if (movement === 'losers') return a.move - b.move;
      return b.active - a.active;
    }), [movement, quotes, session]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Movers</span>
          <h1>Market Movers</h1>
          <p>Filter top activity by movement type and trading session.</p>
        </div>
      </header>
      <section className="panel">
        <div className="inline-controls">
          <label className="form-field"><span>Movement</span><select value={movement} onChange={(event) => setMovement(event.target.value)}><option value="most-active">Most Active</option><option value="gainers">Gainers</option><option value="losers">Losers</option></select></label>
          <label className="form-field"><span>Session</span><select value={session} onChange={(event) => setSession(event.target.value)}><option value="standard">Standard Market Hours</option><option value="post-market">Post-Market</option></select></label>
        </div>
      </section>
      <section className="panel">
        <div className="data-table stock-table">
          <div className="table-head"><span>Symbol</span><span>Price</span><span>Change</span><span>High / Low</span><span>Signal</span><span>Daily Chart</span></div>
          {rows.map(({ ticker, quote, move }) => {
            const info = STOCKS_BASE[ticker];
            const up = move >= 0;
            const signal = move > 2 ? 'BUY' : move < -2 ? 'SELL' : 'HOLD';
            return (
              <button className="table-row kelly-bordered" type="button" key={ticker} onClick={() => setSelected(ticker)}>
                <span className="ticker-cell"><span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span><span><strong>{ticker}</strong><small>{info.name}</small></span></span>
                <span className="mono">{fmtPrice(quote.c)}</span>
                <span className={up ? 'pos mono' : 'neg mono'}>{fmtPct(move)}</span>
                <span className="mono muted">{fmtPrice(quote.h)} / {fmtPrice(quote.l)}</span>
                <span><i className={`badge badge-${signal.toLowerCase()}`}>{signal}</i></span>
                <Sparkline data={[quote.o || quote.c * 0.99, quote.l || quote.c * 0.98, quote.h || quote.c * 1.01, quote.c].filter(Boolean)} color={up ? '#00c2a8' : '#ff4f7b'} height={34} />
              </button>
            );
          })}
        </div>
      </section>
      {selected && <StockModal ticker={selected} quotes={quotes} fetchStockCandles={fetchStockCandles} fetchCompanyNews={fetchCompanyNews} onClose={() => setSelected(null)} />}
    </div>
  );
}
