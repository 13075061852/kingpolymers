import { Database, ShieldCheck, Cpu } from 'lucide-react';
import MachineReference from '../components/MachineReference.jsx';
export default function Settings({ data, onBackup, onPassword }) {
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>系统设置</h1>
          <p>账户、备份与机器参数。</p>
        </div>
        <span className="badge">React edition</span>
      </div>
      <div className="settings-grid">
        <article className="panel">
          <Database />
          <h2>数据备份</h2>
          <p>每天自动备份，也可以随时创建当前数据的完整备份。</p>
          <button className="primary" onClick={onBackup}>
            立即备份
          </button>
          <p className="muted">本地编辑与云端数据独立保存。</p>
        </article>
        <article className="panel">
          <ShieldCheck />
          <h2>登录与安全</h2>
          {data.auth.enabled ? (
            <>
              <p>当前账号：{data.auth.username}</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fields = Object.fromEntries(new FormData(e.currentTarget));
                  await onPassword(fields);
                }}
              >
                <label>
                  当前密码
                  <input
                    name="old_password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  新密码
                  <input
                    name="new_password"
                    type="password"
                    minLength="10"
                    maxLength="128"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  确认新密码
                  <input
                    name="confirm_password"
                    type="password"
                    minLength="10"
                    maxLength="128"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button>修改密码</button>
              </form>
            </>
          ) : (
            <p>本机模式，无需登录。仅允许这台电脑访问。</p>
          )}
          <p className="muted">负责人确认码提示：{data.settings.confirm_hint}</p>
        </article>
        <article className="panel">
          <Cpu />
          <h2>固定机器参数</h2>
          {Object.values(data.machines).map((s) => (
            <div className="machine-spec" key={s.name}>
              <strong>{s.name}</strong>
              <p>
                名义直径 {s.diameter} mm · 标准节长 {s.section_length} mm
                <br />
                标准螺杆 {s.element_length} mm · 机筒 {s.barrel_length} mm
              </p>
            </div>
          ))}
          <p className="muted">实际加工内径、外径与配合间隙须按供应商图纸核对。</p>
          <MachineReference />
        </article>
      </div>
    </section>
  );
}
