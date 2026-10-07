import { useLayoutEffect, useRef, type RefObject, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react';

type Position = { x: number; y: number };
export function constrainPanel(position: Position, width: number, height: number, panelWidth: number, panelHeight: number, minimumTop = 64): Position {
  return { x: Math.max(8, Math.min(position.x, Math.max(8, width - panelWidth - 64))),
    y: Math.max(minimumTop, Math.min(position.y, Math.max(minimumTop, height - panelHeight - 32))) };
}

/** Preserve the heading position as content grows; use the space below it for scrolling. */
export function anchoredPanel(position: Position, width: number, height: number, panelWidth: number, minimumTop = 64) {
  const anchor = constrainPanel(position, width, height, panelWidth, 240, minimumTop);
  return { ...anchor, maxHeight: Math.max(0, height - anchor.y - 32) };
}

/** Move a tool window, preserving geographic features and keeping navigation accessible. */
export function useFloatingPanel(root: RefObject<HTMLElement>, key: string, enabled = true) {
  const position = useRef<Position | null>(null);
  const drag = useRef<{ origin: Position; client: Position; pointerId: number } | null>(null);
  const apply = () => {
    const node = root.current, area = node?.closest('.map-area');
    if (!node || !area) return;
    if (window.innerWidth <= 900 || !position.current) {
      node.style.removeProperty('left'); node.style.removeProperty('top');
      node.style.removeProperty('--floating-panel-height');
    } else {
      const bounds = area.getBoundingClientRect(), rect = node.getBoundingClientRect();
      const controls = area.querySelector('.map-tools')?.getBoundingClientRect();
      const minimumTop = controls ? controls.bottom - bounds.top + 16 : 64;
      const anchor = anchoredPanel(position.current, bounds.width, bounds.height, rect.width, minimumTop);
      node.style.left = `${anchor.x}px`; node.style.top = `${anchor.y}px`;
      node.style.setProperty('--floating-panel-height', `${anchor.maxHeight}px`);
    }
    area.dispatchEvent(new Event('dear:map-layout'));
  };
  const save = () => { try {
    if (position.current) sessionStorage.setItem(`dear.panel-position.${key}`, JSON.stringify(position.current));
    else sessionStorage.removeItem(`dear.panel-position.${key}`);
  } catch { /* Position still works for the current window. */ } };
  const reset = () => { position.current = null; apply(); save(); };
  useLayoutEffect(() => {
    if (!enabled || !root.current) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(`dear.panel-position.${key}`) ?? 'null');
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) position.current = stored;
    } catch { /* Start docked when storage is unavailable. */ }
    apply();
    const resize = new ResizeObserver(apply);
    resize.observe(root.current);
    const area = root.current.closest('.map-area'); if (area) resize.observe(area);
    window.addEventListener('resize', apply);
    return () => { resize.disconnect(); window.removeEventListener('resize', apply); drag.current = null; };
  }, [enabled, key]);
  const blocked = (target: EventTarget | null) => (target as HTMLElement | null)?.closest('button,input,select,a,summary');
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const node = root.current, area = node?.closest('.map-area');
      if (!node || !area || event.button !== 0 || blocked(event.target) || window.innerWidth <= 900) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
      const rect = node.getBoundingClientRect(), bounds = area.getBoundingClientRect();
      drag.current = { origin: { x: rect.left - bounds.left, y: rect.top - bounds.top }, client: { x: event.clientX, y: event.clientY }, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId); node.dataset.dragging = 'true';
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      const node = root.current!, bounds = node.closest('.map-area')!.getBoundingClientRect();
      position.current = constrainPanel({ x: drag.current.origin.x + event.clientX - drag.current.client.x, y: drag.current.origin.y + event.clientY - drag.current.client.y }, bounds.width, bounds.height, node.offsetWidth, 240);
      apply();
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      drag.current = null; if (root.current) root.current.dataset.dragging = 'false'; save();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => { drag.current = null; if (root.current) root.current.dataset.dragging = 'false'; save(); },
    onLostPointerCapture: () => { drag.current = null; if (root.current) root.current.dataset.dragging = 'false'; },
    onDoubleClick: (event: MouseEvent<HTMLElement>) => { if (!blocked(event.target)) reset(); },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || window.innerWidth <= 900) return;
      if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); reset(); return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      const rect = root.current!.getBoundingClientRect(), bounds = root.current!.closest('.map-area')!.getBoundingClientRect();
      const step = event.shiftKey ? 32 : 16;
      event.preventDefault(); event.stopPropagation();
      position.current = { x: rect.left - bounds.left + direction[0] * step, y: rect.top - bounds.top + direction[1] * step };
      apply(); save();
    }
  };
}
