export default function RiskGauge({ score = 0 }) {
  const normalized = Math.min(100, Math.max(0, score));
  const color = normalized < 30 ? '#00e676' : normalized < 55 ? '#ffb700' : normalized < 75 ? '#ff9100' : '#ff3d71';

  return (
    <div className="risk-gauge" style={{ '--risk-score': normalized, '--risk-color': color }}>
      <svg viewBox="0 0 120 70" aria-label={`Risk score ${normalized}`}>
        <path className="risk-track" d="M 16 60 A 44 44 0 0 1 104 60" />
        <path className="risk-fill" d="M 16 60 A 44 44 0 0 1 104 60" />
      </svg>
      <strong>{normalized}</strong>
      <span>Risk Score</span>
    </div>
  );
}
