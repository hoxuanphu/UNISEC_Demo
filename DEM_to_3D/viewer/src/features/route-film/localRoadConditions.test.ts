import { describe, expect, it } from 'vitest';
import surveyKml from '../../../public/scenarios/che-tao/field/CheTao-Landslide-Scars.kml?raw';
import data from '../../../public/scenarios/che-tao/local-network.json';
import { validateLocalNetwork } from './localNetwork';
import { northernComparisonRoute, withLocalRoadConditions, localConditionAreas } from './localRoadConditions';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { nearestRoadAnchor, roadProjected, roadGeographic } from '../routes/selectedRoadJourney';
import { roadAreaContact } from './roadAreaContact';
import { fieldRecords } from '../landslides/fieldDataset';
import type { VectorFeature } from '../../geo/vector/types';
import { landslideAreaKey, landslideAreaOf } from '../landslides/landslideAreas';

// Exercise the actual survey outlines. Production uses the existing KML importer.
const features: VectorFeature[] = [...surveyKml.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/g)].map((match, i) => ({
  type: 'Feature', properties: { name: `Survey scar ${i}` }, geometry: { type: 'Polygon', coordinates: [
    /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(match[1])![1].trim().split(/\s+/).map(tuple => tuple.split(',').map(Number)),
  ] },
}));
const records = fieldRecords(features, 'survey-fixture', 'CheTao-Landslide-Scars.kml', 'network', '2026-10-19T00:00:00Z');
const original = validateLocalNetwork(data);
const network = withLocalRoadConditions(original, records);
const select = (name: string) => ({ origin: network.places.find(place => place.name === name)!.projected, source: name });

describe('near-road landslide warnings', () => {
  it('keeps a road inside an excluded hole clear and warns near its inner boundary', () => {
    const centre = original.roads[0].points[0];
    const ring = (size: number) => [[-size,-size],[size,-size],[size,size],[-size,size],[-size,-size]].map(([x,y]) => {
      const point = roadGeographic({x:centre.x+x,y:centre.y+y});
      return [point.longitude,point.latitude];
    });
    const record = {...records[0], feature: {...records[0].feature, geometry: {type:'Polygon' as const, coordinates:[ring(100),ring(50)]}}};
    const road = {...original.roads[0],status:'open' as const,hz:'none' as const,points:[{x:centre.x-5,y:centre.y},{x:centre.x+5,y:centre.y}]};
    const fixture = {...original,roads:[road],areas:[]};
    expect(localConditionAreas([record])[0].holes).toEqual([record.feature.geometry.coordinates[1]]);
    const clear = withLocalRoadConditions(fixture,[record]);
    expect(clear.conditions!.areaLinks).toHaveLength(0);
    expect(clear.roads).toEqual([road]);
    const nearBoundary = {...road,points:road.points.map(point=>({...point,y:point.y+45}))};
    expect(withLocalRoadConditions({...fixture,roads:[nearBoundary]},[record]).conditions!.areaLinks).toHaveLength(1);
  });
  it('keeps potential landslides as caution instead of closing the northern road', () => {
    const potential = records.map(record => ({ ...record, feature: { ...record.feature, properties: { ...record.feature.properties,
      [landslideAreaKey]: { ...landslideAreaOf(record)!, state: 'potential', part: 'undifferentiated' },
    } } }));
    const risk = withLocalRoadConditions(original, potential);
    expect(risk.conditions!.areaLinks).toHaveLength(16);
    expect(risk.conditions!.areaLinks.filter(link=>link.areaId.startsWith('field:')).every(link=>link.state==='potential')).toBe(true);
    expect(risk.roads.filter(road=>road.hz==='landslide-risk' && road.status!=='blocked').length).toBeGreaterThanOrEqual(6);
    expect(risk.roads.filter(road=>road.hz==='landslide-risk' && road.status!=='blocked').every(road=>road.status==='uncertain')).toBe(true);
    expect(risk.roads.filter(road=>road.status==='blocked').reduce((sum,road)=>sum+projectedPathLength(road.points),0))
      .toBeCloseTo(original.roads.filter(road=>road.status==='blocked').reduce((sum,road)=>sum+projectedPathLength(road.points),0),5);
    expect(northernComparisonRoute(risk,select('Village A'),select('Village C'))).toBeNull();
    const mixed = withLocalRoadConditions(original,potential.map((record,index)=>index===1?records[index]:record));
    const closed = mixed.roads.filter(road=>road.hz==='landslide');
    expect(closed).toHaveLength(1);
    expect(closed[0].status).toBe('blocked');
    expect(closed[0].landslideAreaId).toBe(records[1].id);
  });

  it('covers every nearby survey outline and removes the old distant associations', () => {
    expect(network.conditions!.areaLinks).toHaveLength(16);
    expect(Math.max(...network.conditions!.areaLinks.map(link => link.distanceM))).toBeLessThan(5);
    expect(network.conditions!.areaLinks.filter(link => link.areaId.startsWith('field:'))).toHaveLength(10);
    const closed = network.roads.filter(road => road.hz === 'landslide');
    expect(closed).toHaveLength(6);
    expect(new Set(closed.flatMap(road => road.landslideAreaIds ?? []))).toEqual(new Set(network.conditions!.areaLinks.filter(link=>link.areaId.startsWith('field:')).map(link => link.areaId)));
    for (const link of network.conditions!.areaLinks) {
      const road = network.roads.find(road => road.landslideAreaIds?.includes(link.areaId))!;
      expect(nearestRoadAnchor([road], link.roadPoint)!.distance).toBeLessThan(.001);
      const area = [...localConditionAreas(records),...original.areas].find(area => area.id === link.areaId)!;
      expect(roadAreaContact([link.areaPoint, link.areaPoint], area.coordinates.map(([lon,lat]) => roadProjected(lat,lon)))!.distanceM).toBeLessThan(.001);
    }
  });

  it('preserves network geometry, exact junctions and source polygons', () => {
    expect(original.roads.filter(road => road.hz === 'landslide')).toHaveLength(0);
    for (const road of network.roads.filter(road => road.hz === 'landslide')) {
      expect(road.status).toBe('blocked');
      expect(projectedPathLength(road.points)).toBeGreaterThanOrEqual(69.999);
      const index = network.roads.indexOf(road);
      expect(network.roads[index-1].points.at(-1)).toEqual(road.points[0]);
      expect(road.points.at(-1)).toEqual(network.roads[index+1].points[0]);
    }
    expect(network.roads.reduce((sum,road)=>sum+projectedPathLength(road.points),0))
      .toBeCloseTo(original.roads.reduce((sum,road)=>sum+projectedPathLength(road.points),0),5);
    expect(withLocalRoadConditions(network,records)).toBe(network);
    expect(validateLocalNetwork(network)).toBe(network);
    expect(network.areas).toBe(original.areas);
  });

  it('retains warnings when geometry is hidden and removes them only for removed or distant outlines', () => {
    const baseline=withLocalRoadConditions(original).conditions!.areaLinks;
    expect(baseline).toHaveLength(6);
    expect(withLocalRoadConditions(original,records.map(record=>({...record,visible:false}))).conditions!.areaLinks).toEqual(network.conditions!.areaLinks);
    const far = records.map(record => ({ ...record, feature: { ...record.feature, geometry: { type: 'Polygon' as const,
      coordinates: (record.feature.geometry as Extract<VectorFeature['geometry'],{type:'Polygon'}>).coordinates.map(ring=>ring.map(([x,y,...rest])=>[x+.1,y,...rest])) } } }));
    expect(withLocalRoadConditions(original,far).conditions!.areaLinks).toEqual(baseline);
  });

  it('raises checks beside every other mapped extent without inventing closures or moving the extent',()=>{
    const sourceIds=new Set(original.areas.map(area=>area.id));
    const extra=network.conditions!.areaLinks.filter(link=>sourceIds.has(link.areaId));
    expect(extra).toHaveLength(6);
    for(const link of extra){
      const segments=network.roads.filter(road=>road.landslideAreaIds?.includes(link.areaId));
      expect(segments.length).toBeGreaterThan(0);
      for(const segment of segments){
        const source=original.roads.find(road=>segment.id.startsWith(road.id+':condition:'))!;
        expect(segment.status).toBe(source.status==='blocked'?'blocked':'uncertain');
        expect(segment.hz).toBe('landslide-risk');
      }
    }
  });

  it.each([['Village A','Village C'],['Village C','Village A'],['Village B','Village C']])('keeps the northern road inspectable and bypasses it for %s to %s', (a,b) => {
    const start=select(a),end=select(b);
    const suggested=analyseRoadJourney(network.roads,start,end,true,250,'conditions').route!;
    expect(suggested).not.toBeNull();
    expect(suggested.segs.every(road=>road.status!=='blocked')).toBe(true);
    const comparison=northernComparisonRoute(network,start,end)!;
    expect(comparison.status).toBe('blocked');
    expect(comparison.segs.filter(road=>road.hz==='landslide')).toHaveLength(4);
    expect(comparison.points[0]).toEqual(suggested.points[0]);
    expect(comparison.points.at(-1)).toEqual(suggested.points.at(-1));
    for(let i=1;i<comparison.segs.length;i++)expect(comparison.segs[i-1].points.at(-1)).toEqual(comparison.segs[i].points[0]);
  });

  it('clears the comparison for missing or remote endpoints, or absent observations', () => {
    const a=select('Village A');
    expect(northernComparisonRoute(network,a,null)).toBeNull();
    expect(northernComparisonRoute(network,a,a)).toBeNull();
    expect(northernComparisonRoute(network,a,{origin:{x:410000,y:2415000},source:'map'})).toBeNull();
    expect(northernComparisonRoute(original,a,select('Village C'))).toBeNull();
  });
});
