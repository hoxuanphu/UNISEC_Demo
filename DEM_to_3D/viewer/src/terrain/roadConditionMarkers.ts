import { roadConditionSigns, roadConditionSignLabel } from '../features/map/roadConditionSigns';
import { roadConditionSvg } from '../features/map/roadConditionSvg';
import type { RoadSegment, Locale } from '../types/dear';
import type { LocalRoadAreaLink } from '../features/route-film/localNetwork';
import '../features/map/resident-route-extras.css';

/** Screen-sized signs, projected by the same camera as the road below them. */
export function createRoadConditionMarkers(host: HTMLElement, roads: RoadSegment[], areaLinks: LocalRoadAreaLink[] | undefined,
  locale: Locale, onSelect: (id: string) => void, interactive: boolean, hazards: Array<{ x: number; y: number }> = []) {
  const layer = document.createElement('div');
  layer.className = 'road-condition-marker-layer';
  layer.inert = !interactive;
  host.append(layer);
  const pins = roadConditionSigns(roads, areaLinks, hazards).map(sign => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `road-condition-sign ${sign.condition === 'blocked' ? 'road-closure-sign' : 'road-risk-sign'}${sign.road.hz === 'landslide' ? ' is-landslide' : ''}`;
    button.innerHTML = roadConditionSvg(sign.condition);
    button.setAttribute('aria-label', roadConditionSignLabel(sign.condition, locale));
    button.title = roadConditionSignLabel(sign.condition, locale);
    button.dataset.roadId = sign.road.id;
    button.dataset.roadCondition = sign.condition;
    if (sign.road.landslideAreaId) button.dataset.landslideArea = sign.road.landslideAreaId;
    if (sign.road.landslideAreaIds) button.dataset.landslideAreas = sign.road.landslideAreaIds.join(' ');
    button.hidden = true;
    button.onclick = event => {
      event.stopPropagation();
      if (!event.detail) { onSelect(sign.road.id); return; }
      const nearest = pins.filter(pin => !pin.button.hidden).map(pin => {
        const box = pin.button.getBoundingClientRect();
        return { id:pin.road.id, distance:Math.hypot(event.clientX - box.x - box.width / 2, event.clientY - box.y - box.height / 2) };
      }).sort((a,b)=>a.distance-b.distance)[0];
      if (nearest) onSelect(nearest.id);
    };
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) button.addEventListener(type, event => event.stopPropagation());
    layer.append(button);
    return { ...sign, button };
  });
  return {
    update(project: (point: { x: number; y: number }) => { x: number; y: number } | null) {
      // Read the viewport before any marker writes. Reading it inside this loop
      // forces layout again after each preceding marker has moved.
      const width = host.clientWidth, height = host.clientHeight;
      const projected = pins.map(pin => ({ ...pin, at: project(pin.point) }));
      for (const pin of projected) {
        const at = pin.at;
        const hidden = !at || at.x < 12 || at.y < 12 || at.x > width - 12 || at.y > height - 12;
        if (pin.button.hidden !== hidden) pin.button.hidden = hidden;
        if (hidden || !at) continue;
        const transform = `translate(${at.x - 22}px,${at.y - 22}px)`;
        if (pin.button.style.transform !== transform) pin.button.style.transform = transform;
        const gap = Math.min(...projected.filter(other => other !== pin && other.at).map(other => Math.max(Math.abs(at.x - other.at!.x), Math.abs(at.y - other.at!.y))));
        const size = `${Math.max(10, Math.min(22, gap - 4))}px`;
        if (pin.button.style.getPropertyValue('--closure-symbol-size') !== size) pin.button.style.setProperty('--closure-symbol-size', size);
      }
    },
    dispose() { layer.remove(); }
  };
}
