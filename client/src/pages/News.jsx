import { useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { classifySentiment } from '../utils/indicators';
import { fmt, timeAgo } from '../utils/formatters';
import NewsArticleModal from '../components/modals/NewsArticleModal';

export default function News({ marketData }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const { news } = marketData;

  const processed = useMemo(() => news.map((item, index) => {
    const sentiment = classifySentiment(item.headline || item.title || '', item.summary || '');
    const tickers = (item.related || '').split(',').map((ticker) => ticker.trim()).filter((ticker) => STOCKS_BASE[ticker]);
    return { ...item, ...sentiment, tickers, index };
  }), [news]);

  const filtered = filter === 'all' ? processed : processed.filter((item) => item.sentiment === filter);

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
        {[['all', 'All News'], ['bull', 'Bullish'], ['bear', 'Bearish'], ['neu', 'Neutral']].map(([key, label]) => (
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
