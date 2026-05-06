import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login({ onLogin }) {
  const rememberedEmail = localStorage.getItem('bb_remembered_email') || '';
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(email, password);
      if (rememberEmail) {
        localStorage.setItem('bb_remembered_email', email);
      } else {
        localStorage.removeItem('bb_remembered_email');
      }
      onLogin(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <header className="auth-header">
        <Link className="auth-brand" to="/login">
          <span>Billy</span>
        </Link>
        <div className="auth-header-links">
          <a href="#security">Security</a>
          <a href="#faqs">FAQs</a>
        </div>
      </header>

      <div className="auth-center">
        <section className="auth-card">
          <h1>Log in</h1>
          {error && <div className="status error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-field">
              <span>Username</span>
              <input autoComplete="username" autoFocus type="text" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Password</span>
              <span className="password-field">
                <input
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
              <span>Remember my username</span>
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Log in'}
            </button>
          </form>
          <a className="auth-link" href="#recovery">Forgot username or password?</a>
        </section>

        <p className="auth-new">
          New to Billy? <Link to="/register">Open an account</Link> or <Link to="/register">sign up</Link>.
        </p>
      </div>

      <footer className="auth-disclaimer" id="security">
        <strong>Disclaimer</strong>
        <a href="#financial-condition">Billy Market Analyst Statement of Financial Condition</a>
        <p>Use of this site involves the electronic transmission of personal financial information. Platform access requires login or registration and protects portfolio, watchlist, alerts, and transfer activity behind authenticated routes.</p>
      </footer>
    </div>
  );
}
