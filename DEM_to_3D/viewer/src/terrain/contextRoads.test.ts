import { applyDrawingOrder, defaultDrawingOrder, mapLayerOrder } from '../features/map/mapLayerOrder';
import { describe, expect, it } from 'vitest';
import { buildScenarioOverlays } from './scenarioOverlays';
import { contextRoadStyle } from '../features/map/contextRoadStyle';
import { roadColors } from './roadStyle';
import { validateMetadata } from './validation';
import metadataJson from '../../public/terrain/che_tao_v2_tex.terrain.json';
import type { RoadSegment, ScenarioRoute } from '../types/dear';
import type { Line2 } from 'three/examples/jsm/lines/Line2.js';

const road: RoadSegment={id:'local:road',name:['Đường trong xã','Local road'],cls:'track',status:'open',len:.1,
  points:[{x:400000,y:2402000},{x:400100,y:2402000}]};
const metadata=validateMetadata(metadataJson);
const build=(layers: Record<string,boolean>,selectedRoute: ScenarioRoute|null=null)=>buildScenarioOverlays({metadata,
  grid:new Float32Array(metadata.grid.shape[0]*metadata.grid.shape[1]).fill(500), elevationAt:()=>500,
  roads:[],contextRoads:[road,{...road,id:'closed',status:'blocked'}],communities:[],hazards:[],layers,
  selectedRoute,selectedCommunityId:null,selectedObjectId:null,screenMarkers:true});
const lines=(group:ReturnType<typeof build>)=>(group.getObjectByName('scenario-roads')?.children??[]) as Line2[];
const dispose=(group:ReturnType<typeof build>)=>group.traverse(object=>{const line=object as Line2;line.geometry?.dispose();
  const materials=Array.isArray(line.material)?line.material:[line.material];materials.forEach(material=>material?.dispose());});

describe('local roads on the main map',()=>{
  it('reorders actual road primitives without losing source identity, casings or closure priority',()=>{
    const group=build({roads:true,status:true,imagery:true});
    const ordinary=lines(group).filter(line=>line.userData.id===road.id);
    expect(ordinary).toHaveLength(2);
    expect(ordinary.every(line=>line.userData.drawingLayer==='roads')).toBe(true);
    applyDrawingOrder(group,defaultDrawingOrder);
    const before=ordinary[0].renderOrder;
    applyDrawingOrder(group,['landslides','reference','boundary','roads']);
    expect(ordinary[0].renderOrder).toBeLessThan(before);
    expect(ordinary[1].renderOrder).toBeGreaterThan(ordinary[0].renderOrder);
    const closed=lines(group).filter(line=>line.userData.id==='closed');
    expect(closed.every(line=>line.renderOrder>=mapLayerOrder.roadStatus*2)).toBe(true);
    expect(ordinary.every(line=>line.userData.id===road.id)).toBe(true);
    dispose(group);
  });
  it('keeps context subtle at overview scale and preserves closures on close views',()=>{
    expect(contextRoadStyle(road,12,true,true).weight).toBeLessThan(contextRoadStyle(road,16,true,true).weight);
    expect(contextRoadStyle(road,16,true,true).weight).toBeLessThan(3);
    expect(contextRoadStyle({...road,status:'blocked'},12,true,true).color).toBe(roadColors.blocked);
    expect(contextRoadStyle({...road,status:'blocked'},16,true,false).color).toBe(roadColors.reference);
  });
  it('renders the local graph on terrain with independent IDs and actual road statuses',()=>{
    const group=build({roads:true,status:true,imagery:true});
    const visible=lines(group).filter(line=>!line.userData.casing);
    expect(visible).toHaveLength(2);
    expect(visible.every(line=>line.userData.context)).toBe(true);
    expect(visible.find(line=>line.userData.id==='closed')!.material.color.getHexString()).toBe(roadColors.blocked.slice(1));
    dispose(group);
  });
  it('keeps road risk visible in 3D even before the passability status changes',()=>{
    const group=buildScenarioOverlays({metadata,grid:new Float32Array(metadata.grid.shape[0]*metadata.grid.shape[1]).fill(500),
      elevationAt:()=>500,roads:[{...road,hz:'landslide-risk'}],communities:[],hazards:[],
      layers:{roads:true,status:true},appearance:{imageryOpacity:1,networkOpacity:.65,labels:'auto',roads:'affected'},
      selectedRoute:null,selectedCommunityId:null,selectedObjectId:null,screenMarkers:true});
    const visible=lines(group).filter(line=>!line.userData.casing);
    expect(visible).toHaveLength(1);
    expect(visible[0].material.color.getHexString()).toBe(roadColors.uncertain.slice(1));
    expect(visible[0].material.dashed).toBe(true);
    dispose(group);
  });
  it('applies network opacity to local context without fading closures or selected roads',()=>{
    expect(contextRoadStyle(road,14,true,true,false,.3).opacity).toBeLessThan(contextRoadStyle(road,14,true,true,false,.9).opacity);
    expect(contextRoadStyle({...road,status:'blocked'},14,true,true,false,.3).opacity).toBe(1);
    expect(contextRoadStyle(road,14,true,true,true,.3).opacity).toBe(1);
  });
  it('hides the background graph independently while retaining an explicitly selected partial route',()=>{
    const hidden=build({roads:true,localRoads:false,status:true});
    expect(lines(hidden)).toHaveLength(0);dispose(hidden);
    const part={...road,id:road.id+':part:0',points:[road.points[0],{x:400050,y:2402000}]};
    const route:ScenarioRoute={id:'chosen',name:['Tuyến','Route'],communityId:'',type:'candidate',status:'open',segs:[part],points:part.points,lengthKm:.05};
    const group=build({roads:true,localRoads:false,status:true,route:true},route);
    const visible=lines(group).filter(line=>!line.userData.casing);
    expect(visible).toHaveLength(1);
    expect(visible[0].userData.id).toBe(road.id);
    expect(visible[0].material.color.getHexString()).toBe(roadColors.selected.slice(1));dispose(group);
  });
});
