export function fmt(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${fmt(n)}%`;
}

export function fmtPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `$${fmt(value)}`;
}

export function timeAgo(timestampSeconds) {
  if (!timestampSeconds) return 'recently';
  const seconds = Date.now() / 1000 - timestampSeconds;
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
