import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { classifySentiment } from '../utils/indicators';
import { fmt, timeAgo } from '../utils/formatters';
import NewsArticleModal from '../components/modals/NewsArticleModal';

export default function News({ marketData }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [watchlistTickers, setWatchlistTickers] = useState([]);
  const [heldTickers, setHeldTickers] = useState([]);
  const { news } = marketData;

  useEffect(() => {
    let cancelled = false;

    api.getWatchlist()
      .then((data) => {
        if (!cancelled) {
          setWatchlistTickers((data.watchlist || [])
            .map((item) => (typeof item === 'string' ? item : item.ticker))
            .filter(Boolean));
        }
      })
      .catch(() => {
        if (!cancelled) setWatchlistTickers([]);
      });

    api.getPortfolio()
      .then((data) => {
        if (!cancelled) {
          const fromAccounts = (data.billyAccounts || [])
            .flatMap((account) => account.positions || [])
            .map((position) => position.ticker)
            .filter(Boolean);
          const fromLegacy = (data.positions || []).map((position) => position.ticker).filter(Boolean);
          setHeldTickers([...new Set([...fromAccounts, ...fromLegacy])]);
        }
      })
      .catch(() => {
        if (!cancelled) setHeldTickers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const processed = useMemo(() => news.map((item, index) => {
    const sentiment = classifySentiment(item.headline || item.title || '', item.summary || '');
    const tickers = (item.related || '').split(',').map((ticker) => ticker.trim()).filter((ticker) => STOCKS_BASE[ticker]);
    return { ...item, ...sentiment, tickers, index };
  }), [news]);

  const watchlistSet = useMemo(() => new Set(watchlistTickers), [watchlistTickers]);
  const heldSet = useMemo(() => new Set(heldTickers), [heldTickers]);

  const filtered = useMemo(() => {
    if (filter === 'all') return processed;
    if (filter === 'watchlist') return processed.filter((item) => item.tickers.some((ticker) => watchlistSet.has(ticker)));
    if (filter === 'held') return processed.filter((item) => item.tickers.some((ticker) => heldSet.has(ticker)));
    return processed.filter((item) => item.sentiment === filter);
  }, [filter, heldSet, processed, watchlistSet]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">News Feed</span>
          <h1>News sentiment and article analysis</h1>
          <p>{processed.length} articles - keyword sentiment with optional server-side AI summaries.</p>
        </div>
      </header>

      <div className="filter-row">
        {[['all', 'All News'], ['watchlist', 'Watchlist'], ['held', 'Held Stocks'], ['bull', 'Bullish'], ['bear', 'Bearish'], ['neu', 'Neutral']].map(([key, label]) => (
          <button key={key} className={filter === key ? 'active' : ''} type="button" onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      <section className="panel">
        <div className="news-list">
          {filtered.map((item) => (
            <button className="news-item" type="button" key={`${item.index}-${item.headline || item.title}`} onClick={() => setSelected(item)}>
              <div className="news-meta">
                <span>{item.source || 'News'}</span>
                <span>{timeAgo(item.datetime)}</span>
                <span className={`sent-score ${item.sentiment}`}>{item.sentiment} {fmt(item.score, 1)}/10</span>
              </div>
              <strong>{item.headline || item.title}</strong>
              <div className="tag-row">
                {item.tickers.map((ticker) => <span key={ticker}>{ticker}</span>)}
              </div>
            </button>
          ))}
          {!filtered.length && <div className="empty-state">No articles match this filter.</div>}
        </div>
      </section>

      {selected && <NewsArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
