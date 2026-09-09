import { useCallback, useReducer } from 'react';
import { emptyDesign } from '../domain/design.js';
const clone = (value) => structuredClone(value);
export function designReducer(state, action) {
  if (action.type === 'load')
    return {
      current: clone(action.design),
      past: [],
      future: [],
      dirty:
        !action.design.id &&
        !!(action.design.sequence.length || action.design.metadata.drawing_name),
    };
  if (action.type === 'saved')
    return {
      ...state,
      current: { ...state.current, id: action.id, status: 'draft' },
      dirty: false,
    };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return {
      current: state.past.at(-1),
      past: state.past.slice(0, -1),
      future: [state.current, ...state.future],
      dirty: true,
    };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return {
      current: state.future[0],
      past: [...state.past, state.current],
      future: state.future.slice(1),
      dirty: true,
    };
  }
  if (action.type === 'edit') {
    const next = clone(state.current);
    action.update(next);
    return {
      current: next,
      past: [...state.past, state.current].slice(-80),
      future: [],
      dirty: true,
    };
  }
  return state;
}
export default function useDesign() {
  const [history, dispatch] = useReducer(designReducer, {
    current: emptyDesign(),
    past: [],
    future: [],
    dirty: false,
  });
  const edit = useCallback((update) => dispatch({ type: 'edit', update }), []);
  return {
    design: history.current,
    dirty: history.dirty,
    edit,
    load: (design) => dispatch({ type: 'load', design }),
    saved: (id) => dispatch({ type: 'saved', id }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
