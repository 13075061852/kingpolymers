import { useEffect, useState } from 'react';
import {
  LoaderCircle,
  Settings,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ShieldCheck,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../lib/api.js';
import ScrewPreview from '../components/ScrewPreview.jsx';
import '../login.css';

const rememberedKey = 'kingpolymer:remembered-account';
function rememberedAccount() {
  try {
    return localStorage.getItem(rememberedKey) || '';
  } catch {
    return '';
  }
}
const features = [
  { Icon: Settings, title: '参数化设计', detail: '精准配置' },
  { Icon: Boxes, title: '智能组合', detail: '灵活排列' },
  { Icon: ChartNoAxesColumnIncreasing, title: '工艺校验', detail: '清晰可见' },
  { Icon: ShieldCheck, title: '方案管理', detail: '专业可靠' },
];
function BrandMark() {
  return (
    <svg className="tech-brand-mark" viewBox="0 0 60 62" aria-hidden="true">
      <defs>
        <linearGradient id="tech-brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#64e1ff" />
          <stop offset=".48" stopColor="#1fafff" />
          <stop offset="1" stopColor="#2856ea" />
        </linearGradient>
      </defs>
      <path
        fill="url(#tech-brand-gradient)"
        d="M18 4h39L46 17H24L15 32l7 10H8L0 30Zm8 20h28l6 10-16 24H8l9-13h21l7-10H20Z"
      />
      <path fill="#91ecff" opacity=".75" d="m8 45 9-3h21l-8 3Z" />
    </svg>
  );
}
function Hologram() {
  return (
    <div className="tech-hologram" aria-hidden="true">
      <strong>模块化螺杆组合</strong>
      <span>MODULAR SCREW CONFIGURATION</span>
      {['多种规格', '自由组合', '精确适配'].map((label, row) => (
        <div className="tech-holo-row" key={label}>
          <svg viewBox="0 0 150 38">
            <path d="M3 19H147" stroke="#779cbb" strokeWidth="7" />
            {Array.from({ length: 9 }, (_, i) => (
              <ellipse
                key={i}
                cx={17 + i * 14}
                cy="19"
                rx={4 + row}
                ry="14"
                fill="#0b2134"
                stroke="#74aacf"
                strokeWidth="2"
                transform={`rotate(-15 ${17 + i * 14} 19)`}
              />
            ))}
          </svg>
          <small>{label}</small>
        </div>
      ))}
      <i>ENGINEERED FOR PRECISION</i>
    </div>
  );
}
export default function Login({ onLogin }) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.('(max-width: 680px)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 680px)');
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [username, setUsername] = useState(rememberedAccount),
    [remember, setRemember] = useState(() => !!rememberedAccount()),
    [visible, setVisible] = useState(false),
    [help, setHelp] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const password = new FormData(e.currentTarget).get('password');
    try {
      await api('/auth/login', { username, password });
      try {
        if (remember) localStorage.setItem(rememberedKey, username);
        else localStorage.removeItem(rememberedKey);
      } catch {
        /* Remembering the account is optional. Passwords are never persisted. */
      }
      await onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page login-tech">
      <div className="tech-atmosphere" aria-hidden="true" />
      <header className="tech-header">
        <a className="tech-brand" href="#login" aria-label="广俊螺杆库，登录工作台">
          <BrandMark />
          <span>
            <strong>广俊螺杆库</strong>
            <small>让螺杆组合创造更大价值</small>
          </span>
        </a>
        <div className="tech-header-motto">
          <span>更专业</span>
          <i />
          <span>更智能</span>
          <i />
          <span>更高效</span>
          <b />
          中文
        </div>
      </header>
      {!mobile && (
        <div className="tech-scene">
          <ScrewPreview hero />
        </div>
      )}
      <div className="tech-annotations" aria-hidden="true">
        <div className="tech-callout tech-feed">
          <i />
          <strong>输送段</strong>
          <span>FEED SECTION</span>
          <small>高效输送 · 稳定可靠</small>
        </div>
        <div className="tech-callout tech-compression">
          <i />
          <strong>压缩段</strong>
          <span>COMPRESSION SECTION</span>
          <small>精确压缩 · 提升性能</small>
        </div>
        <div className="tech-callout tech-metering">
          <i />
          <strong>计量段</strong>
          <span>METERING SECTION</span>
          <small>精密计量 · 控制精度</small>
        </div>
        <Hologram />
      </div>
      <section className="tech-intro" aria-labelledby="login-title">
        <div className="tech-intro-line" />
        <h1 id="login-title">广俊螺杆库</h1>
        <h2>专业的螺杆排列组合设计平台</h2>
        <p>精准配置 · 智能组合 · 驱动更大可能</p>
        <span className="tech-overline">SCREW CONFIGURATION PLATFORM</span>
        <div className="tech-features">
          {features.map(({ Icon, title, detail }) => (
            <div className="tech-feature" key={title}>
              <Icon size={32} strokeWidth={1.4} />
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
        <div className="tech-specs">
          <div>
            <strong>50 / 60</strong>
            <span>标准机型</span>
          </div>
          <div>
            <strong>3D</strong>
            <span>立体交互预览</span>
          </div>
          <div>
            <strong>自动</strong>
            <span>本地草稿保存</span>
          </div>
          <div>
            <strong>多格式</strong>
            <span>工程图纸导出</span>
          </div>
        </div>
      </section>
      <section className="tech-auth-area" aria-label="账号登录">
        <div className="tech-panel-edge" />
        <div className="tech-panel-spark tech-panel-spark-top" />
        <div className="tech-panel-spark tech-panel-spark-side" />
        <span className="tech-panel-caption">
          PRECISION DRIVES
          <br />A BETTER TOMORROW
        </span>
        <form id="login" className="tech-auth-form" onSubmit={submit}>
          <h2>欢迎回来</h2>
          <h3>登录广俊螺杆库</h3>
          <p>开启您的螺杆组合设计之旅</p>
          <fieldset disabled={busy}>
            <label className="tech-input">
              <span className="tech-sr-only">用户名</span>
              <Mail size={20} strokeWidth={1.7} />
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="请输入账号"
                required
              />
            </label>
            <label className="tech-input">
              <span className="tech-sr-only">密码</span>
              <LockKeyhole size={20} strokeWidth={1.7} />
              <input
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
              <button
                type="button"
                className="tech-password-toggle"
                aria-label={visible ? '隐藏密码' : '显示密码'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <Eye size={19} /> : <EyeOff size={19} />}
              </button>
            </label>
            <div className="tech-form-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => {
                    setRemember(e.target.checked);
                    if (!e.target.checked) {
                      try {
                        localStorage.removeItem(rememberedKey);
                      } catch {
                        /* Optional storage. */
                      }
                    }
                  }}
                />
                记住账号
              </label>
              <button type="button" onClick={() => setHelp(!help)} aria-expanded={help}>
                忘记密码？
              </button>
            </div>
            {help && (
              <p className="tech-login-help" role="status">
                请联系工作台管理员重置密码；已登录时可在「设置」中修改密码。
              </p>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="tech-login-submit" aria-label="登录工作台" type="submit">
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={19} />
                  正在登录…
                </>
              ) : (
                '登录'
              )}
            </button>
          </fieldset>
        </form>
        <div className="tech-planet" aria-hidden="true" />
        <span className="tech-panel-bottom">以 螺 杆 · 驱 动 更 大 可 能</span>
      </section>
      <footer className="tech-footer">
        <span>
          SCREW SOLUTIONS
          <br />
          FOR A BETTER TOMORROW
        </span>
        <span>kingpolymer · 宁波广俊塑料科技有限公司</span>
      </footer>
    </main>
  );
}
