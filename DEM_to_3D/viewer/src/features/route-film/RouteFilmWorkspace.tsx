import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { useRoadJourney } from '../routes/useRoadJourney';
import { roadProjected } from '../routes/selectedRoadJourney';
import { loadLocalNetwork, type LocalNetwork } from './localNetwork';
import { loadFilmBackground } from './filmBackground';
import { createFilmScene, paintFilmFrame } from './filmPainter';
import { encodeRouteFilm } from './encodeRouteFilm';
import { FILM_DURATION, FILM_WIDTH as W, FILM_HEIGHT as H, frameView, geographic, roadWorld, unpixel, type FilmView } from './filmGeometry';
import './route-film.css';
const noRoads: LocalNetwork['roads'] = [];
export function RouteFilmWorkspace({ locale, onChangeLocale }: {
    locale: Locale;
    onChangeLocale: (locale: Locale) => void;
}): JSX.Element {
    const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
    const [network, setNetwork] = useState<LocalNetwork | null>(null);
    const [loadError, setLoadError] = useState(false), [attempt, setAttempt] = useState(0);
    const [view, setView] = useState<FilmView | null>(null);
    const [background, setBackground] = useState<{
        image: HTMLCanvasElement;
        credit: string;
        view: FilmView;
    } | null>(null);
    const [imageryError, setImageryError] = useState(false), [imageryAttempt, setImageryAttempt] = useState(0);
    const [elapsed, setElapsed] = useState<number | null>(null), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
    const [exporting, setExporting] = useState<number | null>(null), [exportError, setExportError] = useState(false);
    const exportController = useRef<AbortController | null>(null), canvasRef = useRef<HTMLCanvasElement>(null);
    const drag = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const journey = useRoadJourney(network?.roads ?? noRoads, 250);
    const locked = playing || exporting !== null;
    useEffect(() => {
        const controller = new AbortController();
        setLoadError(false);
        void loadLocalNetwork(controller.signal).then(data => setNetwork(data))
            .catch(() => { if (!controller.signal.aborted)
            setLoadError(true); });
        return () => controller.abort();
    }, [attempt]);
    useEffect(() => () => { exportController.current?.abort(); exportController.current = null; }, []);
    useEffect(() => {
        if (!network)
            return;
        const a = network.places.find(p => p.name === 'Village A'), b = network.places.find(p => p.name === 'Village C');
        journey.setOpen(true);
        if (a)
            journey.setPoint('start', a.projected, a.id, a.name);
        if (b)
            journey.setPoint('end', b.projected, b.id, b.name);
        const route = a && b ? analyseRoadJourney(network.roads, { origin: a.projected, source: a.id }, { origin: b.projected, source: b.id }, true, 250).route : null;
        setView(frameView([...(route?.points ?? network.roads.flatMap(r => r.points)).map(roadWorld), ...network.places.filter(p => p.kind === 'village').map(p => roadWorld(p.projected))], 150));
    }, [network]);
    useEffect(() => {
        if (!view)
            return;
        const controller = new AbortController();
        setImageryError(false);
        void loadFilmBackground(view, controller.signal, (image, credit) => {
            // Copy each delivered revision: refinement must not mutate an active movie.
            const copy = document.createElement('canvas');
            copy.width = W;
            copy.height = H;
            copy.getContext('2d')!.drawImage(image, 0, 0);
            setBackground({ image: copy, credit, view });
        }).catch(() => { if (!controller.signal.aborted)
            setImageryError(true); });
        return () => controller.abort();
    }, [view, imageryAttempt]);
    useEffect(() => {
        if (!network || !journey.route)
            return;
        setPlaying(false);
        setElapsed(null);
        setView(frameView([...journey.route.points.map(roadWorld), ...network.places.filter(p => p.kind === 'village').map(p => roadWorld(p.projected))], 150));
    }, [journey.route?.id]);
    useEffect(() => {
        if (!journey.picking)
            return;
        const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape')
            journey.setPicking(null); };
        document.addEventListener('keydown', cancel);
        return () => document.removeEventListener('keydown', cancel);
    }, [journey.picking]);
    const scene = useMemo(() => network && view && background?.view === view ? createFilmScene(network, view, background.image, background.credit, locale, journey.route, journey.start, journey.end) : null, [network, view, background, locale, journey.route, journey.start, journey.end]);
    // Freeze the imagery revision during playback/export; geographic view is also locked.
    const frozenScene = useRef(scene);
    if (!locked)
        frozenScene.current = scene;
    const displayScene = locked ? frozenScene.current : scene;
    useEffect(() => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && displayScene)
        paintFilmFrame(ctx, displayScene, elapsed); }, [displayScene, elapsed]);
    useEffect(() => {
        if (!playing)
            return;
        let frame = 0, last = performance.now(), time = elapsed ?? 0;
        const tick = (now: number) => { time = Math.min(FILM_DURATION, time + (now - last) / 1000 * speed); last = now; setElapsed(time); if (time < FILM_DURATION)
            frame = requestAnimationFrame(tick);
        else
            setPlaying(false); };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing, speed]);
    const reset = () => { setPlaying(false); setElapsed(null); setExportError(false); };
    const fitRoute = () => {
        if (!network || !journey.route)
            return;
        reset();
        // Keep nearby settlements and the blocked section in context, not just the moving point.
        const context = network.places.filter(p => p.kind === 'village').map(p => roadWorld(p.projected));
        setView(frameView([...journey.route.points.map(roadWorld), ...context], 150));
    };
    const choose = (side: 'start' | 'end', id: string) => {
        reset();
        if (id === 'pick') {
            journey.setPicking(side);
            return;
        }
        const place = network?.places.find(p => p.id === id);
        if (place)
            journey.setPoint(side, place.projected, place.id, place.name);
        else
            journey.clear(side);
    };
    const canvasPoint = (event: {
        clientX: number;
        clientY: number;
    }) => {
        const rect = canvasRef.current!.getBoundingClientRect(), scale = Math.min(rect.width / W, rect.height / H);
        return { x: (event.clientX - rect.left - (rect.width - W * scale) / 2) / scale, y: (event.clientY - rect.top - (rect.height - H * scale) / 2) / scale };
    };
    const exportFilm = useCallback(async () => {
        if (!scene || !journey.route)
            return;
        setPlaying(false);
        setExportError(false);
        setExporting(0);
        frozenScene.current = scene;
        const controller = new AbortController();
        exportController.current = controller;
        try {
            const blob = await encodeRouteFilm(scene, speed, controller.signal, setExporting);
            controller.signal.throwIfAborted();
            const url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url;
            a.download = 'DEAR-Che-Tao-A-B.mp4';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        catch {
            if (!controller.signal.aborted)
                setExportError(true);
        }
        finally {
            if (exportController.current === controller) {
                exportController.current = null;
                setExporting(null);
            }
        }
    }, [scene, journey.route, speed]);
    const close = () => { const url = new URL(location.href); url.searchParams.delete('workspace'); location.assign(url.href); };
    return <main className="route-film-workspace">
    <header className="route-film-header">
      <button className="icon-button" onClick={close} aria-label={t('Về điều phối', 'Back to coordination')}><UiIcon name="close"/></button>
      <div><strong>Chế Tạo</strong><span>{t('Mạng đường & hành trình', 'Road network & journey')}</span></div>
      <select aria-label={t('Ngôn ngữ', 'Language')} value={locale} onChange={e => onChangeLocale(e.target.value as Locale)} disabled={locked}><option value="en">English</option><option value="vi">Tiếng Việt</option></select>
    </header>
    {loadError ? <section role="alert">{t('Không tải được mạng đường.', 'Road network unavailable.')} <button onClick={() => setAttempt(v => v + 1)}>{t('Thử lại', 'Retry')}</button></section> : !network ? <p role="status">{t('Đang mở bản đồ…', 'Opening map…')}</p> : <div className="route-film-layout">
      <aside className="route-film-panel" aria-label={t('Hành trình A–B', 'A–B journey')}>
        <h1>{t('Hành trình A–B', 'A–B journey')}</h1>
        <fieldset disabled={locked}>
          {(['start', 'end'] as const).map((side, i) => <label className="route-film-stop" key={side}><b>{i ? 'B' : 'A'}</b><select aria-label={i ? t('Điểm đến', 'Destination') : t('Điểm đi', 'Origin')} value={journey[side]?.source ?? ''} onChange={e => choose(side, e.target.value)}><option value="">{t('Chọn điểm', 'Choose a place')}</option>{journey[side]?.source === 'map' && <option value="map">{t('Điểm trên bản đồ', 'Map point')}</option>}<option value="pick">{t('Chọn trên bản đồ…', 'Pick on map…')}</option>{network.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="icon-button" aria-label={`${t('Chọn trên bản đồ', 'Pick on map')} ${i ? 'B' : 'A'}`} aria-pressed={journey.picking === side} onClick={() => journey.setPicking(journey.picking === side ? null : side)}><UiIcon name="location"/></button></label>)}
          <button className="text-button" onClick={() => { reset(); journey.swap(); }}><UiIcon name="redo" size={16}/>{t('Đổi A / B', 'Swap A / B')}</button>
          <label className="route-film-avoid"><input type="checkbox" checked={journey.avoidBlocked} onChange={e => { reset(); journey.setAvoidBlocked(e.target.checked); }}/>{t('Tránh đường bị chặn', 'Avoid blocked roads')}</label>
        </fieldset>
        {journey.picking && <p role="status">{t('Bấm vào bản đồ để chọn', 'Click the map to choose')} {journey.picking === 'start' ? 'A' : 'B'}. <button className="text-button" onClick={() => journey.setPicking(null)}>{t('Hủy', 'Cancel')}</button></p>}
        {journey.route ? <div className="route-film-result" aria-live="polite"><strong>{journey.route.lengthKm.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: 2 })} km</strong><span>{journey.route.status === 'blocked' ? t('Có đoạn bị chặn', 'Includes a blocked road') : journey.route.status === 'uncertain' ? t('Có đoạn khó đi', 'Includes difficult roads') : t('Theo đường màu xanh', 'Follows green roads')}</span>{[journey.start, journey.end].some(p => (p?.anchor?.distance ?? 0) > 1) && <small>{t('Khoảng cách đến đường (chưa xác minh):', 'Offsets to road (unverified):')} A {Math.round(journey.start?.anchor?.distance ?? 0)} m · B {Math.round(journey.end?.anchor?.distance ?? 0)} m</small>}</div> : <p role="status">{journey.kind === 'incomplete' ? t('Chọn hai điểm để tìm tuyến.', 'Choose two points to find a route.') : journey.kind === 'endpoint-unavailable' ? t('Điểm cách đường quá 250 m. Chọn lại vị trí.', 'A point is more than 250 m from the roads. Choose a closer location.') : journey.kind === 'same-location' || journey.kind === 'same-connection' ? t('Hai điểm trùng vị trí hoặc cùng nút nối.', 'The points share a location or road connection.') : t('Không có tuyến nối theo lựa chọn hiện tại.', 'No connected route under the current selection.')}</p>}
        <div className="route-film-fit"><button className="button" disabled={locked || !journey.route} onClick={fitRoute}>{t('Xem tuyến', 'Fit route')}</button><button className="button" disabled={locked} onClick={() => { reset(); setView(frameView(network.roads.flatMap(r => r.points.map(roadWorld)))); }}>{t('Toàn mạng đường', 'Whole network')}</button></div>
        <details className="route-film-source"><summary>{t('Nguồn & phạm vi', 'Source & scope')}</summary><p>{network.source.file}</p><p>{t('21 đường gốc. Màu đường và vùng nguy cơ theo KMZ demo, chưa xác minh thực địa. Chỉ nối đầu đường trong 15 m; không nối các giao cắt tùy ý.', '21 source roads. Road colours and hazard areas come from the demo KMZ, not field verification. Only endpoints within 15 m are connected; crossings do not create junctions.')}</p></details>
      </aside>
      <section className="route-film-main">
        <div className="route-film-stage" data-picking={journey.picking || undefined}>
          <canvas ref={canvasRef} width={W} height={H} aria-label={t('Bản đồ mạng đường Chế Tạo', 'Chế Tạo road network map')} onPointerDown={e => { if (locked)
            return; drag.current = canvasPoint(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = null; }} onPointerUp={e => {
                if (locked || !view || !drag.current)
                    return;
                const from = drag.current, to = canvasPoint(e);
                drag.current = null;
                if (to.x < 0 || to.x > W || to.y < 0 || to.y > H)
                    return;
                if (Math.hypot(from.x - to.x, from.y - to.y) > 8 && !journey.picking) {
                    reset();
                    setView({ ...view, cx: view.cx + (from.x - to.x) * view.metresPerPixel, cy: view.cy - (from.y - to.y) * view.metresPerPixel });
                }
                else if (journey.picking) {
                    const p = geographic(unpixel(view, to));
                    reset();
                    journey.setPoint(journey.picking, roadProjected(p.latitude, p.longitude));
                }
            }}/>
          {!scene && <p className="route-film-loading" role={imageryError ? 'alert' : 'status'}>{imageryError ? t('Không tải được ảnh nền.', 'Map imagery unavailable.') : t('Đang tải ảnh nền…', 'Loading map imagery…')}{imageryError && <button onClick={() => setImageryAttempt(v => v + 1)}>{t('Thử lại', 'Retry')}</button>}</p>}
          <div className="route-film-zoom"><button className="icon-button" disabled={locked || !view} aria-label={t('Phóng to', 'Zoom in')} onClick={() => { reset(); setView(v => v ? { ...v, metresPerPixel: Math.max(.5, v.metresPerPixel / 1.5) } : v); }}><UiIcon name="zoomIn"/></button><button className="icon-button" disabled={locked || !view} aria-label={t('Thu nhỏ', 'Zoom out')} onClick={() => { reset(); setView(v => v ? { ...v, metresPerPixel: Math.min(50, v.metresPerPixel * 1.5) } : v); }}><UiIcon name="zoomOut"/></button></div>
        </div>
        <div className="route-film-playback" aria-label={t('Điều khiển phim', 'Film controls')}>
          <button className="button primary" disabled={!scene || !journey.route || exporting !== null} onClick={() => { journey.setPicking(null); if (!playing && (elapsed === null || elapsed >= FILM_DURATION))
            setElapsed(0); setPlaying(v => !v); }}><span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>{playing ? t('Tạm dừng', 'Pause') : t('Phát hành trình', 'Play journey')}</button>
          <input type="range" min="0" max={FILM_DURATION} step="0.01" aria-label={t('Tiến trình phim', 'Film timeline')} value={elapsed ?? 0} disabled={!scene || !journey.route || exporting !== null} onChange={e => { setPlaying(false); setElapsed(Number(e.target.value)); }}/>
          <output>{Math.round((elapsed ?? 0) / speed)} / {Math.round(FILM_DURATION / speed)} s</output>
          <select aria-label={t('Tốc độ', 'Speed')} value={speed} disabled={locked} onChange={e => setSpeed(Number(e.target.value))}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select>
          {exporting === null ? <button className="button" disabled={!scene || !journey.route || playing} onClick={() => void exportFilm()}><UiIcon name="download"/>{t('Xuất MP4', 'Export MP4')}</button> : <button className="button" onClick={() => exportController.current?.abort()}>{t('Hủy', 'Cancel')} {Math.round(exporting * 100)}%</button>}
        </div>
        {exportError && <p role="alert">{t('Không xuất được video. Thử Chrome hoặc Edge.', 'Video export failed. Try Chrome or Edge.')}</p>}
      </section>
    </div>}
  </main>;
}
