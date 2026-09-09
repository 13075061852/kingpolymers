import { useEffect, useRef, useState } from 'react';

export default function WorkspaceSplitter() {
  const handle = useRef(null);
  const drag = useRef(null);
  const [height, setHeight] = useState(300);
  const resize = (value) => {
    const workspace = handle.current.parentElement;
    const max = Math.max(200, workspace.clientHeight - 290);
    const next = Math.round(Math.max(200, Math.min(max, value)));
    workspace.style.setProperty('--drawing-height', `${next}px`);
    setHeight(next);
  };
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const workspace = handle.current.parentElement;
    const observer = new ResizeObserver(() => {
      if (workspace.style.getPropertyValue('--drawing-height'))
        resize(handle.current.previousElementSibling.getBoundingClientRect().height);
      else
        setHeight(Math.round(handle.current.previousElementSibling.getBoundingClientRect().height));
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={handle}
      className="workspace-splitter"
      role="separator"
      aria-label="调整画布高度"
      aria-orientation="horizontal"
      aria-valuemin={200}
      aria-valuenow={height}
      tabIndex={0}
      title="拖动调整画布高度；双击复位"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        drag.current = {
          y: e.clientY,
          height: e.currentTarget.previousElementSibling.getBoundingClientRect().height,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) resize(drag.current.height + e.clientY - drag.current.y);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onDoubleClick={() => {
        handle.current.parentElement.style.removeProperty('--drawing-height');
        requestAnimationFrame(() =>
          setHeight(
            Math.round(handle.current.previousElementSibling.getBoundingClientRect().height),
          ),
        );
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          resize(height + (e.key === 'ArrowUp' ? -24 : 24));
        }
      }}
    >
      <span />
    </div>
  );
}
