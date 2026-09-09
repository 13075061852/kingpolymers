import { useState } from 'react';
import { Database, ShieldCheck, Cpu, Check, LoaderCircle, Monitor } from 'lucide-react';
import MachineReference from '../components/MachineReference.jsx';
import { PasswordField } from '../components/Ui.jsx';
export default function Settings({ data, onBackup, onPassword }) {
  const [backing, setBacking] = useState(false),
    [backed, setBacked] = useState(false),
    [changing, setChanging] = useState(false);
  async function backup() {
    if (backing) return;
    setBacking(true);
    try {
      if (await onBackup()) setBacked(true);
    } finally {
      setBacking(false);
    }
  }
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>系统设置</h1>
          <p>管理账户安全、数据备份与机器参数。</p>
        </div>
        <span className="mode-badge">
          <Monitor size={15} />
          {data.auth.enabled ? '云端工作台' : '本地工作台'}
        </span>
      </div>
      <div className="settings-grid">
        <article className="panel">
          <div className="card-heading">
            <span className="status-icon">
              <ShieldCheck />
            </span>
            <div>
              <h2>登录与安全</h2>
              <p>保护你的工程数据</p>
            </div>
          </div>
          {data.auth.enabled ? (
            <>
              <p>
                当前账号 <strong>{data.auth.username}</strong>
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (changing) return;
                  const fields = Object.fromEntries(new FormData(e.currentTarget));
                  setChanging(true);
                  try {
                    await onPassword(fields);
                  } finally {
                    setChanging(false);
                  }
                }}
              >
                <fieldset disabled={changing}>
                  <PasswordField
                    label="当前密码"
                    name="old_password"
                    autoComplete="current-password"
                    required
                  />
                  <PasswordField
                    label="新密码"
                    name="new_password"
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                  <p className="field-hint">新密码至少 10 位</p>
                  <PasswordField
                    label="确认新密码"
                    name="confirm_password"
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                  <button className="primary">{changing ? '正在修改…' : '修改密码'}</button>
                </fieldset>
              </form>
            </>
          ) : (
            <div className="local-security">
              <Monitor size={34} />
              <h3>专属于这台电脑</h3>
              <p>
                本地模式无需登录。
                <br />
                工作台仅允许本机访问。
              </p>
              <span className="badge released">本机访问保护已启用</span>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="card-heading">
            <span className="status-icon">
              <Database />
            </span>
            <div>
              <h2>数据备份</h2>
              <p>为每一次设计保留保障</p>
            </div>
          </div>
          <div className="backup-visual">
            <Database size={48} />
            <span className="badge released">
              <Check size={12} />
              每日自动备份
            </span>
          </div>
          <h3>安心设计，随时备份</h3>
          <p>
            保存当前工程数据，便于恢复与迁移。
            <br />
            本地与云端数据独立保存。
          </p>
          <button className="primary" disabled={backing} onClick={backup}>
            {backing ? <LoaderCircle className="spin" size={16} /> : <Database size={16} />}{' '}
            {backing ? '正在备份…' : '立即备份'}
          </button>
          {backed && (
            <p role="status" className="success backup-success">
              <Check size={15} />
              本次备份已完成
            </p>
          )}
        </article>
        <article className="panel machine-settings">
          <div className="card-heading">
            <span className="status-icon">
              <Cpu />
            </span>
            <div>
              <h2>
                固定机器参数 <span className="badge">只读</span>
              </h2>
              <p>标准尺寸参考</p>
            </div>
            <MachineReference />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  {Object.values(data.machines).map((s) => (
                    <th key={s.name}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['名义直径', 'diameter'],
                  ['标准节长', 'section_length'],
                  ['标准螺杆长度', 'element_length'],
                  ['机筒长度', 'barrel_length'],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    {Object.values(data.machines).map((s) => (
                      <td className="numeric" key={s.name}>
                        {s[key]} <small>mm</small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">实际加工内径、外径与配合间隙请按供应商图纸核对。</p>
        </article>
      </div>
    </section>
  );
}
