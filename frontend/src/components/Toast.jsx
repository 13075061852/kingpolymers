import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
// Native dialogs live in the browser top layer, above every ordinary z-index.
export default function Toast({ message, error, onClose }) {
  const [target, setTarget] = useState(document.body);
  useLayoutEffect(() => {
    const update = () =>
      setTarget([...document.querySelectorAll('dialog[open]')].at(-1) || document.body);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, []);
  return createPortal(
    <div role={error ? 'alert' : 'status'} className={'toast ' + (error ? 'error' : '')}>
      {error ? <X size={18} /> : <Check size={18} />}
      <span>{message}</span>
      <button aria-label="关闭提示" onClick={onClose}>
        <X size={15} />
      </button>
    </div>,
    target,
  );
}
