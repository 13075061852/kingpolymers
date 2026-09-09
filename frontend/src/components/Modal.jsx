import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
  busy = false,
}) {
  const ref = useRef(null),
    timer = useRef(null),
    titleId = useId();
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = ref.current,
      prior = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      clearTimeout(timer.current);
      dialog.close();
      document.body.style.overflow = overflow;
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  function close() {
    if (busy || closing) return;
    setClosing(true);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onClose();
    else timer.current = setTimeout(onClose, 160);
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy}
      className={['modal', wide && 'wide', drawer && 'drawer', closing && 'closing']
        .filter(Boolean)
        .join(' ')}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">KINGPOLYMER WORKSPACE</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          className="icon-button"
          onClick={close}
          aria-label="关闭"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
