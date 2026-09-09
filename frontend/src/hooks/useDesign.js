import { useCallback, useReducer } from 'react';
import { emptyDesign } from '../domain/design.js';
const clone = (value) => structuredClone(value);
const fingerprint = ({ machine, sequence, ports, metadata }) =>
  JSON.stringify({ machine, sequence, ports, metadata });
export function designReducer(state, action) {
  if (action.type === 'load') {
    const design = clone(action.design);
    const dirty = !design.id && !!(design.sequence.length || design.metadata.drawing_name);
    return {
      current: design,
      past: [],
      future: [],
      dirty,
      baseline: dirty ? null : fingerprint(design),
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
  const [history, dispatch] = useReducer(designReducer, undefined, () => {
    const current = emptyDesign();
    return { current, past: [], future: [], dirty: false, baseline: fingerprint(current) };
  });
  const edit = useCallback((update) => dispatch({ type: 'edit', update }), []);
  const load = useCallback((design) => dispatch({ type: 'load', design }), []);
  return {
    design: history.current,
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
