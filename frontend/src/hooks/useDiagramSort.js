import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function useDiagramSort({
  root,
  items,
  disabled,
  visibleRight,
  onMove,
  onSelect,
  onRemove,
  onDragChange,
}) {
  const floating = useRef(null);
  const current = useRef(null),
    before = useRef(null),
    landing = useRef(null),
    frame = useRef(0),
    animations = useRef([]),
    latest = useRef(null);
  const [drag, setDrag] = useState(null);
  latest.current = { items, disabled, visibleRight, onMove, onSelect, onRemove };

  useEffect(() => {
    onDragChange?.(!!drag?.active);
    return () => onDragChange?.(false);
  }, [!!drag?.active, onDragChange]);
  function overDelete(x, y) {
    const box = document.querySelector('[data-element-delete-zone]')?.getBoundingClientRect();
    return box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  function pointX(clientX, clientY) {
    const svg = root.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse()).x;
  }

  function slotX(target, rows = latest.current.items, from = current.current?.from) {
    if (!rows.length || from == null) return 0;
    const source = rows[from],
      remaining = rows.filter((_, index) => index !== from);
    if (target === 0 && from > 0 && Number.isFinite(latest.current.visibleRight))
      return latest.current.visibleRight - source.width;
    let right = rows[0].x + rows[0].width;
    for (let index = 0; index < target; index++) right -= remaining[index].width;
    return right - source.width;
  }

  function shift(index, state = drag, rows = items) {
    if (!state?.active) return 0;
    if (index === state.from) return state.left - rows[index].x;
    if (state.target > state.from && index > state.from && index <= state.target)
      return rows[state.from].width;
    if (state.target < state.from && index >= state.target && index < state.from)
      return -rows[state.from].width;
    return 0;
  }

  function capture(state) {
    const rows = latest.current.items;
    before.current = new Map(
      rows.map((item, index) => [item.id, item.x + shift(index, state, rows)]),
    );
  }

  function clearFloating() {
    floating.current?.remove();
    floating.current = null;
  }
  function followPointer(state, clientX, clientY) {
    if (Math.abs(clientY - state.startClientY) <= 12) {
      clearFloating();
      return false;
    }
    if (!floating.current) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const box = state.bounds,
        local = state.localBounds;
      svg.setAttribute('viewBox', `${local.x} ${local.y} ${local.width} ${local.height}`);
      svg.setAttribute('data-diagram-floating', 'true');
      svg.setAttribute('aria-hidden', 'true');
      Object.assign(svg.style, {
        position: 'fixed',
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        pointerEvents: 'none',
        zIndex: '1200',
        overflow: 'visible',
      });
      const clone = state.capture.cloneNode(true);
      clone.removeAttribute('style');
      clone.removeAttribute('tabindex');
      clone.removeAttribute('data-element-index');
      clone.removeAttribute('data-sort-id');
      clone.removeAttribute('data-diagram-sort-id');
      svg.append(clone);
      document.body.append(svg);
      floating.current = svg;
    }
    floating.current.style.transform = `translate(${clientX - state.startClientX}px, ${clientY - state.startClientY}px)`;
    return true;
  }
  function stopScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }

  function stopAnimations() {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
  }

  function releaseCapture(state) {
    try {
      if (state?.capture?.hasPointerCapture?.(state.pointerId))
        state.capture.releasePointerCapture(state.pointerId);
    } catch {
      // The browser may already have released capture after pointerup.
    }
  }

  function cancel(animate = true) {
    const state = current.current;
    if (!state) return;
    if (animate && state.active) capture(state);
    current.current = null;
    clearFloating();
    stopScroll();
    releaseCapture(state);
    setDrag(null);
  }

  useLayoutEffect(() => {
    const positions = before.current;
    if (!positions) return;
    before.current = null;
    stopAnimations();
    if (reduced()) {
      landing.current = null;
      return;
    }
    const nodes = new Map(
      [...(root.current?.querySelectorAll('[data-diagram-sort-id]') || [])].map((node) => [
        node.dataset.diagramSortId,
        node,
      ]),
    );
    for (const item of items) {
      const node = nodes.get(item.id),
        delta = (positions.get(item.id) ?? item.x) - item.x;
      if (node?.animate && Math.abs(delta) > 0.1)
        animations.current.push(
          node.animate(
            [{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0px)' }],
            { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
          ),
        );
    }
    const landed = nodes.get(landing.current);
    if (landed?.animate)
      animations.current.push(
        landed.animate(
          [
            { opacity: 0.72, filter: 'drop-shadow(0 0 4px #168a94)' },
            { opacity: 1, filter: 'drop-shadow(0 0 0 transparent)' },
          ],
          { duration: 360, easing: 'ease-out' },
        ),
      );
    landing.current = null;
  });

  function update(clientX, clientY) {
    const state = current.current,
      rows = latest.current.items,
      x = pointX(clientX, clientY);
    if (!state || x == null || !rows[state.from] || rows[state.from].id !== state.id) return;
    const source = rows[state.from],
      naturalRight = rows[0].x + rows[0].width,
      overallRight =
        state.from > 0 && Number.isFinite(latest.current.visibleRight)
          ? Math.min(naturalRight, latest.current.visibleRight)
          : naturalRight,
      overallLeft = rows.at(-1).x,
      left = clamp(source.x + x - state.startX, overallLeft, overallRight - source.width),
      remaining = rows.filter((_, index) => index !== state.from);
    let target = 0,
      distance = Infinity;
    for (let candidate = 0; candidate <= remaining.length; candidate++) {
      const candidateX = slotX(candidate, rows, state.from),
        nextDistance = Math.abs(left - candidateX);
      if (nextDistance < distance) {
        distance = nextDistance;
        target = candidate;
      }
    }
    document
      .querySelector('[data-element-delete-zone]')
      ?.classList.toggle('delete-hover', !!overDelete(clientX, clientY));
    const detached = followPointer(state, clientX, clientY);
    const next = { ...state, active: true, detached, left, target, clientX, clientY };
    current.current = next;
    setDrag(next);
  }

  function scroll() {
    const state = current.current,
      scroller = root.current?.closest('.drawing-scroll');
    if (!state?.active || !scroller) {
      frame.current = 0;
      return;
    }
    const bounds = scroller.getBoundingClientRect(),
      margin = Math.min(44, bounds.width / 5),
      speed =
        state.clientX < bounds.left + margin
          ? -Math.min(14, (bounds.left + margin - state.clientX) / 3)
          : state.clientX > bounds.right - margin
            ? Math.min(14, (state.clientX - bounds.right + margin) / 3)
            : 0;
    if (speed && scroller.scrollWidth > scroller.clientWidth) {
      const previous = scroller.scrollLeft;
      scroller.scrollLeft += speed;
      if (scroller.scrollLeft !== previous) update(state.clientX, state.clientY);
    }
    frame.current = requestAnimationFrame(scroll);
  }

  function begin(event, index) {
    stopAnimations();
    latest.current.onSelect?.(index);
    if (latest.current.disabled || event.button !== 0 || !latest.current.items.length) return;
    const x = pointX(event.clientX, event.clientY),
      item = latest.current.items[index];
    if (x == null || !item) return;
    event.preventDefault();
    event.currentTarget.focus();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; window coordinates still drive the preview.
    }
    current.current = {
      from: index,
      target: index,
      id: item.id,
      startX: x,
      left: item.x,
      active: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      bounds: event.currentTarget.getBoundingClientRect(),
      localBounds: event.currentTarget.getBBox(),
      capture: event.currentTarget,
    };
  }

  function movePointer(event) {
    const state = current.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (
      !state.active &&
      Math.hypot(event.clientX - state.startClientX, event.clientY - state.startClientY) < 4
    )
      return;
    event.preventDefault();
    update(event.clientX, event.clientY);
    if (!frame.current) frame.current = requestAnimationFrame(scroll);
  }

  function finish(event) {
    const state = current.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (state.active) {
      capture(state);
      landing.current = state.id;
    }
    current.current = null;
    clearFloating();
    stopScroll();
    releaseCapture(state);
    setDrag(null);
    if (state.active && !latest.current.disabled && overDelete(event.clientX, event.clientY)) {
      latest.current.onRemove?.(state.from);
      return;
    }
    if (state.active && state.from !== state.target)
      latest.current.onMove?.(state.from, state.target);
  }

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape') cancel();
    };
    const pointerCancel = (event) => {
      if (current.current?.pointerId === event.pointerId) cancel();
    };
    const blur = () => cancel();
    window.addEventListener('keydown', escape);
    window.addEventListener('pointermove', movePointer, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('pointermove', movePointer);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('blur', blur);
      clearFloating();
      stopScroll();
      stopAnimations();
      releaseCapture(current.current);
    };
  }, []);

  useEffect(() => {
    if (disabled) cancel(false);
  }, [disabled]);

  useEffect(() => {
    const state = current.current;
    if (state && items[state.from]?.id !== state.id) cancel(false);
  }, [items.map((item) => item.id).join('|')]);

  return {
    drag,
    slot:
      drag?.active && drag.target !== drag.from
        ? { x: slotX(drag.target), width: items[drag.from]?.width || 0 }
        : null,
    elementProps(index) {
      const amount = shift(index),
        source = drag?.active && drag.from === index;
      return {
        'data-diagram-sort-id': items[index].id,
        'data-sort-id': items[index].id,
        'data-drag-source': source || undefined,
        'data-diagram-preview-shift': Math.abs(amount) > 0.1 || undefined,
        'aria-grabbed': source || undefined,
        style: {
          cursor: source ? 'grabbing' : disabled ? 'pointer' : 'grab',
          opacity: source ? (drag.detached ? 0 : 0.78) : 1,
          transform: `translateX(${amount}px)`,
          transition: source ? 'none' : 'transform 180ms cubic-bezier(.2,.8,.2,1)',
          touchAction: 'none',
          willChange: drag?.active ? 'transform' : undefined,
        },
        onPointerDown: (event) => begin(event, index),
        onLostPointerCapture: (event) => {
          if (current.current?.pointerId === event.pointerId) cancel();
        },
      };
    },
  };
}
