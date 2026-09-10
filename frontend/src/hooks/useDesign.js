import { useCallback, useLayoutEffect, useReducer, useState } from 'react';
import { emptyDesign } from '../domain/design.js';
const clone = (value) => structuredClone(value);
const fingerprint = ({ machine, sequence, ports, metadata }) =>
  JSON.stringify({ machine, sequence, ports, metadata });
export function designReducer(state, action) {
  if (action.type === 'restore') return action.history;
  if (action.type === 'load') {
    const design = clone(action.design);
    const dirty = !design.id && !!(design.sequence.length || design.metadata.drawing_name);
    return {
      current: design,
      past: [],
      future: [],
      dirty,
      baseline: dirty ? null : fingerprint(design),
      storageKey: state.storageKey,
    };
  }
  if (action.type === 'saved') {
    const identity = (d) => ({ ...d, id: action.id, status: 'draft' });
    return {
      ...state,
      current: identity(state.current),
      past: state.past.map(identity),
      future: state.future.map(identity),
      baseline: fingerprint(state.current),
      dirty: false,
    };
  }
  if (action.type === 'undo' || action.type === 'redo') {
    const undo = action.type === 'undo';
    if (!(undo ? state.past : state.future).length) return state;
    const current = undo ? state.past.at(-1) : state.future[0];
    return {
      ...state,
      current,
      past: undo ? state.past.slice(0, -1) : [...state.past, state.current].slice(-80),
      future: undo ? [state.current, ...state.future] : state.future.slice(1),
      dirty: fingerprint(current) !== state.baseline,
    };
  }
  if (action.type === 'edit') {
    const next = clone(state.current);
    action.update(next);
    if (fingerprint(next) === fingerprint(state.current)) return state;
    return {
      ...state,
      current: next,
      past: [...state.past, state.current].slice(-80),
      future: [],
      dirty: fingerprint(next) !== state.baseline,
    };
  }
  return state;
}
export default function useDesign() {
  const [storageError, setStorageError] = useState('');
  const [history, dispatch] = useReducer(designReducer, undefined, () => {
    const current = emptyDesign();
    return { current, past: [], future: [], dirty: false, baseline: fingerprint(current) };
  });
  const restore = useCallback((account) => {
    const storageKey = `kingpolymers:design:v1:${encodeURIComponent(account)}`;
    const current = emptyDesign();
    let restored = { current, baseline: fingerprint(current), dirty: false };
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey));
      if (
        cached &&
        ['50', '60'].includes(cached.current?.machine) &&
        Array.isArray(cached.current.sequence) &&
        cached.current.sequence.every((name) => typeof name === 'string') &&
        cached.current.ports &&
        typeof cached.current.ports === 'object' &&
        cached.current.metadata &&
        typeof cached.current.metadata === 'object' &&
        (cached.baseline === null || typeof cached.baseline === 'string')
      ) {
        restored = {
          current: cached.current,
          baseline: cached.baseline,
          dirty: fingerprint(cached.current) !== cached.baseline,
        };
      }
    } catch {
      // Unavailable or invalid local storage must not prevent opening the editor.
    }
    dispatch({ type: 'restore', history: { ...restored, past: [], future: [], storageKey } });
  }, []);
  useLayoutEffect(() => {
    if (!history.storageKey) return;
    try {
      localStorage.setItem(
        history.storageKey,
        JSON.stringify({
          current: history.current,
          baseline: history.baseline,
        }),
      );
      setStorageError('');
    } catch {
      setStorageError('浏览器本地存储失败，刷新可能丢失修改。请导出备份或手动保存方案。');
    }
  }, [history]);
  const edit = useCallback((update) => dispatch({ type: 'edit', update }), []);
  const load = useCallback((design) => dispatch({ type: 'load', design }), []);
  return {
    design: history.current,
    restore,
    storageError,
    dirty: history.dirty,
    edit,
    load,
    saved: (id) => dispatch({ type: 'saved', id }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
