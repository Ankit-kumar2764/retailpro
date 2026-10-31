import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_URL, authConfig } from '../utils/api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingSession, setCheckingSession] = useState(Boolean(window.localStorage.getItem('retailpro_token')));

  useEffect(() => {
    if (!window.localStorage.getItem('retailpro_token')) {
      setCheckingSession(false);
      return;
    }
    axios.get(`${API_URL}/auth/profile`, authConfig())
      .then(() => navigate(location.state?.from?.pathname || '/', { replace: true }))
      .catch(() => {
        window.localStorage.removeItem('retailpro_token');
        window.localStorage.removeItem('retailpro_user');
        setCheckingSession(false);
      });
  }, []);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, form);
      window.localStorage.setItem('retailpro_token', response.data.token);
      window.localStorage.setItem('retailpro_user', JSON.stringify(response.data.user));
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || (requestError.request
        ? `Unable to reach the API server at ${API_URL}. Start the backend and try again.`
        : 'Unable to login. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (checkingSession) return <main className="auth-page"><section className="auth-card"><p className="auth-subtitle">Checking your session...</p></section></main>;

  return <main className="auth-page"><section className="auth-card">
    <div className="brand auth-brand"><div className="brand-mark">R</div><span>Retail<span className="brand-accent">Pro</span></span></div>
    <p className="eyebrow">Secure workspace</p>
    <h1>Sign in to RetailPro</h1>
    <p className="auth-subtitle">Use your Manager or Admin account to add products and manage stock.</p>
    <form onSubmit={submit}>
      <label>Email<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={update} autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-btn auth-submit" type="submit" disabled={saving}>{saving ? 'Signing in...' : 'Sign in'}</button>
    </form>
  </section></main>;
}
