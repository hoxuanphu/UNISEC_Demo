import { describe, expect, it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import catalog from '../../../public/scenarios/che-tao/field-photos/photos.json';
import { validatePhotoCatalog } from '../fieldPhotos/preparedPhotos';
import { validateLocalNetwork } from './localNetwork';
import { networkContext } from './networkContext';
import { buildLocalFlyover, FILM_STOP_EDGE_M, illustrativePhotoForArea, localRouteStops } from './localFlyover';
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
  it('stops only where a mapped slide meets the road, not at scars up the slope',()=>{
    const ac=analyseRoadJourney(network.roads,endpoint('Village A'),endpoint('Village C'),true,250);
    const stops=localRouteStops(ac.route!,context.areas);
    // Vùng sạt 25 lies 58 m from the road at its nearest edge: not a stop.
    expect(stops.map(stop=>stop.area.name[0])).toEqual(['Vùng sạt 01','Vùng sạt 13']);
    for(const stop of stops)expect(stop.offset).toBeLessThanOrEqual(FILM_STOP_EDGE_M);
  });
  it('uses one polygon/photo association in the map card and movie, labelled illustrative',()=>{
    const input=buildLocalFlyover(network,context,route.route,route.start,route.end,photos)!;
    expect(input.cameraMode).toBe('network');expect(input.retainContext).toBe(true);
    expect(input.stops.length).toBeGreaterThan(0);
    for(const stop of input.stops){expect(stop.photo).toEqual(illustrativePhotoForArea(stop.id,photos));expect(stop.photoRole).toBe('illustrative');expect(stop.photoCaption?.[1]).toContain('Reference photo');expect(context.areas.find(area=>area.id===stop.id)?.center).toEqual(stop.projected);}
    expect(input.context).toBe(context);
    expect(input.imagery).toEqual([]);
  });
  it('closes on the route and its figures, and shows only the people cut off',()=>{
    const ac=analyseRoadJourney(network.roads,endpoint('Village A'),endpoint('Village C'),true,250);
    const hut=(id:string,isolated:boolean)=>({cluster:{id,people:4},projected:{x:1,y:2},isolated}) as unknown as NonNullable<Parameters<typeof buildLocalFlyover>[6]>[number];
    const input=buildLocalFlyover(network,context,ac.route,ac.start,ac.end,photos,[hut('HH-01',true),hut('HH-02',false)])!;
    expect(input.alerts).toEqual([{id:'HH-01',projected:{x:1,y:2},people:4}]);
    expect(input.summary!.title).toEqual(['Bản A đến Bản C','Village A to Village C']);
    const [km,slides,difficult]=input.summary!.stats;
    expect(km.value[1]).toBe(ac.route!.lengthKm.toLocaleString('en-GB',{maximumFractionDigits:1}));
    // Every slide the road meets counts, not only the film stops.
    expect(Number(slides.value[1])).toBeGreaterThanOrEqual(input.stops.length);
    expect(Number(difficult.value[1])).toBeGreaterThanOrEqual(0);
    for(const stat of input.summary!.stats)expect(stat.label[1].length).toBeLessThan(22);
  });
  it('frames every mapped road in the closing overview without changing the selected route',()=>{
    const input=buildLocalFlyover(network,context,route.route,route.start,route.end,photos)!;
    expect(input.route).toBe(route.route!.points);
    const bounds=input.overviewPoints!,minX=Math.min(...bounds.map(p=>p.x)),maxX=Math.max(...bounds.map(p=>p.x)),minY=Math.min(...bounds.map(p=>p.y)),maxY=Math.max(...bounds.map(p=>p.y));
    for(const road of network.roads)for(const p of road.points){expect(p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY).toBe(true);}
  });
});
