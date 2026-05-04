import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(email, password);
      onLogin(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <section className="panel auth-panel">
        <span className="section-eyebrow">Sign In</span>
        <h2>Welcome back</h2>
        <p className="status">Sign in to access your Billy Bronco dashboard.</p>
        {error && <div className="status error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="status">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </section>
    </div>
  );
}
