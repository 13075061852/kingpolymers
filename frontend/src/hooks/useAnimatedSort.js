import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export default function useAnimatedSort({
  ids,
  names,
  disabled,
  onMove,
  onInsert,
  kind = 'sequence',
}) {
  const list = useRef(null),
    current = useRef(null),
    before = useRef(null),
    landing = useRef(null);
  const frame = useRef(0),
    ghost = useRef(null),
    animations = useRef([]);
  const options = useRef(null);
  options.current = { ids, names, disabled, onMove, onInsert };
  const [drag, setDrag] = useState(null);
  function capture() {
    before.current = new Map(
      [...list.current.querySelectorAll('[data-sort-id]')].map((el) => [
        el.dataset.sortId,
        el.getBoundingClientRect().top,
      ]),
    );
    animations.current.forEach((a) => a.cancel());
    animations.current = [];
  }
  useLayoutEffect(() => {
    const positions = before.current;
    if (positions && !reduced()) {
      for (const el of list.current.querySelectorAll('[data-sort-id]')) {
        // Measure the new natural position before FLIP; a leftover preview
        // transition would otherwise apply the displacement a second time.
        el.style.transition = 'none';
        const top = el.getBoundingClientRect().top;
        el.style.transition = '';
        const delta = (positions.get(el.dataset.sortId) ?? top) - top;
        if (Math.abs(delta) > 1 && el.animate)
          animations.current.push(
            el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
              duration: 200,
              easing: 'cubic-bezier(.2,.8,.2,1)',
            }),
          );
      }
      const el = list.current.querySelectorAll('[data-sort-id]')[landing.current];
      if (el?.animate)
        animations.current.push(
          el.animate(
            [
              { backgroundColor: '#ccebe9' },
              { backgroundColor: getComputedStyle(el).backgroundColor },
            ],
            { duration: 400 },
          ),
        );
    }
    before.current = null;
    landing.current = null;
  }, [ids.join('|')]);
  function cancel() {
    current.current = null;
    cancelAnimationFrame(frame.current);
    ghost.current?.remove();
    ghost.current = null;
    setDrag(null);
  }
  useEffect(() => {
    const escape = (e) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      cancelAnimationFrame(frame.current);
      ghost.current?.remove();
      animations.current.forEach((a) => a.cancel());
    };
  }, []);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);
  function begin(e, from, name) {
    if (options.current.disabled) {
      e.preventDefault();
      return;
    }
    const geometry = [...list.current.querySelectorAll('[data-sort-id]')].map((el) => ({
      top: el.offsetTop,
      height: el.offsetHeight,
    }));
    const next = {
      from,
      name,
      target: null,
      geometry,
      height: from == null ? 32 : geometry[from].height,
      point: null,
    };
    current.current = next;
    setDrag({ ...next });
    e.dataTransfer.effectAllowed = from == null ? 'copy' : 'move';
    e.dataTransfer.setData(
      from == null ? 'text/component' : `text/${kind}-index`,
      from == null ? name : String(from),
    );
    const image = document.createElement('div');
    image.className = 'sort-drag-image';
    image.textContent = name;
    document.body.append(image);
    ghost.current = image;
    e.dataTransfer.setDragImage?.(image, 18, 16);
  }
  function locate(clientY) {
    const d = current.current;
    if (!d) return;
    const y = clientY - list.current.getBoundingClientRect().top + list.current.scrollTop;
    let target = d.geometry.findIndex((row) => y < row.top + row.height / 2);
    if (target < 0) target = d.geometry.length;
    if (d.target !== target) {
      d.target = target;
      setDrag({ ...d });
    }
  }
  function scroll() {
    const d = current.current,
      el = list.current;
    if (!d?.point || !el) return;
    const bounds = el.getBoundingClientRect(),
      y = d.point.y;
    const speed =
      y < bounds.top + 40
        ? -Math.min(12, (bounds.top + 40 - y) / 3)
        : y > bounds.bottom - 40
          ? Math.min(12, (y - bounds.bottom + 40) / 3)
          : 0;
    if (speed) {
      el.scrollTop += speed;
      locate(y);
    }
    frame.current = requestAnimationFrame(scroll);
  }
  function over(e) {
    if (!current.current || options.current.disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = current.current.from == null ? 'copy' : 'move';
    current.current.point = { y: e.clientY };
    locate(e.clientY);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(scroll);
  }
  function finish(e) {
    const d = current.current;
    if (!d || options.current.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    locate(e.clientY);
    const to = d.from == null ? d.target : d.target > d.from ? d.target - 1 : d.target;
    capture();
    landing.current = to;
    cancel();
    if (d.from == null) options.current.onInsert?.(d.name, to);
    else if (d.from !== to) options.current.onMove(d.from, to);
    else {
      before.current = null;
      landing.current = null;
    }
  }
  function shift(index) {
    if (!drag || drag.target == null) return 0;
    if (drag.from == null) return index >= drag.target ? drag.height : 0;
    const to = drag.target > drag.from ? drag.target - 1 : drag.target;
    // Keep the native drag source stationary: moving it under the pointer makes
    // Chromium treat the destination as a drop onto the source itself.
    if (index === drag.from) return 0;
    if (index > drag.from && index <= to) return -drag.height;
    if (index < drag.from && index >= to) return drag.height;
    return 0;
  }
  let slot = null;
  if (drag?.target != null) {
    const to = drag.target > drag.from ? drag.target - 1 : drag.target;
    const top =
      drag.from == null
        ? (drag.geometry[drag.target]?.top ??
          (drag.geometry.at(-1)?.top || 0) + (drag.geometry.at(-1)?.height || 0))
        : drag.geometry[to].top + (to > drag.from ? drag.geometry[to].height - drag.height : 0);
    slot = { top, height: drag.height, name: drag.name };
  }
  return {
    list,
    drag,
    slot,
    capture,
    cancel,
    startExternal: (e, name) => begin(e, null, name),
    listProps: {
      onDragEnter: over,
      onDragOver: over,
      onDrop: finish,
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && current.current) {
          current.current.target = null;
          current.current.point = null;
          cancelAnimationFrame(frame.current);
          setDrag({ ...current.current });
        }
      },
    },
    rowProps(index) {
      return {
        'data-sort-id': ids[index],
        'data-drag-source': drag?.from === index || undefined,
        draggable: !disabled,
        style: { transform: `translateY(${shift(index)}px)` },
        onDragStart: (e) => begin(e, index, names[index]),
        onDragEnd: cancel,
      };
    },
    extraSpace: drag?.from == null && drag?.target != null ? drag.height : 0,
  };
}
