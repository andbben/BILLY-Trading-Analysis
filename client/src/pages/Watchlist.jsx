import { useEffect, useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { fmtPct, fmtPrice } from '../utils/formatters';
import Sparkline from '../components/charts/Sparkline';
import StockModal from '../components/modals/StockModal';
import WatchlistComposer from '../components/modals/WatchlistComposer';
import { getLocalWatchlists } from '../utils/watchlists';
import { getPlanRules } from '../utils/plans';

function normalizeLocalLists(apiTickers) {
  const store = getLocalWatchlists();
  const lists = store.lists.map((list) => (
    list.id === 'default' && !list.tickers.length ? { ...list, tickers: apiTickers } : list
  ));
  return { activeId: store.activeId || lists[0]?.id || 'default', lists };
}

export default function Watchlist({ marketData }) {
  const [store, setStore] = useState(() => normalizeLocalLists([]));
  const [selected, setSelected] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [sortBy, setSortBy] = useState('custom');
  const [error, setError] = useState('');
  const { quotes, fetchStockCandles, fetchCompanyNews } = marketData;
  const planRules = getPlanRules();
  const visibleLists = planRules.watchlistLimit === 1 ? store.lists.slice(0, 1) : store.lists;
  const activeList = store.lists.find((list) => list.id === store.activeId) || store.lists[0];

  const syncStore = (next) => {
    setStore(next);
    localStorage.setItem('bb_watchlists', JSON.stringify(next));
    window.dispatchEvent(new Event('bb-watchlists-local-updated'));
  };

  const loadWatchlist = async () => {
    try {
      const data = await api.getWatchlist();
      const apiTickers = (data.watchlist || []).map((item) => (typeof item === 'string' ? item : item.ticker)).filter(Boolean);
      const next = normalizeLocalLists(apiTickers);
      setStore(next);
      localStorage.setItem('bb_watchlists', JSON.stringify(next));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load watchlist.');
    }
  };

  useEffect(() => {
    loadWatchlist();
    const update = () => setStore(getLocalWatchlists());
    window.addEventListener('bb-watchlists-local-updated', update);
    return () => window.removeEventListener('bb-watchlists-local-updated', update);
  }, []);

  useEffect(() => {
    if (planRules.watchlistLimit === 1 && store.activeId !== 'default') {
      const next = { ...store, activeId: 'default' };
      setStore(next);
      localStorage.setItem('bb_watchlists', JSON.stringify(next));
    }
  }, [planRules.watchlistLimit, store]);

  const addTicker = async (ticker, list) => {
    if (list?.id === 'default') {
      await api.addToWatchlist(ticker);
      window.dispatchEvent(new Event('bb-watchlist-updated'));
    }
  };

  const removeTicker = async (ticker) => {
    const next = {
      ...store,
      lists: store.lists.map((list) => (
        list.id === activeList.id ? { ...list, tickers: list.tickers.filter((item) => item !== ticker) } : list
      )),
    };
    syncStore(next);
    if (activeList.id === 'default') {
      await api.removeFromWatchlist(ticker);
      window.dispatchEvent(new Event('bb-watchlist-updated'));
    }
  };

  const moveTicker = (ticker, direction) => {
    const tickers = [...(activeList?.tickers || [])];
    const index = tickers.indexOf(ticker);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= tickers.length) return;
    [tickers[index], tickers[nextIndex]] = [tickers[nextIndex], tickers[index]];
    syncStore({
      ...store,
      lists: store.lists.map((list) => (list.id === activeList.id ? { ...list, tickers } : list)),
    });
    setSortBy('custom');
  };

  const tickers = useMemo(() => {
    const rows = [...(activeList?.tickers || [])].filter((ticker) => STOCKS_BASE[ticker]);
    if (sortBy === 'custom') return rows;
    return rows.sort((a, b) => {
      const qa = quotes[a] || {};
      const qb = quotes[b] || {};
      if (sortBy === 'price') return Number(qb.c || 0) - Number(qa.c || 0);
      if (sortBy === 'change') return Number(qb.dp || 0) - Number(qa.dp || 0);
      if (sortBy === 'name') return STOCKS_BASE[a].name.localeCompare(STOCKS_BASE[b].name);
      return 0;
    });
  }, [activeList, quotes, sortBy]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Watchlist</span>
          <h1>Track Stocks You Care About</h1>
          <p>{tickers.length} symbols in {activeList?.name || 'Primary Watchlist'}.</p>
        </div>
        <button className="secondary-button alert-create-button" type="button" onClick={() => setShowComposer(true)}>Add To Watchlist</button>
      </header>

      <section className="panel">
        <div className="inline-controls watchlist-controls">
          <label className="form-field">
            <span>Watchlist</span>
            <select value={store.activeId} onChange={(event) => syncStore({ ...store, activeId: event.target.value })}>
              {visibleLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Organize by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="custom">Custom order</option>
              <option value="change">Daily change</option>
              <option value="price">Price</option>
              <option value="name">Company name</option>
            </select>
          </label>
        </div>
        {planRules.watchlistLimit === 1 && <p className="form-hint">Starter includes one encompassing watchlist. Upgrade to Bronco Plus or Pro to create multiple lists.</p>}
        {error && <p className="status error">{error}</p>}
      </section>

      <section className="panel">
        <div className="data-table watch-table">
          <div className="table-head">
            <span>Symbol</span><span>Price</span><span>Change</span><span>Signal</span><span>Chart</span><span>Order</span>
          </div>
          {tickers.map((ticker) => {
            const info = STOCKS_BASE[ticker];
            const quote = quotes[ticker] || {};
            const up = (quote.dp || 0) >= 0;
            const signal = (quote.dp || 0) > 2 ? 'BUY' : (quote.dp || 0) < -2 ? 'SELL' : 'HOLD';
            return (
              <article className="table-row" key={ticker}>
                <button className="ticker-cell account-name-button" type="button" onClick={() => setSelected(ticker)}>
                  <span className="ticker-logo" style={{ background: info?.color }}>{ticker.slice(0, 2)}</span>
                  <span><strong>{ticker}</strong><small>{info?.name}</small></span>
                </button>
                <span className="mono">{fmtPrice(quote.c)}</span>
                <span className={up ? 'pos mono' : 'neg mono'}>{fmtPct(quote.dp || 0)}</span>
                <span><i className={`badge badge-${signal.toLowerCase()}`}>{signal}</i></span>
                <Sparkline data={[quote.o || quote.c * 0.99, quote.l || quote.c * 0.98, quote.h || quote.c * 1.01, quote.c].filter(Boolean)} color={up ? '#00c2a8' : '#ff4f7b'} height={34} />
                <span className="row-actions">
                  <button className="icon-btn" type="button" onClick={() => moveTicker(ticker, -1)}>^</button>
                  <button className="icon-btn" type="button" onClick={() => moveTicker(ticker, 1)}>v</button>
                  <button className="icon-btn" type="button" onClick={() => removeTicker(ticker)}>x</button>
                </span>
              </article>
            );
          })}
          {!tickers.length && <div className="empty-state">Add stocks with the button above.</div>}
        </div>
      </section>

      {showComposer && <WatchlistComposer quotes={quotes} onAdd={addTicker} onClose={() => { setShowComposer(false); setStore(getLocalWatchlists()); }} />}
      {selected && (
        <StockModal
          ticker={selected}
          quotes={quotes}
          fetchStockCandles={fetchStockCandles}
          fetchCompanyNews={fetchCompanyNews}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
