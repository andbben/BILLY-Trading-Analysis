import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { classifySentiment } from '../../utils/indicators';
import { fmt, timeAgo } from '../../utils/formatters';
import { getPlanRules } from '../../utils/plans';

export default function NewsArticleModal({ article, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const headline = article.headline || article.title || '';
  const planRules = useMemo(() => getPlanRules(), []);

  const sentiment = useMemo(
    () => classifySentiment(headline, article.summary || ''),
    [article.summary, headline],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.analyzeNews(article)
      .then((data) => {
        if (!cancelled) setAnalysis(data.analysis);
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysis({
            abstract: article.summary || headline,
            marketImpact: 'This item may affect sentiment for the related tickers. Watch price action and volume for confirmation.',
            keyPoints: ['Review the source article', 'Compare with technical levels', 'Watch related tickers'],
            watchFor: 'Monitor follow-through in price and volume.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [article, headline]);

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="modal-kicker">{article.source || 'News'} - {timeAgo(article.datetime)}</span>
            <h2>{headline}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
        </header>

        {planRules.showNewsSentiment && (
          <div className={`sentiment-bar ${sentiment.sentiment}`}>
            <span>{sentiment.sentiment === 'bull' ? 'Bullish' : sentiment.sentiment === 'bear' ? 'Bearish' : 'Neutral'}</span>
            <strong>{fmt(sentiment.score, 1)}/10</strong>
          </div>
        )}

        {loading ? (
          <div className="status">Generating analysis...</div>
        ) : (
          <div className="analysis-grid">
            {planRules.newsAnalysis !== 'basic' && (
              <article>
                <span className="section-eyebrow">Summary</span>
                <p>{analysis?.abstract}</p>
              </article>
            )}
            <article>
              <span className="section-eyebrow">Market Impact</span>
              <p>{analysis?.marketImpact}</p>
            </article>
            <article>
              <span className="section-eyebrow">Key Points</span>
              <ul>
                {(analysis?.keyPoints || []).map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>
            {planRules.newsAnalysis === 'full' && (
              <article>
                <span className="section-eyebrow">Watch For</span>
                <p>{analysis?.watchFor}</p>
              </article>
            )}
          </div>
        )}

        {article.url && (
          <button className="secondary-button" type="button" onClick={() => window.open(article.url, '_blank', 'noreferrer')}>
            Open source article
          </button>
        )}
      </section>
    </div>
  );
}
