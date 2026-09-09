import { useState } from 'react';
import { api } from '../lib/api.js';
export default function Login({ onLogin }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/login', Object.fromEntries(form));
      await onLogin();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/brand-logo.svg" alt="kingpolymer" />
        <span className="eyebrow">ENGINEERING WORKSPACE</span>
        <h1>欢迎回来</h1>
        <p>登录双螺杆组合设计工作台</p>
        <label>
          用户名
          <input name="username" autoComplete="username" required autoFocus />
        </label>
        <label>
          密码
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? '正在登录…' : '登录工作台'}
        </button>
      </form>
    </main>
  );
}
