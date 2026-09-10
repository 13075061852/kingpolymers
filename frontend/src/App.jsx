import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Layers3,
  FolderOpen,
  Boxes,
  Package,
  Settings as SettingsIcon,
  LogOut,
  Monitor,
  LoaderCircle,
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
import Toast from './components/Toast.jsx';
import ConfirmProvider, { useConfirm } from './components/ConfirmProvider.jsx';
import PrintPreview from './components/PrintPreview.jsx';
import { emptyDesign, validate } from './domain/design.js';

const pages = [
  ['designer', '组合设计', Layers3],
  ['projects', '项目方案', FolderOpen],
  ['components', '元件库', Boxes],
  ['inventory', '库存', Package],
  ['settings', '设置', SettingsIcon],
];
export default function App() {
  return (
    <ConfirmProvider>
      <Workspace />
    </ConfirmProvider>
  );
}
function Workspace() {
  const ask = useConfirm();
  const working = useRef(false);
  const account = useRef(null);
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
    const identity = next.auth.enabled ? `user:${next.auth.username}` : 'local';
    if (account.current !== identity) editor.restore(identity);
    account.current = identity;
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
      return true;
    } catch (error) {
      setInitialError(error.message);
      return false;
    }
  }, [refresh]);
  useEffect(() => {
    initialize();
    const expired = () => {
      setSession(null);
      setData(null);
      setModal(null);
      setPrint('');
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
    if (editor.storageError) notify(editor.storageError, true);
  }, [editor.storageError, notify]);
  async function run(work) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    try {
      await work();
      return true;
    } catch (error) {
      notify(error.message, true);
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function save(asNew, approval = {}) {
    if (working.current) return;
    if (!asNew && editor.design.id && !editor.dirty) {
      notify('方案已保存');
      return;
    }
    const payload = { ...editor.design, ...approval, ...(asNew ? { id: null } : {}) };
    const lengthCheck = validate(data, editor.design);
    if (lengthCheck.difference > 0) {
      notify(`组合超长 ${lengthCheck.difference} mm，请删减元件后保存。`, true);
      return;
    }
    if (editor.design.status === 'released' && !asNew) {
      notify('已发布项目不能直接修改，请另存为新方案', true);
      return;
    }
    working.current = true;
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
      working.current = false;
      setBusy(false);
    }
  }
  async function askAction(action, project) {
    if (
      editor.design.id === project.id &&
      editor.dirty &&
      !(await ask('当前方案有未保存修改。此操作将使用已保存的方案并放弃编辑内容，是否继续？'))
    )
      return;
    setModal({ type: 'action', action, project });
  }
  async function projectAction(fields) {
    const { action, project } = modal;
    await run(async () => {
      if (action === 'delete') await api('/projects/' + project.id, undefined, 'DELETE');
      else await api(`/projects/${project.id}/${action}`, fields);
      await refresh();
      if (editor.design.id === project.id)
        editor.load(
          action === 'delete'
            ? emptyDesign(editor.design.machine)
            : await api('/projects/' + project.id),
        );
      setModal(null);
      notify('操作完成');
    });
  }
  async function openProject(id) {
    if (
      editor.dirty &&
      !(await ask('当前方案有未保存修改，继续打开其他方案？', {
        title: '保留当前修改？',
        action: '放弃修改并打开',
      }))
    )
      return;
    await run(async () => {
      const project = await api('/projects/' + id);
      editor.load(project);
      setPage('designer');
      notify('已打开方案');
    });
  }
  async function logout() {
    await run(async () => {
      await api('/auth/logout', {});
      account.current = null;
      setPage('designer');
      setSession(null);
      setData(null);
      setLogin(true);
    });
  }
  async function newProject() {
    if (editor.dirty && !(await ask('当前方案尚未保存，是否放弃修改并新建？'))) return;
    editor.load(emptyDesign(editor.design.machine));
    setPage('designer');
  }
  useEffect(() => {
    const shortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (
          data &&
          !login &&
          page === 'designer' &&
          !modal &&
          !print &&
          !document.querySelector('dialog[open]')
        )
          save(false);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  if (login)
    return (
      <Login
        onLogin={async () => {
          if (!(await initialize())) throw Error('登录后加载工作台失败，请确认服务连接后重试。');
        }}
      />
    );
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
      <div
        className={`app-shell ${print ? 'printing' : ''} ${page === 'designer' ? 'design-active' : ''}`}
      >
        <header className="app-topbar">
          <a
            className="brand"
            href="#designer"
            onClick={(e) => {
              e.preventDefault();
              setPage('designer');
            }}
          >
            <img src="/brand-logo.svg" alt="KP" />
            <span>kingpolymer</span>
          </a>
          <nav aria-label="主导航">
            {pages.map(([key, label, Icon]) => (
              <button
                key={key}
                title={label}
                aria-current={page === key ? 'page' : undefined}
                className={page === key ? 'active' : ''}
                onClick={() => setPage(key)}
              >
                <Icon size={15} />
                <span>{label}</span>
                {key === 'designer' && editor.dirty && <i className="unsaved-dot" />}
              </button>
            ))}
          </nav>
          <div className="account">
            <Monitor size={14} />
            <span>{data.auth.enabled ? data.auth.username : '本地'}</span>
            {data.auth.enabled && (
              <button onClick={logout} title="退出登录">
                <LogOut size={14} />
                <span>退出登录</span>
              </button>
            )}
          </div>
        </header>
        <div className="workspace">
          <main className="workspace-content" id="main-content" inert={busy || undefined}>
            <div className="page-transition" key={page}>
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
                  onNew={newProject}
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
                      await api('/backup', {});
                      notify('当前工程数据已备份');
                    })
                  }
                  onPassword={(fields) =>
                    run(async () => {
                      if (fields.new_password !== fields.confirm_password)
                        throw Error('两次新密码不一致');
                      if (
                        editor.dirty &&
                        !(await ask('修改密码后需要重新登录，当前未保存方案将被放弃。是否继续？'))
                      )
                        return;
                      await api('/auth/password', fields);
                      editor.load(emptyDesign());
                      setSession(null);
                      setLogin(true);
                      setData(null);
                    })
                  }
                />
              )}
            </div>
          </main>
        </div>
      </div>
      {busy && (
        <div role="status" className="busy">
          <LoaderCircle size={16} className="spin" />
          正在处理…
        </div>
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {modal?.type === 'approval' && (
        <Modal busy={busy} title="方案需要工程复核" onClose={() => setModal(null)}>
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
          busy={busy}
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
        <Modal busy={busy} title="删除元件" onClose={() => setModal(null)}>
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
      {print && <PrintPreview html={print} onClose={() => setPrint('')} />}
    </>
  );
}
