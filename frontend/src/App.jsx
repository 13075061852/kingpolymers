import { useCallback, useEffect, useState } from 'react';
import {
  Layers3,
  FolderOpen,
  Boxes,
  Package,
  Settings as SettingsIcon,
  LogOut,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { api, setSession } from './lib/api.js';
import useDesign from './hooks/useDesign.js';
import Designer from './pages/Designer.jsx';
import Projects from './pages/Projects.jsx';
import Components from './pages/Components.jsx';
import Inventory from './pages/Inventory.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Modal from './components/Modal.jsx';

const pages = [
  ['designer', '组合设计', Layers3],
  ['projects', '项目方案', FolderOpen],
  ['components', '元件库', Boxes],
  ['inventory', '库存', Package],
  ['settings', '设置', SettingsIcon],
];
export default function App() {
  const [data, setData] = useState(null),
    [login, setLogin] = useState(false),
    [initialError, setInitialError] = useState(''),
    [page, setPage] = useState('designer'),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(null),
    [modal, setModal] = useState(null),
    [print, setPrint] = useState('');
  const editor = useDesign();
  const notify = useCallback((message, error = false) => setToast({ message, error }), []);
  const refresh = useCallback(async () => {
    const next = await api('/bootstrap');
    setSession(next.auth);
    setData(next);
    return next;
  }, []);
  const initialize = useCallback(async () => {
    setInitialError('');
    try {
      const session = await api('/auth/session');
      setSession(session);
      if (session.enabled && !session.authenticated) {
        setLogin(true);
        return;
      }
      await refresh();
      setLogin(false);
    } catch (error) {
      setInitialError(error.message);
    }
  }, [refresh]);
  useEffect(() => {
    initialize();
    const expired = () => {
      setSession(null);
      setData(null);
      setLogin(true);
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [initialize]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const leave = (event) => {
      if (editor.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [editor.dirty]);
  async function run(work) {
    setBusy(true);
    try {
      await work();
      return true;
    } catch (error) {
      notify(error.message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(asNew, approval = {}) {
    const payload = { ...editor.design, ...approval, ...(asNew ? { id: null } : {}) };
    if (editor.design.status === 'released' && !asNew) {
      notify('已发布项目不能直接修改，请另存为新方案', true);
      return;
    }
    setBusy(true);
    try {
      const result = await api('/projects', payload);
      editor.saved(result.id);
      await refresh();
      setModal(null);
      notify('方案已保存');
    } catch (error) {
      if (error.status === 409 && error.details.validation)
        setModal({ type: 'approval', asNew, error: error.message });
      else notify(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  function askAction(action, project) {
    setModal({ type: 'action', action, project });
  }
  async function projectAction(fields) {
    const { action, project } = modal;
    await run(async () => {
      if (action === 'delete') await api('/projects/' + project.id, undefined, 'DELETE');
      else await api(`/projects/${project.id}/${action}`, fields);
      await refresh();
      setModal(null);
      notify('操作完成');
    });
  }
  async function openProject(id) {
    if (editor.dirty && !confirm('当前方案有未保存修改，继续打开其他方案？')) return;
    await run(async () => {
      const project = await api('/projects/' + id);
      editor.load(project);
      setPage('designer');
      notify('已打开方案');
    });
  }
  async function logout() {
    if (editor.dirty && !confirm('当前方案未保存，确定退出登录？')) return;
    await run(async () => {
      await api('/auth/logout', {});
      setSession(null);
      setData(null);
      setLogin(true);
    });
  }
  if (login) return <Login onLogin={initialize} />;
  if (!data)
    return (
      <main className="loading">
        <img src="/brand-logo.svg" alt="" />
        <h1>kingpolymer</h1>
        <p>{initialError || '正在加载工程工作台…'}</p>
        {initialError && <button onClick={initialize}>重试连接</button>}
      </main>
    );
  return (
    <>
      <div className={`app-shell ${print ? 'printing' : ''}`}>
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage('designer');
            }}
          >
            <img src="/brand-logo.svg" alt="KP" />
            <span>
              kingpolymer<small>TWIN-SCREW WORKSPACE</small>
            </span>
          </a>
          <nav aria-label="主导航">
            {pages.map(([key, label, Icon]) => (
              <button
                className={page === key ? 'active' : ''}
                key={key}
                onClick={() => setPage(key)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="account">
            <i />
            {data.auth.enabled ? data.auth.username : '本地工作台'}
            {data.auth.enabled && (
              <button aria-label="退出登录" className="icon-button" onClick={logout}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>
        <main inert={busy || undefined}>
          {page === 'designer' && (
            <Designer
              data={data}
              editor={editor}
              onSave={save}
              onProjects={() => setPage('projects')}
              run={run}
              notify={notify}
              onPrint={setPrint}
            />
          )}
          {page === 'projects' && (
            <Projects
              data={data}
              onOpen={openProject}
              onAction={askAction}
              onRefresh={() => run(refresh)}
            />
          )}
          {page === 'components' && (
            <Components
              data={data}
              onSave={(fields) =>
                run(async () => {
                  await api('/components', fields);
                  await refresh();
                  notify('元件已保存');
                })
              }
              onDelete={(item) => setModal({ type: 'component-delete', item })}
            />
          )}
          {page === 'inventory' && (
            <Inventory
              data={data}
              onAdjust={(fields) =>
                run(async () => {
                  await api('/inventory/adjust', fields);
                  await refresh();
                  notify('库存已更新');
                })
              }
              onHistory={() =>
                run(async () =>
                  setModal({ type: 'history', rows: await api('/inventory/history') }),
                )
              }
            />
          )}
          {page === 'settings' && (
            <Settings
              data={data}
              onBackup={() =>
                run(async () => {
                  const result = await api('/backup', {});
                  notify('备份完成：' + result.file);
                })
              }
              onPassword={(fields) =>
                run(async () => {
                  if (fields.new_password !== fields.confirm_password)
                    throw Error('两次新密码不一致');
                  await api('/auth/password', fields);
                  setSession(null);
                  setLogin(true);
                  setData(null);
                })
              }
            />
          )}
        </main>
        <footer className="app-footer">
          <span>kingpolymer · React edition</span>
          <span>工程数据保存在当前服务中</span>
        </footer>
      </div>
      {busy && (
        <div role="status" className="busy">
          正在处理…
        </div>
      )}
      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`toast ${toast.error ? 'error' : ''}`}
        >
          {toast.error ? <X size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal?.type === 'approval' && (
        <Modal title="方案需要工程复核" onClose={() => setModal(null)}>
          <p className="warning">{modal.error}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(modal.asNew, Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <fieldset disabled={busy}>
              <label>
                复核原因
                <textarea name="override_reason" required />
              </label>
              <label>
                负责人确认码
                <input name="confirm_code" type="password" required autoComplete="off" />
              </label>
              <footer>
                <button type="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button className="primary">确认并保存</button>
              </footer>
            </fieldset>
          </form>
        </Modal>
      )}
      {modal?.type === 'action' && (
        <Modal
          title={
            { release: '发布生产方案', void: '作废方案并退回库存', delete: '删除方案' }[
              modal.action
            ]
          }
          onClose={() => setModal(null)}
        >
          <p>{modal.project.name}</p>
          <p className="muted">
            {modal.action === 'release'
              ? '发布后按元件数量扣减库存，方案将禁止直接编辑。'
              : modal.action === 'void'
                ? '已扣减的库存将按方案退回。'
                : '此操作将删除该方案记录。'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              projectAction(Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <fieldset disabled={busy}>
              {modal.action !== 'delete' && (
                <>
                  <label>
                    原因
                    <input
                      name="reason"
                      required
                      defaultValue={modal.action === 'release' ? '正式发布' : '生产单作废'}
                    />
                  </label>
                  {modal.action === 'release' && (
                    <label>
                      负责人确认码（存在异常时必填）
                      <input name="confirm_code" type="password" autoComplete="off" />
                    </label>
                  )}
                </>
              )}
              <footer>
                <button type="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button className="primary">确认操作</button>
              </footer>
            </fieldset>
          </form>
        </Modal>
      )}
      {modal?.type === 'component-delete' && (
        <Modal title="删除元件" onClose={() => setModal(null)}>
          <p>将停用元件 {modal.item.name}，历史记录保留。</p>
          <footer>
            <button onClick={() => setModal(null)}>取消</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api('/components/' + modal.item.id, undefined, 'DELETE');
                  await refresh();
                  setModal(null);
                  notify('元件已删除');
                })
              }
            >
              确认删除
            </button>
          </footer>
        </Modal>
      )}
      {modal?.type === 'history' && (
        <Modal title="出入库记录" onClose={() => setModal(null)} wide>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>型号</th>
                  <th>数量变化</th>
                  <th>原因</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {modal.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      {row.delta > 0 ? '+' : ''}
                      {row.delta}
                    </td>
                    <td>{row.reason}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!modal.rows.length && <p className="empty">暂无出入库记录</p>}
          </div>
        </Modal>
      )}
      {print && (
        <div className="print-preview">
          <header>
            <button onClick={() => setPrint('')}>
              <ArrowLeft size={16} />
              返回编辑
            </button>
            <strong>工程图预览</strong>
            <button className="primary" onClick={() => window.print()}>
              打印 / 保存 PDF
            </button>
          </header>
          <div id="printRoot" dangerouslySetInnerHTML={{ __html: print }} />
        </div>
      )}
    </>
  );
}
