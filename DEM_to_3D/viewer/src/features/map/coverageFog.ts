import * as L from 'leaflet';
import type { CoverageLayers, CoverageSpot } from '../presence/rescueCoverage';

type Point = { x: number; y: number };
const colour = { need: '#e53935', unverified: '#f29900', team: '#26a65b', rescued: '#9aa3ad' } as const;

/**
 * Fog of war over a small Leaflet map: dark where no team has been, lifting softly where one
 * has, with the signals drawn through it. One canvas over the map, redrawn on view changes.
 */
export function addCoverageFog(map: L.Map, toLatLng: (point: Point) => L.LatLng | null,
  spots: () => readonly CoverageSpot[], layers: () => CoverageLayers, rescued: () => readonly Point[]) {
  const canvas = document.createElement('canvas');
  canvas.className = 'coverage-fog';
  map.getContainer().append(canvas);
  const at = (point: Point) => { const ll = toLatLng(point); return ll ? map.latLngToContainerPoint(ll) : null; };
  const radius = (point: Point, metres: number) => {
    const a = at(point), b = at({ x: point.x + metres, y: point.y });
    return a && b ? Math.max(3, a.distanceTo(b)) : 0;
  };
  const dot = (context: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) => {
    context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2);
    context.fillStyle = fill; context.fill(); context.lineWidth = 1.5; context.strokeStyle = '#fff'; context.stroke();
  };
  const draw = () => {
    // Leaflet projects nothing until the map has a view.
    if (typeof map.getZoom() !== 'number') return;
    const size = map.getSize(), ratio = window.devicePixelRatio || 1;
    canvas.width = size.x * ratio; canvas.height = size.y * ratio;
    canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    const shown = layers(), all = spots();
    if (shown.fog) {
      context.fillStyle = 'rgba(10, 16, 14, .6)';
      context.fillRect(0, 0, size.x, size.y);
      // Lift the fog with soft edges where a team has been or is.
      context.globalCompositeOperation = 'destination-out';
      for (const spot of all) {
        if (spot.kind !== 'reached' && spot.kind !== 'team') continue;
        const p = at(spot.point), r = radius(spot.point, spot.radiusM);
        if (!p || !r) continue;
        const gradient = context.createRadialGradient(p.x, p.y, r * .6, p.x, p.y, r);
        gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient; context.beginPath(); context.arc(p.x, p.y, r, 0, Math.PI * 2); context.fill();
      }
      context.globalCompositeOperation = 'source-over';
    }
    if (shown.rescued) for (const point of rescued()) {
      const p = at(point); if (!p) continue;
      dot(context, p.x, p.y, 5.5, colour.rescued);
      context.beginPath(); context.moveTo(p.x - 3, p.y); context.lineTo(p.x - 1, p.y + 2); context.lineTo(p.x + 3, p.y - 2);
      context.strokeStyle = '#fff'; context.lineWidth = 1.5; context.stroke();
    }
    for (const spot of all) {
      if (spot.kind !== 'need' && spot.kind !== 'unverified') continue;
      if (spot.kind === 'need' ? !shown.need : !shown.unverified) continue;
      const p = at(spot.point), r = radius(spot.point, spot.radiusM);
      if (!p) continue;
      const tint = spot.kind === 'need' ? colour.need : colour.unverified;
      // A soft halo shows the signal through the fog; the dot marks where it is.
      const gradient = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(r, 8));
      gradient.addColorStop(0, `${tint}99`); gradient.addColorStop(1, `${tint}00`);
      context.fillStyle = gradient; context.beginPath(); context.arc(p.x, p.y, Math.max(r, 8), 0, Math.PI * 2); context.fill();
      dot(context, p.x, p.y, 3.5, tint);
    }
    if (shown.team) for (const spot of all) { if (spot.kind !== 'team') continue; const p = at(spot.point); if (p) dot(context, p.x, p.y, 3.5, colour.team); }
  };
  map.on('load move zoom resize viewreset', draw);
  draw();
  return { draw, dispose: () => { map.off('load move zoom resize viewreset', draw); canvas.remove(); } };
}
