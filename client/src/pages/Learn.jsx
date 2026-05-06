import { LEARN_ITEMS_FULL } from '../utils/pageContent';

export default function Learn() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Learn</span>
          <h1>Financial Indicators and Analytics</h1>
          <p>Reference tiles for the indicators used in stock detail analysis.</p>
        </div>
      </header>

      <section className="learn-hero-panel">
        <div>
          <h2>Core Analysis Toolkit</h2>
          <p>Definitions, formulas, and practical interpretation in one clean reading flow.</p>
        </div>
      </section>

      <section className="learn-list learn-stack-modern">
        {LEARN_ITEMS_FULL.map((item) => (
          <article className="learn-card" key={item.term}>
            <header className="learn-indicator-title">
              <strong>{item.term}</strong>
            </header>
            <div>
              <p>{item.def}</p>
              <pre>{item.formula}</pre>
              <ul>
                {item.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <p className="disclaimer">Billy Bronco is an educational and analytical tool for informational purposes only. Signals are not financial advice.</p>
    </div>
  );
}
