import { useEffect, useRef, useState } from 'react';
import { Box, RotateCcw, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import ComponentModels from '../domain/component-models.js';
export default function ScrewPreview({ hero = false, item, spec }) {
  const host = useRef(null),
    scene = useRef(null);
  const [status, setStatus] = useState('loading'),
    [auto, setAuto] = useState(hero);
  const name = item?.name,
    type = item?.type,
    length = item?.length,
    pitch = item?.pitch,
    discs = item?.discs,
    angle = item?.angle,
    direction = item?.direction;
  useEffect(() => {
    let cancelled = false,
      instance;
    setStatus('loading');
    (hero ? import('../lib/heroScene.js') : import('../lib/scene3d.js'))
      .then(({ createScene }) => {
        if (cancelled) return;
        try {
          instance = createScene(host.current, {
            hero,
            model: item ? ComponentModels.model(item) : {},
            onState: setStatus,
          });
          scene.current = instance;
          instance.setAuto(auto);
          if (!hero) setStatus('ready');
        } catch {
          if (!cancelled) setStatus('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback');
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      scene.current = null;
    };
  }, [hero, name, type, length, pitch, discs, angle, direction]);
  return (
    <div data-state={status} className={'screw-preview ' + (hero ? 'hero-preview' : '')}>
      <div className="scene-host" ref={host} />
      {hero && (
        <img
          className="hero-poster"
          src="/assets/login/screw-fallback.webp"
          alt="螺杆组合立体示意"
          fetchPriority="high"
          loading="eager"
        />
      )}
      {!hero && status !== 'ready' && (
        <div className="scene-fallback">
          {item && spec ? (
            <div
              className="detail-symbol"
              dangerouslySetInnerHTML={{
                __html: ComponentModels.symbol(item, spec, { id: 'fallback', thumbnail: true }),
              }}
            />
          ) : (
            <>
              <Box size={68} />
              <span>双螺杆工程工作台</span>
            </>
          )}
          {status === 'loading' && <span className="scene-loading">正在加载立体预览…</span>}
        </div>
      )}
      {status === 'ready' && !hero && (
        <div className="scene-controls">
          <span>拖动旋转 · 立体示意</span>
          <div>
            <button
              type="button"
              className="icon-button"
              aria-label="向左旋转"
              onClick={() => scene.current?.rotate(-0.4)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="向右旋转"
              onClick={() => scene.current?.rotate(0.4)}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="重置视角"
              onClick={() => scene.current?.reset()}
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={auto ? '暂停旋转' : '自动旋转'}
              aria-pressed={auto}
              onClick={() => {
                setAuto(!auto);
                scene.current?.setAuto(!auto);
              }}
            >
              {auto ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
