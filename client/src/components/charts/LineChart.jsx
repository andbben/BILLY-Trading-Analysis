import { useRef, useState } from 'react';
import { fmtPrice } from '../../utils/formatters';

export default function LineChart({ data, dates, color = '#00d4ff', height = 170 }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

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
    <div className="line-chart" onMouseLeave={() => setTooltip(null)}>
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
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#chartFill)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {tooltip && <circle cx={(tooltip.x / 100) * width} cy={tooltip.y} r="5" fill={color} />}
      </svg>
    </div>
  );
}
