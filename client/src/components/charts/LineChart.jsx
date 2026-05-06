import { useId, useRef, useState } from 'react';
import { fmtPrice } from '../../utils/formatters';

export default function LineChart({ data, dates, color = '#00d4ff', height = 170 }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const gradientId = `chartFill-${useId().replace(/:/g, '')}`;

  if (!Array.isArray(data) || data.length < 2) {
    return (
      <div className="chart-loading" style={{ height }}>
        Loading chart...
      </div>
    );
  }

  const width = 500;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const px = (index) => (index / (data.length - 1)) * width;
  const py = (value) => height - ((value - min) / range) * (height - 22) - 11;
  const points = data.map((value, index) => `${px(index)},${py(value)}`).join(' ');

  const onMouseMove = (event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(pct * (data.length - 1));
    setTooltip({
      x: pct * 100,
      y: py(data[index]),
      price: data[index],
      label: dates?.[index] || `${data.length - index} bars ago`,
    });
  };

  return (
    <div className="line-chart" style={{ height }} onMouseLeave={() => setTooltip(null)}>
      {tooltip && (
        <div className="chart-tooltip" style={{ left: `${tooltip.x}%` }}>
          <strong>{fmtPrice(tooltip.price)}</strong>
          <span>{tooltip.label}</span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={onMouseMove}
        role="img"
        aria-label="Price history chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((line) => (
          <line key={line} x1="0" x2={width} y1={height * line} y2={height * line} className="chart-grid-line" />
        ))}
        {[0.25, 0.5, 0.75].map((line) => (
          <line key={line} y1="0" y2={height} x1={width * line} x2={width * line} className="chart-grid-line chart-grid-line-vertical" />
        ))}
        <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={width} cy={py(data[data.length - 1])} r="4" fill={color} />
        {tooltip && <circle cx={(tooltip.x / 100) * width} cy={tooltip.y} r="5" fill={color} />}
      </svg>
    </div>
  );
}
