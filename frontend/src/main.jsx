import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './pages/Login.jsx';
import { api } from './lib/api.js';
import './styles.css';

const loadWorkspace = () => import('./App.jsx');
const App = lazy(loadWorkspace);
function Entry() {
  const [screen, setScreen] = useState(() =>
    location.pathname === '/login' ? 'checking' : 'workspace',
  );
  const [sessionError, setSessionError] = useState('');
  function openWorkspace() {
    if (location.pathname === '/login') history.replaceState(null, '', '/');
    setScreen('workspace');
  }
  useEffect(() => {
    if (screen !== 'checking') return;
    let active = true;
    api('/auth/session')
      .then((session) => {
        if (!active) return;
        if (!session.enabled || session.authenticated) openWorkspace();
        else setScreen('login');
      })
      .catch((error) => {
        if (active) setSessionError(error.message || '登录状态检查失败');
      });
    return () => {
      active = false;
    };
  }, [screen]);
  if (screen === 'checking')
    return (
      <main className="loading" role="status">
        {sessionError ? (
          <>
            <p>{sessionError}</p>
            <button onClick={() => location.reload()}>重试</button>
          </>
        ) : (
          '正在恢复工作台…'
        )}
      </main>
    );
  return screen === 'workspace' ? (
    <Suspense fallback={<main className="loading">正在打开工作台…</main>}>
      <App />
    </Suspense>
  ) : (
    <Login
      onLogin={async () => {
        await loadWorkspace();
        openWorkspace();
      }}
    />
  );
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="loading">
          <h1>页面暂时无法显示</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => location.reload()}>重新加载</button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <Entry />
  </ErrorBoundary>,
);
