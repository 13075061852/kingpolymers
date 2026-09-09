import { useState } from 'react';
import { ArrowRight, Layers3, ShieldCheck, FolderOpen, LoaderCircle } from 'lucide-react';
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
          <span className="eyebrow">TWIN-SCREW ENGINEERING</span>
          <h1>
            精密组合。
            <br />
            让工艺更进一步。
          </h1>
          <p>
            从每一个元件，到每一套生产方案。
            <br />
            专注设计，掌控细节。
          </p>
        </div>
        <ScrewPreview hero />
        <div className="login-features">
          <div>
            <Layers3 />
            <strong>组合设计</strong>
            <span>直观构建螺杆方案</span>
          </div>
          <div>
            <ShieldCheck />
            <strong>工程校验</strong>
            <span>实时核对工艺规则</span>
          </div>
          <div>
            <FolderOpen />
            <strong>方案管理</strong>
            <span>贯通设计与生产</span>
          </div>
        </div>
      </section>
      <section className="login-form-area">
        <form id="login" className="login-card" onSubmit={submit}>
          <span className="eyebrow">YOUR ENGINEERING WORKSPACE</span>
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
          <div className="login-trust">
            <ShieldCheck size={16} />
            <span>工程数据，安全有序</span>
          </div>
        </form>
        <footer>kingpolymer · 双螺杆工程工作台</footer>
      </section>
    </main>
  );
}
