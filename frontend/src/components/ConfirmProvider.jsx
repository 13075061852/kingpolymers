import { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal.jsx';
const Context = createContext(async () => true);
export const useConfirm = () => useContext(Context);
export default function ConfirmProvider({ children }) {
  const [question, setQuestion] = useState(null);
  const pending = useRef(null);
  const ask = useCallback(
    (message, options = {}) =>
      new Promise((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setQuestion({ message, ...options });
      }),
    [],
  );
  useEffect(() => () => pending.current?.(false), []);
  function answer(value) {
    pending.current?.(value);
    pending.current = null;
    setQuestion(null);
  }
  return (
    <Context.Provider value={ask}>
      {children}
      {question && (
        <Modal title={question.title || '确认操作'} onClose={() => answer(false)}>
          <div className="confirm-message">
            <span className="status-icon amber">
              <AlertTriangle />
            </span>
            <p>{question.message}</p>
          </div>
          <footer>
            <button autoFocus onClick={() => answer(false)}>
              取消
            </button>
            <button className={question.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
              {question.action || '继续'}
            </button>
          </footer>
        </Modal>
      )}
    </Context.Provider>
  );
}
