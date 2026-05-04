import { Link } from 'react-router-dom';
import { FEATURES } from '../utils/pageContent';

export default function Landing({ isAuth }) {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <span className="hero-badge">Cal Poly Pomona - Market Analyst MVP</span>
        <h1>Billy Bronco</h1>
        <p>Live market tracking, portfolio analytics, alerting, news sentiment, and technical signal intelligence in one workspace.</p>
        <div className="hero-actions">
          <Link className="button-link" to="/dashboard">Launch Dashboard</Link>
          <Link className="secondary-link" to={isAuth ? '/portfolio' : '/login'}>Portfolio and Risk</Link>
        </div>
        <div className="hero-stats">
          <div><strong>10</strong><span>Tracked stocks</span></div>
          <div><strong>3</strong><span>Major indexes</span></div>
          <div><strong>24/7</strong><span>Demo access</span></div>
        </div>
      </section>

      <section className="feature-section">
        <header>
          <span className="section-eyebrow">Feature Set</span>
          <h2>Everything from the standalone demo, now inside the project app.</h2>
        </header>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article className="feature-card" key={feature.id}>
              <strong>{feature.name}</strong>
              <p>{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
