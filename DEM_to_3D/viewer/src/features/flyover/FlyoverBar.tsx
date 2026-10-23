import { isSelectPickerEvent } from '../../shared/ui/selectKeyboard';
import './flyover.css';
import { createPortal } from 'react-dom';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Locale } from '../../types/dear';
import type { ViewControls } from '../map/mapContracts';
import type { FlyoverState } from '../../terrain/flyover/flyoverController';
import { UiIcon } from '../../shared/ui/UiIcon';

type Props = {
  layout?: 'toolbar'|'journey';
  disabled?: boolean;
  locale: Locale;
  state: FlyoverState;
  /** Route labels for the button and the file name. */
  title?: string;
  fileName: string;
  mapMode: '2d' | '3d';
  onRequest3D: () => void;
  controlRef: MutableRefObject<ViewControls | null>;
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const PlayIcon = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>;

/** Waits for the 3D viewer (lazy and model-dependent) to expose its flyover. */
async function flyoverControls(ref: MutableRefObject<ViewControls | null>, signal: AbortSignal) {
  const started = performance.now();
  while (!ref.current?.flyover) {
    if (signal.aborted || performance.now() - started > 30000) return null;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return ref.current.flyover;
}

/** Terrain loading can replace the placeholder renderer while an action waits.
 * Retry only that replacement, never a real data/encoding failure. */
async function withCurrentFlyover<T>(ref: MutableRefObject<ViewControls | null>, signal: AbortSignal,
  action: (controls: NonNullable<ViewControls['flyover']>) => Promise<T>): Promise<T | undefined> {
  for (let attempt=0;attempt<3;attempt++) {
    signal.throwIfAborted();
    const controls=await flyoverControls(ref,signal);
    signal.throwIfAborted();
    if (!controls) return;
    try { return await action(controls); }
    catch(error) {
      if(signal.aborted || ref.current?.flyover===controls || attempt===2) throw error;
    }
  }
}

export function FlyoverBar({ layout = 'toolbar', disabled = false, locale, state, title, fileName, mapMode, onRequest3D, controlRef }: Props): JSX.Element | null {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const bar = useRef<HTMLDivElement>(null);
  const [mapHost,setMapHost]=useState<HTMLElement|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [waitingForViewer,setWaitingForViewer]=useState(false);
  useLayoutEffect(()=>{setMapHost(bar.current?.closest<HTMLElement>('.map-area')??null);},[]);
  useDismissiblePopover(bar,menuOpen,()=>setMenuOpen(false));
  const onMap=(content:JSX.Element)=>mapHost?createPortal(content,mapHost):content;
  const exportRun = useRef<AbortController | null>(null);
  const launchRun = useRef<AbortController | null>(null);
  const launchedControls=useRef<NonNullable<ViewControls['flyover']>|null>(null);
  const [idleUi, setIdleUi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = state.status === 'playing' || state.status === 'paused' || state.status === 'ended';

  // The bar steps aside while the film plays and the pointer rests.
  useEffect(() => {
    if (state.status !== 'playing' || layout === 'journey') { setIdleUi(false); return; }
    let timer = setTimeout(() => setIdleUi(true), 2500);
    const wake = () => { setIdleUi(false); clearTimeout(timer); timer = setTimeout(() => setIdleUi(true), 2500); };
    window.addEventListener('pointermove', wake);
    return () => { clearTimeout(timer); window.removeEventListener('pointermove', wake); };
  }, [state.status, layout]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const controls = controlRef.current?.flyover;
      if (!controls) return;
      if(event.key==='Escape' && !event.defaultPrevented && !isSelectPickerEvent(event)){controls.exit();return;}
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (event.key === ' ') { event.preventDefault(); if (state.status === 'playing') controls.pause(); else void controls.play(); }
      else if (event.key === 'Escape') controls.exit();
      else if (event.key === 'ArrowRight') controls.seek(state.time + 5);
      else if (event.key === 'ArrowLeft') controls.seek(state.time - 5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, state.status, state.time, controlRef]);

  useEffect(() => { if (state.error) { setMessage(t('Không mở được chế độ xem 3D.', 'The 3D route view could not start.')); setMenuOpen(true); } }, [state.error]);
  useEffect(() => () => {
    exportRun.current?.abort();launchRun.current?.abort();launchedControls.current?.exit();
  }, []);
  // Leaving fullscreen is not leaving the film; leaving the film leaves fullscreen.
  useEffect(() => { if (state.status === 'idle' && document.fullscreenElement?.classList.contains('map-area')) void document.exitFullscreen().catch(() => undefined); }, [state.status]);

  const start = async () => {
    if(launchRun.current || exportRun.current) return;
    setMenuOpen(false);setMessage(null);setWaitingForViewer(true);
    const area = bar.current?.closest<HTMLElement>('.map-area');
    void area?.requestFullscreen?.().catch(() => undefined);
    if (mapMode !== '3d') onRequest3D();
    const run=new AbortController();launchRun.current=run;
    try {
      const started=await withCurrentFlyover(controlRef,run.signal,async controls=>{launchedControls.current=controls;await controls.play();return true;});
      if(!started) throw new Error('The 3D map is not ready');
    } catch {
      if(!run.signal.aborted) {
        setMessage(t('Không mở được chế độ xem 3D.', 'The 3D route view could not start.'));setMenuOpen(true);
        if(document.fullscreenElement===area) void document.exitFullscreen().catch(()=>undefined);
      }
    } finally { launchRun.current=null;setWaitingForViewer(false); }
  };
  const exportVideo = async () => {
    if(exportRun.current || launchRun.current) return;
    setMenuOpen(false);setMessage(null);setWaitingForViewer(true);
    const run = new AbortController(); exportRun.current = run;
    if (mapMode !== '3d') onRequest3D();
    try {
      const blob=await withCurrentFlyover(controlRef,run.signal,controls=>controls.exportVideo(()=>undefined,run.signal));
      if(!blob) throw new Error('The 3D map is not ready');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(t('Đã xuất video.', 'Video exported.'));
    } catch (error) {
      if (!run.signal.aborted) console.warn('Flyover export failed',error);
      if (!run.signal.aborted) setMessage(t('Không xuất được video trên trình duyệt này.', 'This browser could not export the video.'));
    } finally { exportRun.current = null;setWaitingForViewer(false);if(!run.signal.aborted) setMenuOpen(true); }
  };
  const fullscreen = () => {
    const area = bar.current?.closest<HTMLElement>('.map-area');
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void area?.requestFullscreen?.().catch(() => undefined);
  };

  if (state.status === 'exporting') {
    const percent = Math.round((state.exportProgress ?? 0) * 100);
    return onMap(<div ref={bar} className="flyover-bar flyover-export" role="status">
      <strong>{t('Đang xuất video', 'Exporting video')}</strong>
      <span className="flyover-export-percent">{percent}%</span>
      <progress max={100} value={percent} aria-label={t('Tiến độ xuất video', 'Export progress')}/>
      <button type="button" className="button" onClick={() => exportRun.current?.abort()}>{t('Hủy', 'Cancel')}</button>
    </div>);
  }
  if (state.status==='loading' || (waitingForViewer && !active)) return onMap(<div ref={bar} className="flyover-bar flyover-preparing" role="status">{t('Đang chuẩn bị chế độ xem 3D','Preparing 3D route view')}</div>);
  if (!active && layout==='journey') {
    return <div ref={bar} className="flyover-launch flyover-journey-launch">
      <button type="button" className="button primary" disabled={disabled} onClick={()=>void start()}><PlayIcon/>{t('Phát hành trình','Play journey')}</button>
      <button type="button" className="button" disabled={disabled} onClick={()=>void exportVideo()}><UiIcon name="download" size={18}/>{t('Xuất MP4','Export MP4')}</button>
      {message&&<p role="status">{message}</p>}
    </div>;
  }
  if (!active) {
    return <div ref={bar} className="flyover-launch">
      <button type="button" className="icon-button" aria-label={t('Xem tuyến 3D','3D route view')}
        title={t('Xem tuyến 3D','3D route view')} aria-expanded={menuOpen} aria-haspopup="dialog" aria-controls="flyover-menu"
        onClick={()=>setMenuOpen(open=>!open)}><PlayIcon/><span>{t('Xem tuyến 3D','3D route view')}</span></button>
      {menuOpen && <div className="flyover-menu" id="flyover-menu" data-popover role="dialog" aria-label={t('Xem tuyến 3D','3D route view')}>
        {title && <p>{title}</p>}
        <button type="button" className="flyover-menu-action" onClick={()=>void start()}><PlayIcon/>{t('Bắt đầu xem','Start viewing')}</button>
        <button type="button" className="flyover-menu-action" onClick={()=>void exportVideo()}><UiIcon name="download" size={16}/>{t('Xuất video MP4','Export MP4 video')}</button>
        {message && <p role="status">{message}</p>}
      </div>}
    </div>;
  }
  const controls = () => controlRef.current?.flyover;
  return onMap(<div ref={bar} className={'flyover-bar flyover-player' + (idleUi ? ' is-resting' : '')}>
    <button type="button" className="icon-button flyover-icon" onClick={() => state.status === 'playing' ? controls()?.pause() : void controls()?.play()}
      aria-label={state.status === 'playing' ? t('Tạm dừng', 'Pause') : state.status === 'ended' ? t('Phát lại', 'Replay') : t('Tiếp tục', 'Resume')}>
      {state.status === 'playing' ? <PauseIcon/> : <PlayIcon/>}
    </button>
    <input type="range" className="flyover-seek" min={0} max={Math.max(1, state.duration)} step={.1} value={state.time}
      aria-label={t('Tiến trình xem tuyến', 'Route playback position')} onChange={event => controls()?.seek(Number(event.target.value))}/>
    <span className="flyover-clock">{clock(state.time)} / {clock(state.duration)}</span>
    <select className="flyover-speed" aria-label={t('Tốc độ phát','Playback speed')} value={state.playbackRate??1} onChange={event=>controls()?.setPlaybackRate(Number(event.target.value))}>
      {[.75,1,1.25,1.5].map(rate=><option key={rate} value={rate}>{rate}×</option>)}
    </select>
    <button type="button" className="icon-button flyover-icon" onClick={() => void exportVideo()} title={t('Xuất video MP4', 'Export MP4 video')} aria-label={t('Xuất video MP4', 'Export MP4 video')}><UiIcon name="download" size={18}/></button>
    <button type="button" className="icon-button flyover-icon" onClick={fullscreen} title={t('Toàn màn hình', 'Full screen')} aria-label={t('Toàn màn hình', 'Full screen')}><UiIcon name="expand" size={18}/></button>
    <button type="button" className="icon-button flyover-icon" onClick={() => controls()?.exit()} title={t('Thoát chế độ xem 3D (Esc)', 'Exit 3D route view (Esc)')} aria-label={t('Thoát chế độ xem 3D', 'Exit 3D route view')}><UiIcon name="close" size={18}/></button>
    {message && <p className="flyover-message" role="status">{message}</p>}
  </div>);
}
