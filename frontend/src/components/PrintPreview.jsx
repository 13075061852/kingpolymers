import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Printer, ZoomIn, ZoomOut, FileText } from 'lucide-react';
export default function PrintPreview({ html, onClose }) {
  const root = useRef(null),
    [zoom, setZoom] = useState(1),
    [active, setActive] = useState(0);
  const pages = useMemo(
    () =>
      Array.from(
        new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.print-page'),
      ).map((el) => el.innerHTML),
    [html],
  );
  const titles = ['组合图', '机器参数', '安装明细'];
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);
  function jump(index) {
    setActive(index);
    root.current?.children[index]?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }
  return (
    <div className="print-preview" role="region" aria-label="工程图预览">
      <header>
        <button onClick={onClose}>
          <ArrowLeft size={17} />
          返回编辑
        </button>
        <strong>
          工程图预览 <span className="muted">{pages.length} 页</span>
        </strong>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label="缩小预览"
            disabled={zoom <= 0.6}
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <ZoomOut size={17} />
          </button>
          <button onClick={() => setZoom(1)} title="适合窗口">
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="icon-button"
            aria-label="放大预览"
            disabled={zoom >= 1.8}
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
          >
            <ZoomIn size={17} />
          </button>
          <button className="primary" onClick={() => window.print()}>
            <Printer size={17} />
            打印 / 保存 PDF
          </button>
        </div>
      </header>
      <aside className="print-thumbnails" aria-label="图纸页面">
        {pages.map((page, i) => (
          <button key={i} aria-current={active === i ? 'page' : undefined} onClick={() => jump(i)}>
            <div
              className="thumbnail-paper"
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html: page
                  .replace(/id="([^"]+)"/g, 'id="thumb-$1"')
                  .replace(/url\(#([^)]+)\)/g, 'url(#thumb-$1)'),
              }}
            />
            <span>
              <FileText size={13} /> {String(i + 1).padStart(2, '0')} {titles[i] || '工程明细'}
            </span>
          </button>
        ))}
      </aside>
      <div className="paper-scroll">
        <div
          id="printRoot"
          ref={root}
          style={{ width: Math.round(zoom * 100) + '%' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
