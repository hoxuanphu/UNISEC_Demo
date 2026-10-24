import { routeStopSvg } from '../routes/routeStopSymbol';
import type * as L from 'leaflet';
import { overlaps, type ScreenRect } from '../../terrain/markerLayout';

/** Resident stops sit above contextual place symbols, at their original coordinates. */
export function addResidentRoutePins(map: L.Map, points: Array<{latitude: number; longitude: number; label: string; name?: string; onSelect?: () => void}>) {
  const layer = document.createElement('div');
  layer.className = 'resident-route-pins';
  const pins = points.map(point => {
    const pin = document.createElement('button');pin.type = 'button';
    pin.className = `resident-route-endpoint journey-map-pin is-${point.label.toLowerCase()}`;
    pin.setAttribute('aria-label', `${point.label}${point.name ? ', '+point.name : ''}`);
    if (point.onSelect) pin.onclick = point.onSelect;
    else pin.tabIndex = -1;
    const letter = document.createElement('b');letter.innerHTML = routeStopSvg(point.label === 'A');
    pin.append(letter);
    const name = document.createElement('span');name.className = 'resident-stop-name';name.textContent = point.name ?? '';name.hidden = true;
    layer.append(pin, name);
    return {point, pin, name};
  });
  const host = map.getContainer().parentElement;
  host?.append(layer);
  const update = () => {
    const hostRect = map.getContainer().getBoundingClientRect();
    const rect = (node: Element): ScreenRect => {const box = node.getBoundingClientRect();return {x: box.x-hostRect.x,y: box.y-hostRect.y,width:box.width,height:box.height};};
    const obstacles = Array.from(host?.closest('.map-area')?.querySelectorAll<HTMLElement>('.map-toolbar,.road-journey-panel,.citizen-map-tools,.citizen-map-layers,.citizen-map-summary,.citizen-map-context,.map-reference,.map-attribution,.map-pin:not([hidden]),.map-pin:not([hidden]):not(.is-label-hidden) .map-pin-label,.road-condition-sign svg') ?? [])
      .filter(node => node.getBoundingClientRect().height > 0).map(rect);
    for (const {point, pin} of pins) {
      const at = map.latLngToContainerPoint([point.latitude, point.longitude]);
      const transform = `translate(${at.x-13}px,${at.y-13}px)`;
      if (pin.style.transform !== transform) pin.style.transform = transform;
      obstacles.push({x:at.x-13,y:at.y-13,width:26,height:26});
    }
    const measure = document.createElement('canvas').getContext('2d');
    for (const {point, name} of pins) {
      if (!point.name || !measure) continue;
      const at = map.latLngToContainerPoint([point.latitude, point.longitude]);
      const style = getComputedStyle(name);measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const size = {width: Math.ceil(measure.measureText(point.name).width)+2, height:22};
      const placed = [
        {x:at.x+20,y:at.y-11}, {x:at.x-size.width-20,y:at.y-11},
        {x:at.x-size.width/2,y:at.y-40}, {x:at.x-size.width/2,y:at.y+20},
      ].map(position => ({...position,...size})).find(box => box.x >= 8 && box.y >= 8 &&
        box.x+box.width <= hostRect.width-8 && box.y+box.height <= hostRect.height-8 && !obstacles.some(obstacle => overlaps(box,obstacle,5)));
      if (name.hidden !== !placed) name.hidden = !placed;
      if (placed) {
        const transform = `translate(${placed.x}px,${placed.y}px)`;
        if (name.style.transform !== transform) name.style.transform = transform;
        obstacles.push(placed);
      }
    }
  };
  update();map.on('move zoom resize', update);
  let frame = 0;
  const changes = new MutationObserver(records => {
    if (records.every(record => layer.contains(record.target))) return;
    if (!frame) frame = requestAnimationFrame(() => {frame=0;update();});
  });
  if (host) changes.observe(host, {childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  return () => {cancelAnimationFrame(frame);changes.disconnect();map.off('move zoom resize', update);layer.remove();};
}
