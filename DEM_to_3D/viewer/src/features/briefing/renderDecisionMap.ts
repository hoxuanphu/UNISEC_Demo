import proj4 from 'proj4';
import type { Locale } from '../../types/dear';
import type { TerrainData } from '../../types/terrain';
import { createRaster2d } from '../map/raster2d';
import { roadColors } from '../../terrain/roadStyle';
import { mapSymbolPaths, type MapSymbolName } from '../../terrain/mapSymbols';
import { localClock } from '../incident/sourceTime';
import type { DecisionSnapshot } from './decisionSnapshot';

type Point = { x: number; y: number };

/** Dedicated 2D layout: no DOM screenshot, WebGL dependency or remote tiles. */
export async function renderDecisionMap(snapshot: DecisionSnapshot, terrain: TerrainData, imageUrl: string,
  locale: Locale, signal: AbortSignal): Promise<Blob> {
  const raster = await createRaster2d(terrain, imageUrl, true, true, signal);
  await document.fonts.ready;
  const image = new Image(); image.src = raster.url; await image.decode();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1060;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D unavailable');
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const text = (value: string, x: number, y: number, size = 16, color = '#223238', bold = false) => {
    ctx.font = `${bold ? 600 : 400} ${size}px Inter, sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const wrap = (value: string, x: number, y: number, width: number, size = 16, color = '#223238') => {
    let line = ''; const words = value.split(/\s+/);
    ctx.font = `400 ${size}px Inter, sans-serif`;
    for (const word of words) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) { text(line, x, y, size, color); y += size * 1.5; line = word; }
      else line += (line ? ' ' : '') + word;
    }
    if (line) text(line, x, y, size, color);
    return y + size * 1.5;
  };
  const mercator = (p: Point): Point => { const [x, y] = proj4('+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs', 'EPSG:3857', [p.x, p.y]); return { x, y }; };
  const points = [...snapshot.aoi.points, ...snapshot.communities.map(c => c.projected), ...snapshot.roads.flatMap(r => r.points), ...snapshot.responseSites.map(s => s.projected)].map(mercator);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const frame = { x: 24, y: 112, w: 1100, h: 680 };
  const scale = Math.min((frame.w - 100) / (maxX - minX), (frame.h - 90) / (maxY - minY));
  const map = (p: Point) => ({ x: frame.x + frame.w / 2 + (p.x - (minX + maxX) / 2) * scale,
    y: frame.y + frame.h / 2 - (p.y - (minY + maxY) / 2) * scale });
  const project = (p: Point) => map(mercator(p));
  const line = (path: Point[], color: string, width: number, dash: number[] = []) => {
    ctx.beginPath(); path.forEach((p, i) => { const q = project(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  text('DEAR', 24, 48, 26, '#166553', true);
  text(t('Đánh giá tiếp cận', 'Access assessment') + ': ' + snapshot.community.name, 146, 48, 26, '#223238', true);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(snapshot.asOf));
  text(`${snapshot.incidentId}   ${t('Tổng hợp lúc', 'Data as of')} ${localClock(snapshot.asOf)} ${date} UTC+7`, 24, 83, 16, '#617177');
  ctx.fillStyle = '#e7eeef'; ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.save(); ctx.beginPath(); ctx.rect(frame.x, frame.y, frame.w, frame.h); ctx.clip();
  const [sw, ne] = raster.bounds;
  const [rx0, ry0] = proj4('EPSG:4326', 'EPSG:3857', [sw[1], sw[0]]);
  const [rx1, ry1] = proj4('EPSG:4326', 'EPSG:3857', [ne[1], ne[0]]);
  const a = map({ x: rx0, y: ry1 }), b = map({ x: rx1, y: ry0 });
  ctx.drawImage(image, a.x, a.y, b.x - a.x, b.y - a.y);
  line(snapshot.aoi.points, '#678c86', 1.5, [7, 5]);
  for (const road of snapshot.roads) {
    const selected = snapshot.route?.segs.some(s => s.id === road.id);
    const color = road.status === 'blocked' ? roadColors.blocked : road.status === 'uncertain' ? roadColors.uncertain : selected ? roadColors.selected : roadColors.networkImagery;
    line(road.points, '#243f4570', selected ? 6 : 4);
    line(road.points, color, selected ? 4 : 2.5, road.status === 'uncertain' ? [7, 5] : []);
  }
  // Symbols use the same geometry as the interactive map. Labels avoid symbols.
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
  const markers: Array<{ point: Point; symbol: MapSymbolName; label?: string; color: string; outline?: boolean }> = [
    { point: snapshot.community.projected, symbol: 'community', label: snapshot.community.name, color: snapshot.assessment.priority === 1 ? '#a6630b' : '#237ba9' },
    ...snapshot.communities.filter(c => c.id !== snapshot.community.id).map(c => ({ point: c.projected, symbol: 'community' as const, label: c.name, color: c.prio === 1 ? '#a6630b' : '#237ba9' })),
    ...snapshot.responseSites.map(s => ({ point: s.projected, symbol: s.kind as MapSymbolName, label: t(...s.name), color: s.kind === 'hlz' ? '#a6630b' : '#236c68', outline: s.kind === 'hlz' })),
    ...snapshot.hazards.map(h => ({ point: h.projected, symbol: h.kind as MapSymbolName, color: h.kind === 'landslide' ? '#cf3535' : '#a6630b', outline: h.observation === 'suspected' || h.kind === 'bridge' || h.kind === 'crossing' }))
  ];
  for (const marker of markers) { const p = project(marker.point); occupied.push({ x: p.x - 17, y: p.y - 17, w: 34, h: 34 }); }
  for (const marker of markers) {
    const p = project(marker.point); ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = marker.outline ? '#fff' : marker.color; ctx.fill(); ctx.strokeStyle = marker.outline ? marker.color : '#fff'; ctx.lineWidth = 2;
    if (marker.symbol === 'hlz') ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(p.x - 10, p.y - 10); ctx.scale(20 / 24, 20 / 24);
    const path = new Path2D(mapSymbolPaths[marker.symbol]); ctx.strokeStyle = marker.outline ? marker.color : '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.6;
    if (marker.symbol === 'community') ctx.fill(path); else ctx.stroke(path); ctx.restore();
    if (!marker.label) continue;
    ctx.font = '600 15px Inter, sans-serif'; const w = ctx.measureText(marker.label).width;
    const candidates = [{ x: p.x + 21, y: p.y - 9, w, h: 22 }, { x: p.x - 21 - w, y: p.y - 9, w, h: 22 }, { x: p.x - w / 2, y: p.y + 21, w, h: 22 }];
    const label = candidates.find(r => r.x >= frame.x && r.x + r.w <= frame.x + frame.w && r.y >= frame.y && r.y + r.h <= frame.y + frame.h &&
      !occupied.some(o => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y));
    if (label) { occupied.push(label); ctx.lineWidth = 3; ctx.strokeStyle = '#153532'; ctx.strokeText(marker.label, label.x, label.y + 16); text(marker.label, label.x, label.y + 16, 15, '#fff', true); }
  }
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.fillRect(1080, 122, 32, 64);
  text('N', 1090, 144, 16, '#223238', true);
  ctx.beginPath(); ctx.moveTo(1096, 155); ctx.lineTo(1090, 174); ctx.lineTo(1102, 174); ctx.closePath(); ctx.fillStyle = '#223238'; ctx.fill();
  const [, latitude] = proj4('EPSG:3857', 'EPSG:4326', [(minX + maxX) / 2, (minY + maxY) / 2]);
  const pixelsPerMetre = scale / Math.cos(latitude * Math.PI / 180);
  const scaleMetres = [5000, 2000, 1000, 500, 200, 100].find(value => value * pixelsPerMetre <= 160) ?? 100;
  ctx.fillStyle = '#fff'; ctx.fillRect(40, 745, scaleMetres * pixelsPerMetre + 20, 32);
  ctx.beginPath(); ctx.moveTo(50, 762); ctx.lineTo(50 + scaleMetres * pixelsPerMetre, 762); ctx.strokeStyle = '#223238'; ctx.lineWidth = 2; ctx.stroke();
  text(scaleMetres >= 1000 ? `${scaleMetres / 1000} km` : `${scaleMetres} m`, 50, 756, 12);
  const sx = 1160, width = 408;
  let y = 138;
  text(t('TÌNH HÌNH', 'SITUATION'), sx, y, 13, '#617177', true); y += 32;
  y = wrap(t(...snapshot.assessment.reason), sx, y, width, 18); y += 20;
  text(t('PHƯƠNG ÁN ĐANG XEM', 'SELECTED ACCESS OPTION'), sx, y, 13, '#617177', true); y += 32;
  if (snapshot.route) {
    y = wrap(t(...snapshot.route.name), sx, y, width, 18);
    text(`${snapshot.route.lengthKm} km`, sx, y + 12, 24, '#223238', true); y += 49;
    y = wrap(snapshot.route.status === 'blocked' ? t('Có đoạn bị chặn', 'Contains blocked sections') : t('Cần xác minh khả năng đi qua', 'Passability requires verification'), sx, y, width, 16, snapshot.route.status === 'blocked' ? '#b91c1c' : '#92400e');
    if (snapshot.route.eta) y = wrap(`${snapshot.route.eta.minMinutes} ${t('đến', 'to')} ${snapshot.route.eta.maxMinutes} ${t('phút nếu thông tuyến', 'min assuming passage')}`, sx, y + 8, width, 16);
  } else y = wrap(t('Chưa đủ dữ liệu tuyến', 'Insufficient route data'), sx, y, width, 18);
  y += 30; text(t('VIỆC CẦN KIỂM TRA', 'NEXT CHECK'), sx, y, 13, '#617177', true); y += 32;
  y = wrap(t(...snapshot.assessment.nextAction), sx, y, width, 18); y += 24;
  const constraints = snapshot.route?.segs.filter(s => s.status !== 'open') ?? [];
  for (const road of constraints.slice(0, 3)) {
    y = wrap(t(...road.name), sx, y, width, 15);
    y = wrap(road.status === 'blocked' ? t('Bị chặn', 'Blocked') : t('Chưa xác minh khả năng đi qua', 'Passability unknown'), sx, y, width, 14, road.status === 'blocked' ? '#b91c1c' : '#92400e'); y += 12;
  }
  if (constraints.length > 3) text(`${constraints.length - 3} ${t('đoạn khác: xem dữ liệu JSON', 'more sections: see JSON')}`, sx, y, 14, '#617177');
  const legend = [[roadColors.blocked, t('Đường bị chặn', 'Blocked road')], [roadColors.uncertain, t('Đường cần xác minh', 'Road to verify')], [roadColors.selected, t('Tuyến đang xem', 'Selected route')], [roadColors.networkImagery, t('Chưa ghi nhận chặn', 'No blockage reported')]];
  legend.forEach(([color, label], i) => { const x = 32 + i % 2 * 550, y = 830 + Math.floor(i / 2) * 32; ctx.strokeStyle = '#243f45'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 28, y - 5); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = 3; if (i === 1) ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); text(label, x + 40, y, 14); });
  const symbolLegend: Array<[MapSymbolName, string, string]> = [
    ['community', t('Thôn, bản', 'Community'), '#237ba9'], ['community', t('Ưu tiên cao', 'High priority'), '#a6630b'],
    ['landslide', t('Sạt lở', 'Landslide'), '#cf3535'], ['staging', t('Điểm tập kết', 'Staging point'), '#236c68'],
    ['hlz', t('Hạ cánh đề xuất', 'Proposed landing'), '#a6630b']
  ];
  symbolLegend.forEach(([symbol, label, color], i) => {
    const x = 32 + i * 224, y = 882;
    ctx.beginPath(); ctx.arc(x + 10, y, 12, 0, Math.PI * 2); ctx.fillStyle = symbol === 'hlz' ? '#fff' : color; ctx.fill();
    if (symbol === 'hlz') { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(x + 1, y - 9); ctx.scale(18 / 24, 18 / 24); ctx.fillStyle = '#fff'; ctx.strokeStyle = symbol === 'hlz' ? color : '#fff'; ctx.lineWidth = 1.6;
    const path = new Path2D(mapSymbolPaths[symbol]); if (symbol === 'community') ctx.fill(path); else ctx.stroke(path); ctx.restore();
    text(label, x + 28, y + 5, 13);
  });
  const extraSymbols: Array<[MapSymbolName, string, string, boolean]> = [
    ['landslide', t('Nghi sạt lở', 'Suspected landslide'), '#cf3535', true],
    ['bridge', t('Cầu cần xác minh', 'Bridge to verify'), '#a6630b', false],
    ['crossing', t('Điểm vượt khe', 'Gully crossing'), '#a6630b', false]
  ];
  extraSymbols.forEach(([symbol, label, color, dashed], i) => {
    const x = 32 + i * 224, y = 916;
    ctx.beginPath(); ctx.arc(x + 10, y, 12, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    if (dashed) ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(x + 1, y - 9); ctx.scale(18 / 24, 18 / 24); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke(new Path2D(mapSymbolPaths[symbol])); ctx.restore();
    text(label, x + 28, y + 5, 13);
  });
  ctx.beginPath(); ctx.moveTo(706, 916); ctx.lineTo(736, 916); ctx.strokeStyle = '#678c86'; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
  text(t('Vùng đánh giá', 'Assessment area'), 748, 921, 13);
  text(t('H: vị trí đề xuất, chưa khảo sát. ETA chưa tính thời gian kiểm tra và xử lý chướng ngại.', 'H: proposed site, not surveyed. ETA excludes inspection and obstacle clearance.'), 32, 954, 13, '#617177');
  text(`EPSG:3857   ${t('Bắc địa lý', 'True north')}   ${t('Phiên bản dữ liệu', 'Dataset version')} ${snapshot.datasetVersion}`, 32, 988, 13, '#617177');
  text(t('Ảnh nền: Sentinel-2 theo metadata Chế Tạo. Nguồn gốc DEM chưa được xác nhận. Căn cứ chi tiết trong JSON.', 'Imagery: Sentinel-2 per Chế Tạo metadata. DEM provenance unconfirmed. Detailed evidence in JSON.'), 32, 1018, 13, '#617177');
  text(snapshot.dataKind === 'synthetic' ? t('Dữ liệu mô phỏng', 'Synthetic data') : snapshot.reviewStatus === 'published' ? t('Dữ liệu công bố', 'Published data') : t('Dữ liệu chưa công bố', 'Unpublished data'), 1160, 1018, 14, '#617177');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
}
