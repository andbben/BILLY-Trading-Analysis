import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navigation from './Navigation';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Landing from '../pages/Landing';
import Dashboard from '../pages/Dashboard';
import PortfolioPage from '../pages/PortfolioPage';
import Watchlist from '../pages/Watchlist';
import Alerts from '../pages/Alerts';
import News from '../pages/News';
import Learn from '../pages/Learn';
import Plans from '../pages/Plans';
import ProtectedRoute from './ProtectedRoute';
import TickerBanner from './layout/TickerBanner';
import { useMarketData } from '../hooks/useMarketData';
import './App.css';

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Router>
      <div className="app-shell">
        <Navigation isAuth={isAuth} user={user} onLogout={handleLogout} marketData={marketData} />
        <TickerBanner quotes={marketData.quotes} />
        {marketData.error && <div className="api-warning">{marketData.error}</div>}
        <main className="app-body">
          <Routes>
            <Route path="/" element={<Landing isAuth={isAuth} />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register onLogin={handleLogin} />} />
            <Route path="/dashboard" element={<Dashboard marketData={marketData} />} />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute isAuth={isAuth}>
                  <PortfolioPage marketData={marketData} />
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
            <Route path="/news" element={<News marketData={marketData} />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
