import { NavLink, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { STOCKS_BASE } from '../data/market';
import { fmtPrice } from '../utils/formatters';

export default function Navigation({ isAuth, user, onLogout, marketData }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return Object.entries(STOCKS_BASE)
      .filter(([ticker, info]) => ticker.toLowerCase().includes(term) || info.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [search]);

  return (
    <header className="site-header">
      <button className="brand-group" type="button" onClick={() => navigate('/')}>
        <div className="brand-mark">B</div>
        <div className="brand-copy">
          <span className="brand-title">Billy Bronco</span>
          <span className="brand-subtitle">Market Analyst</span>
        </div>
      </button>
      <nav className="site-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/news" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          News
        </NavLink>
        {isAuth ? (
          <>
            <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Portfolio
            </NavLink>
            <NavLink to="/watchlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Watchlist
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Alerts
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Login
            </NavLink>
            <NavLink to="/register" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Register
            </NavLink>
          </>
        )}
        <NavLink to="/learn" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Learn
        </NavLink>
        <NavLink to="/plans" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Plans
        </NavLink>
      </nav>
      <div className="nav-tools">
        <div className="nav-search">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stocks" />
          {results.length > 0 && (
            <div className="search-menu">
              {results.map(([ticker, info]) => (
                <button type="button" key={ticker} onClick={() => { setSearch(''); navigate('/dashboard'); }}>
                  <span className="ticker-logo" style={{ background: info.color }}>{ticker.slice(0, 2)}</span>
                  <span><strong>{ticker}</strong><small>{info.name}</small></span>
                  <em>{fmtPrice(marketData.quotes[ticker]?.c)}</em>
                </button>
              ))}
            </div>
          )}
        </div>
        {marketData.mktStatus && <span className={`market-pill ${marketData.mktStatus.isOpen ? 'open' : 'closed'}`}>{marketData.mktStatus.label}</span>}
        {isAuth && user && <span className="user-pill">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>}
        {isAuth && (
          <button type="button" className="nav-button danger" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
