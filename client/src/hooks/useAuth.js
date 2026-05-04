import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load: check if there's already a token and validate it
  useEffect(() => {
    const token = localStorage.getItem('bb_token');
    if (!token) { setLoading(false); return; }

    api.getProfile()
      .then(data => setUser(data.user))
      .catch(() => localStorage.removeItem('bb_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    localStorage.setItem('bb_token', data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password) {
    const data = await api.register(name, email, password);
    localStorage.setItem('bb_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('bb_token');
    setUser(null);
  }

  return { user, loading, login, register, logout };
}
