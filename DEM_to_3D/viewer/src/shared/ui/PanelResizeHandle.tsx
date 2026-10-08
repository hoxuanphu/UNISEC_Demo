import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';

const minimum = 320, defaultWidth = 384;
const maximum = () => window.innerWidth > 900 ? Math.max(minimum, Math.min(560, window.innerWidth - 480)) : 560;
const clamp = (width: number) => Math.max(minimum, Math.min(maximum(), width));

export function PanelResizeHandle({ locale, storageKey='dear.panel-width' }: { locale: Locale; storageKey?:string }): JSX.Element {
  const handle = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem(storageKey)); return clamp(saved >= minimum && saved <= 560 ? saved : defaultWidth); }
    catch { return clamp(defaultWidth); }
  });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => { handle.current?.parentElement?.style.setProperty('--panel-width', `${width}px`); }, [width]);
  useEffect(() => {
    const resize = () => setWidth(current => clamp(current));
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const save = (value: number) => { try { localStorage.setItem(storageKey, String(value)); } catch { /* Session resizing still works. */ } };
  const finish = () => { drag.current = null; setDragging(false); save(width); };
  return <div ref={handle} className="panel-resize-handle" role="separator" aria-orientation="vertical"
    aria-label={locale === 'vi' ? 'Độ rộng bảng thông tin' : 'Information panel width'}
    aria-valuemin={minimum} aria-valuemax={maximum()} aria-valuenow={Math.round(width)} tabIndex={0} data-dragging={dragging}
    title={locale === 'vi' ? 'Kéo để chỉnh độ rộng. Nhấp đúp để đặt lại.' : 'Drag to resize. Double-click to reset.'}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, width }; setDragging(true); }}
    onPointerMove={event => { if (drag.current) setWidth(clamp(drag.current.width + event.clientX - drag.current.x)); }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { if (drag.current) finish(); }}
    onDoubleClick={() => { const value = clamp(defaultWidth); setWidth(value); save(value); }}
    onKeyDown={event => {
      const next = event.key === 'ArrowLeft' ? width - 16 : event.key === 'ArrowRight' ? width + 16 : event.key === 'Home' ? minimum : event.key === 'End' ? maximum() : null;
      if (next === null) return; event.preventDefault(); const value = clamp(next); setWidth(value); save(value);
    }}/ >;
}
