export function getLocalWatchlists() {
  try {
    const stored = JSON.parse(localStorage.getItem('bb_watchlists') || 'null');
    if (stored?.lists?.length) return stored;
  } catch {
    // Fall through to default.
  }
  return { activeId: 'default', lists: [{ id: 'default', name: 'Primary Watchlist', tickers: [] }] };
}

export function saveLocalWatchlists(data) {
  localStorage.setItem('bb_watchlists', JSON.stringify(data));
  window.dispatchEvent(new Event('bb-watchlists-local-updated'));
}
