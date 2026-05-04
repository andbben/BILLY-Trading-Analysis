import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Register({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.register(name, email, password);
      onLogin(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <section className="panel auth-panel">
        <span className="section-eyebrow">Register</span>
        <h2>Start your journey</h2>
        <p className="status">Create your account and begin tracking positions, alerts, and watchlists.</p>
        {error && <div className="status error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <span>Full name</span>
            <input type="text" placeholder="Jane Doe" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="status">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </div>
  );
}
