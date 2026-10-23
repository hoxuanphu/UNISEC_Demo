import { describe, expect, it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import catalog from '../../../public/scenarios/che-tao/field-photos/photos.json';
import { validatePhotoCatalog } from '../fieldPhotos/preparedPhotos';
import { validateLocalNetwork } from './localNetwork';
import { networkContext } from './networkContext';
import { buildLocalFlyover, illustrativePhotoForArea, localRouteStops } from './localFlyover';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
const network=validateLocalNetwork(data),context=networkContext(network);
const points=validatePhotoCatalog(catalog,'/scenarios/che-tao/field-photos/photos.json');
const photos=new Map(points.map(point=>[point.hazardId,point]));
const endpoint=(name:string)=>{const place=network.places.find(place=>place.name===name)!;return {origin:place.projected,source:place.id,label:place.name};};
const route=analyseRoadJourney(network.roads,endpoint('Village B'),endpoint('Village C'),true,250);
describe('shared local map and 3D film',()=>{
  it('keeps polygon IDs/coordinates and does not fabricate point hazard observations',()=>{
    expect(context.areas).toHaveLength(network.areas.length);
    for(const area of context.areas){expect(area.coordinates).toEqual(network.areas.find(source=>source.id===area.id)!.coordinates);expect(area.source).toBe('demo');}
    expect(context.closures).toHaveLength(1);
  });
  it('selects up to three distinct nearby mapped polygons along the chosen route',()=>{
    const stops=localRouteStops(route.route!,context.areas);
    expect(stops.length).toBeGreaterThan(0);expect(stops.length).toBeLessThanOrEqual(3);
    expect(new Set(stops.map(stop=>stop.area.id)).size).toBe(stops.length);
    for(const stop of stops){expect(context.areas).toContain(stop.area);expect(stop.area.kind).toBe('landslide');expect(stop.offset).toBeLessThan(650);}
    expect(stops.map(stop=>stop.station)).toEqual(stops.map(stop=>stop.station).sort((a,b)=>a-b));
  });
  it('uses one polygon/photo association in the map card and movie, labelled illustrative',()=>{
    const input=buildLocalFlyover(network,context,route.route,route.start,route.end,photos)!;
    expect(input.cameraMode).toBe('network');expect(input.retainContext).toBe(true);
    expect(input.stops.length).toBeGreaterThan(0);
    for(const stop of input.stops){expect(stop.photo).toEqual(illustrativePhotoForArea(stop.id,photos));expect(stop.photoRole).toBe('illustrative');expect(stop.photoCaption?.[1]).toContain('not evidence');expect(context.areas.find(area=>area.id===stop.id)?.center).toEqual(stop.projected);}
    expect(input.context).toBe(context);
    expect(input.imagery).toEqual([]);
  });
  it('frames every mapped road in the closing overview without changing the selected route',()=>{
    const input=buildLocalFlyover(network,context,route.route,route.start,route.end,photos)!;
    expect(input.route).toBe(route.route!.points);
    const bounds=input.overviewPoints!,minX=Math.min(...bounds.map(p=>p.x)),maxX=Math.max(...bounds.map(p=>p.x)),minY=Math.min(...bounds.map(p=>p.y)),maxY=Math.max(...bounds.map(p=>p.y));
    for(const road of network.roads)for(const p of road.points){expect(p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY).toBe(true);}
  });
});
