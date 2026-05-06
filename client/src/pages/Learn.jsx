import { LEARN_ITEMS_FULL } from '../utils/pageContent';
import { useState } from 'react';

export default function Learn() {
  const [open, setOpen] = useState(null);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Learn</span>
          <h1>Financial Indicators and Analytics</h1>
          <p>Reference cards for the indicators used in stock detail analysis.</p>
        </div>
      </header>

      <section className="learn-hero-panel">
        <div>
          <h2>Core Analysis Toolkit</h2>
          <p>Open a topic to see the definition, formula, and practical interpretation.</p>
        </div>
      </section>

      <section className="learn-list learn-grid-modern">
        {LEARN_ITEMS_FULL.map((item, index) => (
          <article className="learn-card" key={item.term}>
            <button type="button" onClick={() => setOpen(open === index ? null : index)}>
              <strong>{item.term}</strong>
              <span>{open === index ? 'Close' : 'Expand'}</span>
            </button>
            {open === index && (
              <div>
                <p>{item.def}</p>
                <pre>{item.formula}</pre>
                <ul>
                  {item.tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      <p className="disclaimer">Billy Bronco is an educational and analytical tool for informational purposes only. Signals are not financial advice.</p>
    </div>
  );
}
