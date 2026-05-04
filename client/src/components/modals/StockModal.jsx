import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../../data/market';
import { fmt, fmtPct, fmtPrice, timeAgo } from '../../utils/formatters';
import { classifySentiment, generateSignal, genSyntheticCandles } from '../../utils/indicators';
import LineChart from '../charts/LineChart';
import NewsArticleModal from './NewsArticleModal';

export default function StockModal({ ticker, quotes, fetchStockCandles, fetchCompanyNews, onClose, onTrade }) {
  const info = STOCKS_BASE[ticker];
  const quote = quotes[ticker] || {};
  const [timeframe, setTimeframe] = useState('3M');
  const [chartData, setChartData] = useState(null);
  const [chartDates, setChartDates] = useState(null);
  const [dailyCloses, setDailyCloses] = useState(null);
  const [stockNews, setStockNews] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchStockCandles(ticker, '1Y').then((data) => {
      if (cancelled) return;
      setDailyCloses(data?.c?.length ? data.c : genSyntheticCandles(ticker, quote.c || 100, 252));
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

  const signal = useMemo(
    () => generateSignal(dailyCloses, quote.c, quote.pc),
    [dailyCloses, quote.c, quote.pc],
  );

  const newsSentiment = useMemo(() => {
    if (!stockNews.length) return null;
    const scores = stockNews.map((item) => classifySentiment(item.headline || item.title || '', item.summary || '').score);
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return avg > 6 ? 'Bullish' : avg < 4 ? 'Bearish' : 'Neutral';
  }, [stockNews]);

  if (!info) return null;

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <section className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
          <header className="modal-header">
            <div className="ticker-cell">
              <div className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</div>
              <div>
                <h2>{ticker}</h2>
                <span>{info.name} - {info.sector}</span>
              </div>
            </div>
            <div className="modal-actions">
              {onTrade && (
                <>
                  <button className="buy-button" type="button" onClick={() => onTrade('buy', ticker)}>Buy</button>
                  <button className="sell-button" type="button" onClick={() => onTrade('sell', ticker)}>Sell</button>
                </>
              )}
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
            </div>
          </header>

          <div className="stock-modal-summary">
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

          <div className="chart-header">
            <span>Price History</span>
            <div className="segmented">
              {['1W', '1M', '3M', '6M', '1Y'].map((item) => (
                <button key={item} className={timeframe === item ? 'active' : ''} type="button" onClick={() => setTimeframe(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <LineChart data={chartData} dates={chartDates} color={(quote.dp || 0) >= 0 ? '#00e676' : '#ff3d71'} />

          <div className="indicator-grid">
            <div><span>RSI 14</span><strong>{signal.rsi == null ? '-' : fmt(signal.rsi, 1)}</strong></div>
            <div><span>MACD</span><strong>{signal.macd == null ? '-' : fmt(signal.macd.macd, 2)}</strong></div>
            <div><span>SMA 20</span><strong>{signal.sma20 == null ? '-' : fmtPrice(signal.sma20)}</strong></div>
            <div><span>SMA 50</span><strong>{signal.sma50 == null ? '-' : fmtPrice(signal.sma50)}</strong></div>
          </div>

          <div className="signal-factors">
            <span className="section-eyebrow">Signal Factors</span>
            {signal.factors.map((factor) => <p key={factor}>{factor}</p>)}
          </div>

          <div className="metric-grid">
            <div><span>Open</span><strong>{fmtPrice(quote.o)}</strong></div>
            <div><span>High</span><strong>{fmtPrice(quote.h)}</strong></div>
            <div><span>Low</span><strong>{fmtPrice(quote.l)}</strong></div>
            <div><span>Prev Close</span><strong>{fmtPrice(quote.pc)}</strong></div>
            <div><span>Sector</span><strong>{info.sector}</strong></div>
            <div><span>Beta</span><strong>{fmt(info.beta)}</strong></div>
          </div>

          <section className="modal-news">
            <span className="section-eyebrow">Related News</span>
            {stockNews.map((item) => (
              <article key={`${item.headline || item.title}-${item.datetime}`} onClick={() => setSelectedArticle(item)}>
                <div>
                  <span>{item.source || 'News'}</span>
                  <span>{timeAgo(item.datetime)}</span>
                </div>
                <strong>{item.headline || item.title}</strong>
              </article>
            ))}
          </section>
        </section>
      </div>
      {selectedArticle && <NewsArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
    </>
  );
}
