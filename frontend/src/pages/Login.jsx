import { useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { PasswordField } from '../components/Ui.jsx';
import ScrewPreview from '../components/ScrewPreview.jsx';
export default function Login({ onLogin }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', Object.fromEntries(new FormData(e.currentTarget)));
      await onLogin();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="brand" href="#login">
          <img src="/brand-logo.svg" alt="KP" />
          <span>kingpolymer</span>
        </a>
        <div className="login-intro">
          <h1>双螺杆组合设计</h1>
        </div>
        <ScrewPreview hero />
      </section>
      <section className="login-form-area">
        <form id="login" className="login-card" onSubmit={submit}>
          <h2>欢迎回来</h2>
          <p>登录双螺杆组合设计工作台</p>
          <fieldset disabled={busy}>
            <label>
              用户名
              <input
                name="username"
                autoComplete="username"
                placeholder="请输入用户名"
                required
                autoFocus
              />
            </label>
            <PasswordField
              label="密码"
              name="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              required
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary login-submit">
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  正在登录…
                </>
              ) : (
                <>
                  登录工作台
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </fieldset>
        </form>
        <footer>kingpolymer · 双螺杆工程工作台</footer>
      </section>
    </main>
  );
}
