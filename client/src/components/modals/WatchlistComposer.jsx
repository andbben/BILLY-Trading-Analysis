import { useMemo, useState } from 'react';
import { STOCKS_BASE } from '../../data/market';
import { fmtPrice } from '../../utils/formatters';
import { getPlanRules } from '../../utils/plans';
import { getLocalWatchlists, saveLocalWatchlists } from '../../utils/watchlists';

export default function WatchlistComposer({ quotes, initialTicker = '', onAdd, onClose }) {
  const [store, setStore] = useState(getLocalWatchlists);
  const [query, setQuery] = useState('');
  const [ticker, setTicker] = useState(initialTicker);
  const [newName, setNewName] = useState('');
  const planRules = getPlanRules();
  const canCreateLists = planRules.watchlistLimit > 1;
  const activeId = store.activeId || store.lists[0]?.id || 'default';
  const selectedList = store.lists.find((list) => list.id === activeId) || store.lists[0];

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return Object.entries(STOCKS_BASE)
      .filter(([symbol, info]) => symbol.toLowerCase().includes(term) || info.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [query]);

  const persist = (next) => {
    setStore(next);
    saveLocalWatchlists(next);
  };

  const createList = () => {
    if (!canCreateLists) return;
    const name = newName.trim();
    if (!name) return;
    const id = `wl-${Date.now().toString(36)}`;
    persist({ activeId: id, lists: [...store.lists, { id, name, tickers: [] }] });
    setNewName('');
  };

  const addTicker = async () => {
    if (!ticker || !selectedList) return;
    const next = {
      ...store,
      lists: store.lists.map((list) => (
        list.id === selectedList.id
          ? { ...list, tickers: [...new Set([...list.tickers, ticker])] }
          : list
      )),
    };
    persist(next);
    await onAdd?.(ticker, selectedList);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal alert-composer" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="section-eyebrow">Watchlists</span>
            <h2>{ticker ? `Add ${ticker}` : 'Find a stock'}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">x</button>
        </header>

        <div className="alert-search-shell">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticker or company name" />
          {results.length > 0 && (
            <div className="alert-search-results">
              {results.map(([symbol, info]) => (
                <button type="button" key={symbol} onClick={() => { setTicker(symbol); setQuery(''); }}>
                  <span className="ticker-logo" style={{ background: info.color }}>{symbol.slice(0, 2)}</span>
                  <span><strong>{symbol}</strong><small>{info.name}</small></span>
                  <em>{fmtPrice(quotes[symbol]?.c)}</em>
                </button>
              ))}
            </div>
          )}
        </div>

        {ticker && (
          <section className="alert-asset-overview">
            <div className="ticker-cell">
              <span className="ticker-logo" style={{ background: STOCKS_BASE[ticker]?.color }}>{ticker.slice(0, 2)}</span>
              <span><strong>{ticker}</strong><small>{STOCKS_BASE[ticker]?.name}</small></span>
            </div>
            <div className="trade-controls-grid">
              <label className="form-field">
                <span>Add to watchlist</span>
                <select value={activeId} onChange={(event) => persist({ ...store, activeId: event.target.value })}>
                  {store.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>New watchlist</span>
                <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={canCreateLists ? 'Dividend Ideas' : 'Upgrade for multiple lists'} disabled={!canCreateLists} />
              </label>
              <button className="secondary-button" type="button" onClick={createList} disabled={!canCreateLists}>Create List</button>
            </div>
            {!canCreateLists && <p className="form-hint">Starter includes one encompassing watchlist. Bronco Plus and Pro unlock multiple custom lists.</p>}
            <button type="button" onClick={addTicker}>Add To Watchlist</button>
          </section>
        )}
      </section>
    </div>
  );
}
