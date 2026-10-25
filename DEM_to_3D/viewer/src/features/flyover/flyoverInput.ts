import proj4 from 'proj4';
import type { MapContextGeometry } from '../map/contextGeometry';
import { geometryPositions, type GeometryRecord } from '../../geo/vector/types';
import { landslideAreaOf } from '../landslides/landslideAreas';
import type { Community, Hazard, ResponseSite, ScenarioRoutePair } from '../../types/dear';
import type { PreparedPhoto, PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { selectedRasters, acquisitionLabel, type AnalysisLayer, type AnalysisSelection, type ImageryRaster } from '../imagery/analysisImagery';
import { roadHazardIds } from '../incident/roadHazards';

type Localized = [vi: string, en: string];
export type FlyoverInput = {
  /** Changes whenever the route, its stops or their status change. */
  key: string;
  cameraMode?: 'corridor' | 'network';
  retainContext?: boolean;
  context?: MapContextGeometry;
  route: Array<{ x: number; y: number }>;
  overviewPoints?: Array<{x:number;y:number}>;
  start: Localized; end: Localized;
  stops: Array<{ id: string; name: Localized; projected: { x: number; y: number }; areaHa?: number; status: 'reported' | 'suspected'; photo?: PreparedPhoto; photoRole?: 'evidence' | 'illustrative'; photoCaption?: Localized }>;
  /** Actual mapped extents used to frame neighbouring scars, never generated evidence. */
  areas: Array<{id: string; center: {x: number; y: number}; radius: number}>;
  imagery: ImageryRaster[];
  imageryOpacity: number;
  imageryLabel: Localized;
  /** Named places drawn into every frame, so an exported video reads like the map. */
  places?: Array<{ name: Localized; kind: 'community' | 'staging' | 'hlz'; projected: { x: number; y: number } }>;
  /** People cut off, from the resident app: drawn wherever they come into view. */
  alerts?: Array<{ id: string; projected: { x: number; y: number }; people: number }>;
  /** The closing card: what the route is and what is on it. */
  summary?: { title: Localized; stats: Array<{ value: Localized; label: Localized }> };
};

const day = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}`; };

/** The survey names its reference photo, e.g. "Scar 2 [0850]" → IMG_0850. */
export function referencePhoto(point: PreparedPhotoPoint): PreparedPhoto | undefined {
  const number = point.surveyName.match(/\[(\d+)\]/)?.[1];
  return point.photos.find(photo => number && photo.name.endsWith(number)) ?? point.photos[0];
}

/** The flyover follows the access route of the highest-priority community that has
 * hazards on it, from the staging point, with every hazard on that route as a stop. */
export function buildFlyoverInput(options: {
  communities: Community[]; routes: Map<string, ScenarioRoutePair>; hazards: Hazard[]; responseSites: ResponseSite[];
  overviewPoints?: Array<{x:number;y:number}>;
  mappedAreas?: GeometryRecord[];
  fieldPhotos?: Map<string, PreparedPhotoPoint>; imageryLayers: AnalysisLayer[]; imagerySelection?: AnalysisSelection;
}): FlyoverInput | null {
  const { communities, routes, hazards, responseSites, fieldPhotos, imageryLayers } = options;
  if (options.imagerySelection?.layer && !imageryLayers.length) return null;
  const staging = responseSites.find(site => site.kind === 'staging');
  const candidates = [...communities].sort((a, b) => a.prio - b.prio).flatMap(community => {
    const pair = routes.get(community.id), route = pair?.candidate ?? pair?.direct;
    if (!route || route.points.length < 2) return [];
    const ids = new Set(route.segs.flatMap(roadHazardIds));
    return [{ community, route, stops: hazards.filter(hazard => ids.has(hazard.id)) }];
  });
  const chosen = candidates.find(item => item.stops.length) ?? candidates[0];
  if (!chosen || !staging) return null;
  const selected=options.imagerySelection;
  const optical = imageryLayers.find(layer => layer.kind==='optical' && layer.id === (selected ? selected.layer : 'planet-post'));
  const dates = optical ? acquisitionLabel(optical) : null;
  const imagery = selectedRasters(imageryLayers,{layer:optical?.id ?? null,sarMode:'vv',opacity:1});
  const stops = chosen.stops.map(hazard => {
    const point = fieldPhotos?.get(hazard.id), photo = point ? referencePhoto(point) : undefined;
    return {
      id: hazard.id, name: hazard.name, projected: hazard.projected, areaHa: hazard.area, status: hazard.observation,
      photo, photoCaption: photo ? [`Ảnh hiện trường ${day(photo.capturedAt)}`, `Field photo ${day(photo.capturedAt)}`] as Localized : undefined
    };
  });
  const areas = (options.mappedAreas ?? []).flatMap(record => {
    if (!record.visible || !landslideAreaOf(record)) return [];
    const points = geometryPositions(record.feature.geometry).map(p => proj4('EPSG:4326','EPSG:32648',p.slice(0,2)));
    const left=Math.min(...points.map(p=>p[0])), right=Math.max(...points.map(p=>p[0]));
    const bottom=Math.min(...points.map(p=>p[1])), top=Math.max(...points.map(p=>p[1]));
    return [{id:record.id, center:{x:(left+right)/2,y:(bottom+top)/2},radius:Math.hypot(right-left,top-bottom)/2}];
  });
  return {
    key: JSON.stringify([chosen.route.id, chosen.route.points, stops.map(stop => [stop.id,stop.name,stop.projected,stop.status,stop.photo?.image.sha256,stop.photo?.capturedAt]), imagery.map(raster => raster.terrain.sha256),selected?.opacity??1,areas,options.overviewPoints]),
    route: chosen.route.points, overviewPoints:options.overviewPoints,
    start: [staging.name[0].replace(/^Điểm tập kết /, ''), staging.name[1].replace(/ staging point$/, '')],
    end: [chosen.community.name, chosen.community.name],
    stops,
    areas,
    imagery, imageryOpacity:selected?.opacity??1,
    imageryLabel: dates ? [`ảnh PlanetScope ${dates}`, `PlanetScope ${dates}`] : ['ảnh vệ tinh', 'satellite imagery'],
    places: [
      ...communities.map(community => ({ name: [community.name, community.name] as Localized, kind: 'community' as const, projected: community.projected })),
      ...responseSites.map(site => ({ name: site.name, kind: site.kind, projected: site.projected })),
    ]
  };
}
