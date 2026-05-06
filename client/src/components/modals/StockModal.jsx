import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../../data/market';
import { fmt, fmtPct, fmtPrice, timeAgo } from '../../utils/formatters';
import { classifySentiment, generateSignal, genSyntheticCandles } from '../../utils/indicators';
import { api } from '../../services/api';
import LineChart from '../charts/LineChart';
import AlertComposer from './AlertComposer';
import NewsArticleModal from './NewsArticleModal';
import WatchlistComposer from './WatchlistComposer';

function compactNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000000000) return `${fmt(number / 1000000000, 1)}B`;
  if (number >= 1000000) return `${fmt(number / 1000000, 1)}M`;
  if (number >= 1000) return `${fmt(number / 1000, 1)}K`;
  return fmt(number, 0);
}

function QuoteRange({ label, low, high, current }) {
  const span = Math.max(1, high - low);
  const pct = Math.min(100, Math.max(0, ((current - low) / span) * 100));
  return (
    <div className="quote-range-row">
      <span>{label}</span>
      <strong>{fmtPrice(low)}</strong>
      <span className="quote-range-track"><i style={{ left: `${pct}%` }} /></span>
      <strong>{fmtPrice(high)}</strong>
    </div>
  );
}

function FactorText({ text }) {
  const words = String(text).split(/(\s+)/);
  return (
    <>
      {words.map((word, index) => {
        const key = word.toLowerCase().replace(/[^a-z]/g, '');
        const tone = ['positive', 'bullish', 'above', 'up', 'supportive'].includes(key)
          ? 'pos'
          : ['negative', 'bearish', 'below', 'down', 'risk'].includes(key)
            ? 'neg'
            : ['neutral', 'mixed', 'hold'].includes(key)
              ? 'neu'
              : '';
        return <span className={tone ? `factor-word ${tone}` : ''} key={`${word}-${index}`}>{word}</span>;
      })}
    </>
  );
}

function getSavedPlan() {
  try {
    const storedUser = JSON.parse(localStorage.getItem('bb_user') || '{}');
    return localStorage.getItem('bb_plan') || storedUser.plan || 'free';
  } catch {
    return localStorage.getItem('bb_plan') || 'free';
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildBillyAnalysis({ ticker, quote, signal, newsSentiment, stockNews, info }) {
  const dayMove = Number(quote.dp || 0);
  const rsi = Number(signal.rsi || 50);
  const macd = Number(signal.macd?.macd || 0);
  const beta = Number(info?.beta || 1);
  const sentimentScore = newsSentiment === 'Bullish' ? 12 : newsSentiment === 'Bearish' ? -12 : 0;
  const signalScore = signal.signal === 'BUY' ? 20 : signal.signal === 'SELL' ? -20 : 0;
  const moveScore = dayMove >= 0 ? Math.min(12, dayMove * 2) : -Math.min(12, Math.abs(dayMove) * 2);
  const rsiScore = rsi < 30 ? 10 : rsi > 70 ? -10 : 2;
  const macdScore = macd > 0 ? 8 : macd < 0 ? -8 : 0;
  const riskAdjustment = beta > 1.35 ? -5 : beta < 0.85 ? 4 : 0;
  const newsDepth = Math.min(4, stockNews.length);
  const score = clampScore(50 + sentimentScore + signalScore + moveScore + rsiScore + macdScore + riskAdjustment + newsDepth);
  const recommendation = score >= 62 ? 'buy' : score <= 38 ? 'sell' : 'hold';
  const rationale = [
    `${ticker} composite confidence ${score}/100 with ${recommendation.toUpperCase()} bias.`,
    `Signal ${signal.signal}, RSI ${Number.isFinite(rsi) ? rsi.toFixed(1) : 'n/a'}, MACD ${Number.isFinite(macd) ? macd.toFixed(2) : 'n/a'}, SMA trend: ${signal.factors.slice(0, 2).join('; ') || 'mixed'}.`,
    `Quote move ${dayMove.toFixed(2)}%, beta ${beta.toFixed(2)}, last price ${Number(quote.c || 0).toFixed(2)}, previous close ${Number(quote.pc || 0).toFixed(2)}.`,
    `News sentiment ${newsSentiment || 'Neutral'} from ${stockNews.length} recent article${stockNews.length === 1 ? '' : 's'}.`,
  ].join(' ');

  return { score, recommendation, rationale };
}

export default function StockModal({
  ticker,
  quotes,
  fetchStockCandles,
  fetchCompanyNews,
  onClose,
  onTrade,
  tradeAccounts = [],
  defaultAccountId = '',
  defaultTradeMode = 'buy',
  onExecuteTrade,
  onExecuteBillyAnalyst,
}) {
  const info = STOCKS_BASE[ticker];
  const quote = useMemo(() => quotes[ticker] || {}, [quotes, ticker]);
  const [timeframe, setTimeframe] = useState('3M');
  const [chartData, setChartData] = useState(null);
  const [chartDates, setChartDates] = useState(null);
  const [dailyCloses, setDailyCloses] = useState(null);
  const [stockNews, setStockNews] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [showWatchlistComposer, setShowWatchlistComposer] = useState(false);
  const [tradeMode, setTradeMode] = useState(defaultTradeMode);
  const [accountId, setAccountId] = useState(defaultAccountId || tradeAccounts[0]?.id || '');
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [shares, setShares] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeStatus, setTradeStatus] = useState('');
  const [submittingTrade, setSubmittingTrade] = useState(false);
  const [billyConfig, setBillyConfig] = useState({
    initialFund: '',
    maxInvestmentDollars: '',
    maxInvestmentPercent: '',
    maxLossDollars: '',
    maxLossPercent: '',
    reinvestGains: false,
    confirmRisk: false,
  });

  useEffect(() => {
    setAccountId(defaultAccountId || tradeAccounts[0]?.id || '');
  }, [defaultAccountId, tradeAccounts]);

  useEffect(() => {
    setTradeMode(defaultTradeMode);
  }, [defaultTradeMode, ticker]);

  useEffect(() => {
    let cancelled = false;
    fetchStockCandles(ticker, '1Y').then((data) => {
      if (!cancelled) setDailyCloses(data?.c?.length ? data.c : genSyntheticCandles(ticker, quote.c || 100, 252));
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStockCandles, quote.c, ticker]);

  useEffect(() => {
    let cancelled = false;
    setChartData(null);
    fetchStockCandles(ticker, timeframe).then((data) => {
      if (cancelled) return;
      const closes = data?.c?.length ? data.c : genSyntheticCandles(ticker, quote.c || 100, 90);
      setChartData(closes);
      setChartDates(
        data?.t?.length === closes.length
          ? data.t.map((timestamp) => new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
          : null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStockCandles, quote.c, ticker, timeframe]);

  useEffect(() => {
    let cancelled = false;
    fetchCompanyNews(ticker).then((items) => {
      if (!cancelled) setStockNews(items);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCompanyNews, ticker]);

  const signal = useMemo(() => generateSignal(dailyCloses, quote.c, quote.pc), [dailyCloses, quote.c, quote.pc]);
  const newsSentiment = useMemo(() => {
    if (!stockNews.length) return null;
    const scores = stockNews.map((item) => classifySentiment(item.headline || item.title || '', item.summary || '').score);
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return avg > 6 ? 'Bullish' : avg < 4 ? 'Bearish' : 'Neutral';
  }, [stockNews]);
  const billyAnalysis = useMemo(
    () => buildBillyAnalysis({ ticker, quote, signal, newsSentiment, stockNews, info }),
    [ticker, quote, signal, newsSentiment, stockNews, info],
  );

  const selectedAccount = tradeAccounts.find((account) => account.id === accountId);
  const heldPosition = selectedAccount?.positions?.find((position) => position.ticker === ticker);
  const heldShares = Number(heldPosition?.shares || 0);
  const currentPrice = Number(quote.c || quote.pc || 100);
  const executionPrice = orderType === 'limit' ? Number(limitPrice) : Number(quote.c || 0);
  const shareCount = Number(shares || 0);
  const estimatedTotal = shareCount * executionPrice;
  const isPro = getSavedPlan() === 'pro';
  const isBillyMode = tradeMode === 'billy_analyst';
  const billyInitialFund = Number(billyConfig.initialFund || 0);
  const billyRiskLimitReady = Number(billyConfig.maxLossDollars || 0) > 0 || Number(billyConfig.maxLossPercent || 0) > 0;
  const billyDeployablePreview = Math.min(
    billyInitialFund || 0,
    Number(billyConfig.maxInvestmentDollars || billyInitialFund || 0) || billyInitialFund || 0,
    Number(billyConfig.maxInvestmentPercent || 0) > 0 ? billyInitialFund * (Number(billyConfig.maxInvestmentPercent) / 100) : billyInitialFund || 0,
    Number(selectedAccount?.balance || 0),
  );
  const canSubmitTrade = Boolean(onExecuteTrade)
    && !isBillyMode
    && accountId
    && shareCount > 0
    && executionPrice > 0
    && (tradeMode === 'buy' ? estimatedTotal <= Number(selectedAccount?.balance || 0) : shareCount <= heldShares);
  const canSubmitBilly = isBillyMode
    && isPro
    && accountId
    && currentPrice > 0
    && billyInitialFund > 0
    && billyRiskLimitReady
    && billyDeployablePreview > 0
    && billyConfig.confirmRisk;

  const submitTrade = async () => {
    if (isBillyMode) {
      if (!canSubmitBilly) return;
      setSubmittingTrade(true);
      setTradeError('');
      setTradeStatus('');
      try {
        const payload = {
          accountId,
          ticker,
          price: currentPrice,
          initialFund: billyInitialFund,
          maxInvestmentDollars: Number(billyConfig.maxInvestmentDollars || 0),
          maxInvestmentPercent: Number(billyConfig.maxInvestmentPercent || 0),
          maxLossDollars: Number(billyConfig.maxLossDollars || 0),
          maxLossPercent: Number(billyConfig.maxLossPercent || 0),
          reinvestGains: billyConfig.reinvestGains,
          confidence: billyAnalysis.score,
          recommendation: billyAnalysis.recommendation,
          rationale: billyAnalysis.rationale,
        };
        const data = onExecuteBillyAnalyst ? await onExecuteBillyAnalyst(payload) : await api.executeBillyAnalyst(payload);
        const action = data?.action?.action || billyAnalysis.recommendation;
        const status = data?.action?.status || 'monitoring';
        setTradeStatus(`Billy Analyst ${action.toUpperCase()} action created. Status: ${status}.`);
      } catch (err) {
        setTradeError(err.message || 'Billy Analyst action failed.');
      } finally {
        setSubmittingTrade(false);
      }
      return;
    }

    if (!canSubmitTrade) return;
    setSubmittingTrade(true);
    setTradeError('');
    setTradeStatus('');
    try {
      await onExecuteTrade({ mode: tradeMode, ticker, shares: shareCount, price: executionPrice, accountId, orderType });
      setShares('');
      setTradeStatus(`${tradeMode === 'buy' ? 'Buy' : 'Sell'} order completed.`);
    } catch (err) {
      setTradeError(err.message || 'Trade failed.');
    } finally {
      setSubmittingTrade(false);
    }
  };

  if (!info) return null;

  const profileSeed = ticker.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const marketCap = Number(quote.c || 100) * (profileSeed + 420) * 1000000;
  const sharesOutstanding = (marketCap / Number(quote.c || 1)) / 1000000000;
  const peRatio = 14 + (profileSeed % 28) + ((quote.dp || 0) / 10);
  const equityScore = Math.max(1, Math.min(10, 5 + (quote.dp || 0) / 3 + (info.beta || 1)));
  const dividend = info.sector === 'Technology' || info.sector === 'Semiconductors' ? 0.15 : (profileSeed % 90) / 100;
  const location = ['Cupertino, CA', 'Redmond, WA', 'New York, NY', 'Austin, TX', 'San Jose, CA'][profileSeed % 5];
  const exchange = ticker.length <= 4 ? 'NASDAQ-NMS' : 'NYSE';
  const bidPrice = currentPrice - Math.max(0.01, currentPrice * 0.000045);
  const askPrice = currentPrice + Math.max(0.01, currentPrice * 0.000045);
  const bidSize = 20 + (profileSeed % 140);
  const askSize = 15 + (profileSeed % 95);
  const volume = Number(quote.v || (profileSeed + 320) * 97321);
  const avgVolume10 = volume * (0.78 + (profileSeed % 16) / 100);
  const avgVolume90 = volume * (0.82 + (profileSeed % 20) / 100);
  const dayLow = Number(quote.l || currentPrice * 0.97);
  const dayHigh = Number(quote.h || currentPrice * 1.03);
  const yearLow = dailyCloses?.length ? Math.min(...dailyCloses) : currentPrice * 0.72;
  const yearHigh = dailyCloses?.length ? Math.max(...dailyCloses) : currentPrice * 1.24;
  const performanceRows = [
    ['5-day', 5],
    ['10-day', 10],
    ['1-month', 21],
    ['3-month', 63],
    ['6-month', 126],
    ['YTD', 160],
    ['1-year', 252],
  ].map(([label, lookback]) => {
    const base = dailyCloses?.[Math.max(0, dailyCloses.length - Number(lookback))] || quote.pc || quote.c || 1;
    return { label, pct: ((Number(quote.c || base) - base) / base) * 100 };
  });

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <section className="modal modal-wide modal-stock" onClick={(event) => event.stopPropagation()}>
          <header className="modal-header">
            <div className="ticker-cell">
              <div className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</div>
              <div>
                <h2>{ticker}</h2>
                <span>{info.name} - {info.sector}</span>
              </div>
            </div>
            <div className="modal-actions">
              {onTrade && <button className="secondary-button" type="button" onClick={() => onTrade('buy', ticker)}>Trade</button>}
              <button className="icon-btn watchlist-icon-btn" type="button" onClick={() => setShowWatchlistComposer(true)} aria-label="Add stock to watchlist">+</button>
              <button className="icon-btn alert-icon-btn" type="button" onClick={() => setShowAlertComposer(true)} aria-label="Create stock alert">!</button>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
            </div>
          </header>

          <div className="stock-modal-summary quote-hero">
            <div>
              <strong>{fmtPrice(quote.c)}</strong>
              <span className={(quote.dp || 0) >= 0 ? 'pos' : 'neg'}>{fmtPrice(Math.abs(quote.d || 0))} ({fmtPct(quote.dp || 0)}) today</span>
            </div>
            <div>
              <span className={`badge badge-${signal.signal.toLowerCase()}`}>{signal.signal}</span>
              <small>Confidence {signal.conf}%</small>
              {newsSentiment && <small>News {newsSentiment}</small>}
            </div>
          </div>

          <div className="stock-detail-layout">
            <section className="quote-panel chart-panel">
              <div className="chart-header">
                <span>Chart</span>
                <div className="segmented">
                  {['1W', '1M', '3M', '6M', '1Y'].map((item) => (
                    <button key={item} className={timeframe === item ? 'active' : ''} type="button" onClick={() => setTimeframe(item)}>{item}</button>
                  ))}
                </div>
              </div>
              <div className="chart-quote-row">
                <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>O: <strong>{fmtPrice(quote.o)}</strong></span>
                <span>H: <strong>{fmtPrice(quote.h)}</strong></span>
                <span>L: <strong>{fmtPrice(quote.l)}</strong></span>
                <span>C: <strong>{fmtPrice(quote.c)}</strong></span>
              </div>
              <LineChart data={chartData} dates={chartDates} color={(quote.dp || 0) >= 0 ? '#00c2a8' : '#ff4f7b'} height={270} />
              <div className="chart-range-actions">
                {['1D', '2D', '5D', '10D', '1M', '3M', '6M', 'YTD', '1Y', 'MAX'].map((item) => (
                  <button key={item} className={timeframe === item ? 'active' : ''} type="button" onClick={() => ['1M', '3M', '6M', '1Y'].includes(item) && setTimeframe(item)}>{item}</button>
                ))}
                <button type="button">Daily</button>
                <button type="button">Log</button>
                <button type="button">Ext</button>
              </div>
              <div className="quote-market-strip">
                <div><span>Bid x size (MEMX)</span><strong>{fmtPrice(bidPrice)} x {fmt(bidSize, 0)}</strong></div>
                <div><span>Volume</span><strong>{volume.toLocaleString()}</strong></div>
                <div><span>Ask x size (ARCX)</span><strong>{fmtPrice(askPrice)} x {fmt(askSize, 0)}</strong></div>
                <div><span>10/90-day avg. volume</span><strong>{compactNumber(avgVolume10)} / {compactNumber(avgVolume90)}</strong></div>
                <QuoteRange label="Day range" low={dayLow} high={dayHigh} current={currentPrice} />
                <QuoteRange label="52-week range" low={yearLow} high={yearHigh} current={currentPrice} />
              </div>
            </section>
            <section className="quote-panel price-performance">
              <header className="mini-panel-header"><h3>Price performance</h3><span>i</span></header>
              {performanceRows.map((row) => (
                <div key={row.label}><span>{row.label}</span><strong className={row.pct >= 0 ? 'pos' : 'neg'}>{fmtPct(row.pct)}</strong></div>
              ))}
            </section>
          </div>

          <div className="quote-info-grid">
            <section className="quote-panel detailed-quote">
              <header className="mini-panel-header"><h3>Detailed quote</h3></header>
              <div><span>Open</span><strong>{fmtPrice(quote.o)}</strong></div>
              <div><span>Previous close</span><strong>{fmtPrice(quote.pc)}</strong></div>
              <div><span>Equity Summary Score</span><strong className="score-badge">{fmt(equityScore, 1)}</strong></div>
              <div><span>P/E ratio</span><strong>{fmt(peRatio, 2)}</strong></div>
              <div><span>Current dividend/ex-date</span><strong>{fmtPrice(dividend)} / Mar-30-2026</strong></div>
              <div><span>Estimated distribution rate/yield</span><strong>{fmtPrice(dividend * 4)} / {fmtPct((dividend * 4 / Number(quote.c || 1)) * 100)}</strong></div>
              <div><span>Sector</span><strong>{info.sector}</strong></div>
              <div><span>Market cap.</span><strong>{marketCap > 200000000000 ? 'Mega Cap' : 'Large Cap'} ({fmtPrice(marketCap / 1000000000)}B)</strong></div>
              <div><span>Shares outstanding</span><strong>{fmt(sharesOutstanding, 1)}B</strong></div>
              <div><span>Index</span><strong>NASDAQ100, R1000, SP500</strong></div>
              <div><span>Primary exchange</span><strong>{exchange}</strong></div>
              <div><span>Instrument type</span><strong>Common Stock</strong></div>
            </section>
            <section className="quote-panel company-profile">
              <header className="mini-panel-header"><h3>Company profile</h3></header>
              <div><span>Sector</span><strong>{info.sector}</strong></div>
              <div><span>Company location</span><strong>{location}</strong></div>
              <p>{info.name} operates in the {info.sector.toLowerCase()} industry with a beta of {fmt(info.beta)}. This demo profile summarizes market exposure, quote behavior, and portfolio relevance using available app data.</p>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(info.name)}`} target="_blank" rel="noreferrer">Company research</a>
            </section>
            <section className="quote-panel events-card">
              <header className="mini-panel-header"><h3>Events</h3></header>
              <h4>Upcoming events</h4>
              <article><time><strong>JUN</strong><span>23</span></time><p>{ticker} to announce Q3 earnings (unconfirmed)</p></article>
              <article><time><strong>SEP</strong><span>21</span></time><p>{ticker} to announce Q4 earnings (unconfirmed)</p></article>
              <h4>Past events</h4>
              <article><time><strong>MAR</strong><span>30</span></time><p>{ticker} stock ex-dividend for {fmtPrice(dividend)} on 03/30/2026</p></article>
            </section>
          </div>

          <div className="indicator-grid stock-signal-row">
            <div><span>RSI 14</span><strong>{signal.rsi == null ? '-' : fmt(signal.rsi, 1)}</strong></div>
            <div><span>MACD</span><strong>{signal.macd == null ? '-' : fmt(signal.macd.macd, 2)}</strong></div>
            <div><span>SMA 20</span><strong>{signal.sma20 == null ? '-' : fmtPrice(signal.sma20)}</strong></div>
            <div><span>SMA 50</span><strong>{signal.sma50 == null ? '-' : fmtPrice(signal.sma50)}</strong></div>
            <div className="signal-factors compact-signal-factors">
              <span className="vertical-signal-label">Signal Factors</span>
              <ul>
                {signal.factors.slice(0, 3).map((factor) => <li key={factor}><FactorText text={factor} /></li>)}
              </ul>
            </div>
          </div>

          {onExecuteTrade && tradeAccounts.length > 0 && (
            <section className="stock-trade-panel">
              <header className="panel-header">
                <div>
                  <span className="section-eyebrow">Trade</span>
                  <h2>Buy or sell {ticker}</h2>
                  <p>Select an account, order type, and share quantity. Orders affect only the chosen account.</p>
                </div>
              </header>
              <div className="trade-controls-grid">
                <label className="form-field"><span>Action</span><select value={tradeMode} onChange={(event) => setTradeMode(event.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option>{isPro && <option value="billy_analyst">Trade with Billy Analyst</option>}</select></label>
                <label className="form-field"><span>Account</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{tradeAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} - {account.accountNumber}</option>)}</select></label>
                {!isBillyMode && (
                  <>
                    <label className="form-field"><span>Purchase option</span><select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option value="market">Market</option><option value="limit">Limit</option></select></label>
                    {orderType === 'limit' && <label className="form-field"><span>Limit price</span><input type="number" min="0.01" step="0.01" value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} /></label>}
                    <label className="form-field"><span>Stock amount</span><input type="number" min="0.001" step="0.001" value={shares} onChange={(event) => setShares(event.target.value)} placeholder="0.000" /></label>
                  </>
                )}
              </div>
              {isBillyMode ? (
                <div className="billy-analyst-panel">
                  <div className="billy-score-card">
                    <div>
                      <span>Billy Composite</span>
                      <strong>{billyAnalysis.score}/100</strong>
                    </div>
                    <span className={`billy-recommendation ${billyAnalysis.recommendation}`}>{billyAnalysis.recommendation}</span>
                  </div>
                  <p>{billyAnalysis.rationale}</p>
                  <div className="billy-analyst-grid">
                    <label className="form-field"><span>Initial bot fund</span><input type="number" min="1" step="1" value={billyConfig.initialFund} onChange={(event) => setBillyConfig((prev) => ({ ...prev, initialFund: event.target.value }))} placeholder="$" /></label>
                    <label className="form-field"><span>Max investment $</span><input type="number" min="0" step="1" value={billyConfig.maxInvestmentDollars} onChange={(event) => setBillyConfig((prev) => ({ ...prev, maxInvestmentDollars: event.target.value }))} placeholder="Optional" /></label>
                    <label className="form-field"><span>Max investment %</span><input type="number" min="0" max="100" step="0.1" value={billyConfig.maxInvestmentPercent} onChange={(event) => setBillyConfig((prev) => ({ ...prev, maxInvestmentPercent: event.target.value }))} placeholder="Optional" /></label>
                    <label className="form-field"><span>Max loss $</span><input type="number" min="0" step="1" value={billyConfig.maxLossDollars} onChange={(event) => setBillyConfig((prev) => ({ ...prev, maxLossDollars: event.target.value }))} placeholder="Required if no %" /></label>
                    <label className="form-field"><span>Max loss %</span><input type="number" min="0" max="100" step="0.1" value={billyConfig.maxLossPercent} onChange={(event) => setBillyConfig((prev) => ({ ...prev, maxLossPercent: event.target.value }))} placeholder="Required if no $" /></label>
                    <label className="check-row billy-toggle"><input type="checkbox" checked={billyConfig.reinvestGains} onChange={(event) => setBillyConfig((prev) => ({ ...prev, reinvestGains: event.target.checked }))} /><span>Reinvest capital gains into this Billy action</span></label>
                  </div>
                  <div className="trade-summary">
                    <div><span>Last price</span><strong>{fmtPrice(quote.c)}</strong></div>
                    <div><span>Deployable now</span><strong>{fmtPrice(billyDeployablePreview)}</strong></div>
                    <div><span>Account cash</span><strong>{fmtPrice(selectedAccount?.balance || 0)}</strong></div>
                    <div><span>Automated command</span><strong>{billyAnalysis.recommendation.toUpperCase()}</strong></div>
                  </div>
                  <div className="billy-risk-disclaimer">
                    <strong>Professional risk disclosure</strong>
                    <p>Billy Analyst is a simulated, rules-based automated trading workflow. Market prices, liquidity, execution quality, and news sentiment can change quickly; this feature can lose money, underperform the market, or liquidate positions when your loss thresholds are reached. This is not financial advice and does not guarantee gains.</p>
                    <label className="check-row"><input type="checkbox" checked={billyConfig.confirmRisk} onChange={(event) => setBillyConfig((prev) => ({ ...prev, confirmRisk: event.target.checked }))} /><span>I understand the risks and authorize Billy Analyst to follow these limits.</span></label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="trade-summary">
                    <div><span>Last price</span><strong>{fmtPrice(quote.c)}</strong></div>
                    <div><span>Execution price</span><strong>{fmtPrice(executionPrice)}</strong></div>
                    <div><span>Estimated total</span><strong>{fmtPrice(estimatedTotal)}</strong></div>
                    <div><span>Account cash</span><strong>{fmtPrice(selectedAccount?.balance || 0)}</strong></div>
                    <div><span>Shares held</span><strong>{fmt(heldShares, 4)}</strong></div>
                    <div><span>Sector</span><strong>{info.sector}</strong></div>
                  </div>
                  {tradeMode === 'buy' && estimatedTotal > Number(selectedAccount?.balance || 0) && <p className="status error">Insufficient cash in selected account.</p>}
                  {tradeMode === 'sell' && shareCount > heldShares && <p className="status error">Selected account does not hold enough shares.</p>}
                </>
              )}
              {isBillyMode && !billyRiskLimitReady && <p className="status error">Set a maximum loss in dollars, percentage, or both.</p>}
              {isBillyMode && billyInitialFund > Number(selectedAccount?.balance || 0) && <p className="status error">Initial bot fund exceeds liquid cash available in this Billy account.</p>}
              {tradeError && <p className="status error">{tradeError}</p>}
              {tradeStatus && <p className="status success">{tradeStatus}</p>}
              <button className={tradeMode === 'sell' ? 'sell-button full' : 'buy-button full'} type="button" disabled={(isBillyMode ? !canSubmitBilly : !canSubmitTrade) || submittingTrade} onClick={submitTrade}>
                {submittingTrade ? 'Submitting...' : isBillyMode ? 'Start Billy Analyst Action' : `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${shareCount > 0 ? fmt(shareCount, 4) : ''} shares`}
              </button>
            </section>
          )}

          <section className="modal-news">
            <span className="section-eyebrow">Related News</span>
            {stockNews.map((item) => (
              <article key={`${item.headline || item.title}-${item.datetime}`} onClick={() => setSelectedArticle(item)}>
                <div><span>{item.source || 'News'}</span><span>{timeAgo(item.datetime)}</span></div>
                <strong>{item.headline || item.title}</strong>
              </article>
            ))}
          </section>
        </section>
      </div>
      {showAlertComposer && (
        <AlertComposer
          marketData={{ quotes, fetchStockCandles, fetchCompanyNews }}
          initialTicker={ticker}
          onClose={() => setShowAlertComposer(false)}
        />
      )}
      {showWatchlistComposer && (
        <WatchlistComposer
          quotes={quotes}
          initialTicker={ticker}
          onClose={() => setShowWatchlistComposer(false)}
        />
      )}
      {selectedArticle && <NewsArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </>
  );
}
