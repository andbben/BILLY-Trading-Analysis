import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navigation from './Navigation';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import PortfolioPage from '../pages/PortfolioPage';
import Watchlist from '../pages/Watchlist';
import Alerts from '../pages/Alerts';
import News from '../pages/News';
import Learn from '../pages/Learn';
import Plans from '../pages/Plans';
import Transfers from '../pages/Transfers';
import ProtectedRoute from './ProtectedRoute';
import TickerBanner from './layout/TickerBanner';
import { useMarketData } from '../hooks/useMarketData';
import { api } from '../services/api';
import './App.css';

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('bb_theme') || 'light');
  const [watchlist, setWatchlist] = useState([]);
  const marketData = useMarketData();

  useEffect(() => {
    const token = localStorage.getItem('bb_token');
    if (token) {
      setIsAuth(true);
      const user = JSON.parse(localStorage.getItem('bb_user') || '{}');
      setUser(user);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('bb_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isAuth) {
      setWatchlist([]);
      return undefined;
    }

    const loadWatchlist = async () => {
      try {
        const data = await api.getWatchlist();
        setWatchlist(data.watchlist || []);
      } catch {
        setWatchlist([]);
      }
    };

    loadWatchlist();
    window.addEventListener('bb-watchlist-updated', loadWatchlist);
    return () => window.removeEventListener('bb-watchlist-updated', loadWatchlist);
  }, [isAuth]);

  const handleLogin = (token, user) => {
    localStorage.setItem('bb_token', token);
    localStorage.setItem('bb_user', JSON.stringify(user));
    setIsAuth(true);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('bb_token');
    localStorage.removeItem('bb_user');
    setIsAuth(false);
    setUser(null);
  };

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Router>
      <div className={`app-shell theme-${theme} ${isAuth ? 'signed-in' : 'auth-shell'}`}>
        {isAuth && (
          <>
            <Navigation
              isAuth={isAuth}
              user={user}
              onLogout={handleLogout}
              marketData={marketData}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
            <TickerBanner quotes={marketData.quotes} watchlist={watchlist} />
            {marketData.error && <div className="api-warning">{marketData.error}</div>}
          </>
        )}
        <main className="app-body">
          <Routes>
            <Route path="/" element={<Navigate to={isAuth ? '/dashboard' : '/login'} replace />} />
            <Route
              path="/login"
              element={isAuth ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />}
            />
            <Route
              path="/register"
              element={isAuth ? <Navigate to="/dashboard" replace /> : <Register onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />}
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Dashboard marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <PortfolioPage marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transfers"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Transfers marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlist"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Watchlist marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Alerts marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/news"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <News marketData={marketData} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Learn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plans"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <Plans />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to={isAuth ? '/dashboard' : '/login'} replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
