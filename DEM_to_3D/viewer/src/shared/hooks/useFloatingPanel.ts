import { useLayoutEffect, useRef, type RefObject, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react';

type Position = { x: number; y: number };
/** Keep a panel inside the map. Near the top it stays clear of the map buttons on the right;
 * lower down it may go right to the edge, as a docked overview does. */
export function constrainPanel(position: Position, width: number, height: number, panelWidth: number, panelHeight: number, minimumTop = 64): Position {
  // The scale bar and the source button sit along the bottom edge.
  const y = Math.max(minimumTop, Math.min(position.y, Math.max(minimumTop, height - panelHeight - BOTTOM_PX)));
  // Side margins match the map's layout clearance (useMapSurfaceClearance), so a panel dragged to
  // an edge is never judged out of bounds and moved elsewhere.
  const right = y >= minimumTop + RIGHT_TOOLS_PX ? EDGE_PX : 64;
  return { x: Math.max(EDGE_PX, Math.min(position.x, Math.max(EDGE_PX, width - panelWidth - right))), y };
}
/** Height of the compass and buttons down the map's right edge, below the toolbar. */
const RIGHT_TOOLS_PX = 96;
const EDGE_PX = 12;
/** Room kept along the bottom edge for the scale bar and the source button. */
const BOTTOM_PX = 56;

/** Preserve the heading position as content grows; use the space below it for scrolling. */
export function anchoredPanel(position: Position, width: number, height: number, panelWidth: number, minimumTop = 64) {
  const anchor = constrainPanel(position, width, height, panelWidth, 240, minimumTop);
  return { ...anchor, maxHeight: Math.max(0, height - anchor.y - 32) };
}

/** Growing content scrolls below the same heading instead of pushing the window upward. */
export function fittedPanel(position: Position, width: number, height: number, panelWidth: number, headingHeight=48, minimumTop=64) {
  const heading=Math.min(headingHeight,Math.max(0,height-minimumTop-BOTTOM_PX));
  const anchor=constrainPanel(position,width,height,Math.min(panelWidth,160),heading,minimumTop);
  const right=anchor.y>=minimumTop+RIGHT_TOOLS_PX?EDGE_PX:64;
  return {...anchor,maxWidth:Math.max(0,width-anchor.x-right),maxHeight:Math.max(0,height-anchor.y-BOTTOM_PX)};
}

/** Move a tool window, preserving geographic features and keeping navigation accessible. */
/** `home`: while true the panel forgets any dragged position and stays docked. */
export function useFloatingPanel(root: RefObject<HTMLElement>, key: string, enabled = true, sizing: 'anchor'|'fit' = 'anchor', home = false) {
  const position = useRef<Position | null>(null);
  const drag = useRef<{ origin: Position; client: Position; pointerId: number } | null>(null);
  const apply = () => {
    const node = root.current, area = node?.closest('.map-area');
    if (!node || !area) return;
    if (window.innerWidth <= 900 || !position.current) {
      node.style.removeProperty('left'); node.style.removeProperty('top');
      node.style.removeProperty('--floating-panel-height');
      node.style.removeProperty('max-width');
      delete node.dataset.floating;
    } else {
      const bounds = area.getBoundingClientRect(), rect = node.getBoundingClientRect();
      const controls = [...area.querySelectorAll<HTMLElement>('.map-tools,.map-advanced-tools:not([hidden])')];
      const minimumTop = controls.length ? Math.max(...controls.map(control => control.getBoundingClientRect().bottom)) - bounds.top + 16 : 64;
      const headingHeight=node.querySelector<HTMLElement>('.floating-panel-handle,header')?.offsetHeight??48;
      const anchor = sizing==='fit' ? fittedPanel(position.current,bounds.width,bounds.height,rect.width,headingHeight,minimumTop) : anchoredPanel(position.current, bounds.width, bounds.height, rect.width, minimumTop);
      node.dataset.floating='true';
      // Positions are measured in the map area; the panel is placed in its own containing block,
      // which may start below the map toolbar.
      const parent = (node.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? bounds;
      node.style.left = `${anchor.x - (parent.left - bounds.left)}px`; node.style.top = `${anchor.y - (parent.top - bounds.top)}px`;
      node.style.setProperty('--floating-panel-height', `${anchor.maxHeight}px`);
      if(sizing==='fit')node.style.maxWidth=`${'maxWidth' in anchor?anchor.maxWidth:bounds.width}px`;
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
    const area = root.current.closest('.map-area');
    if (area) {
      resize.observe(area);
      area.querySelectorAll('.map-tools,.map-advanced-tools').forEach(control => resize.observe(control));
      if(sizing==='fit')resize.observe(root.current);
    }
    window.addEventListener('resize', apply);
    return () => { resize.disconnect(); window.removeEventListener('resize', apply); drag.current = null; };
  }, [enabled, key, sizing]);
  useLayoutEffect(() => { if (enabled && home && position.current) reset(); }, [enabled, home]);
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
      // The panel's real height: a collapsed one can go down to the bottom edge.
      const minimumHeight=sizing==='fit'?(node.querySelector<HTMLElement>('.floating-panel-handle,header')?.offsetHeight??48):Math.min(node.offsetHeight,240);
      position.current = constrainPanel({ x: drag.current.origin.x + event.clientX - drag.current.client.x, y: drag.current.origin.y + event.clientY - drag.current.client.y }, bounds.width, bounds.height, sizing==='fit'?Math.min(node.offsetWidth,160):node.offsetWidth, minimumHeight);
      apply();
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      drag.current = null; if (root.current) {root.current.dataset.dragging = 'false';root.current.closest('.map-area')?.dispatchEvent(new Event('dear:map-layout'));} save();
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
