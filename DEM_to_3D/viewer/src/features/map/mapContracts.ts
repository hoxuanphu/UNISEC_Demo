import type { MapContextGeometry } from './contextGeometry';
import type { ImageryRaster } from '../imagery/analysisImagery';
import type { MutableRefObject } from 'react';
import type { AnalysisArea, Community, Hazard, Locale, ResponseSite, RoadSegment, ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import type { LayerAppearance } from './layerAppearance';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';

/** Shared display contract. It contains no Leaflet or Three.js objects. */
export type MapScene = {
  datasetVersion?: string;
  aoi?: AnalysisArea;
  communities: Community[];
  responseSites?: ResponseSite[];
  hazards: Hazard[];
  roads: RoadSegment[];
  /** Separate local graph for map context and explicit point-to-point searches.
   * It never changes the incident's assessed roads or village access routes. */
  contextRoads?: RoadSegment[];
  roadAreaLinks?: LocalRoadAreaLink[];
  selectedRoute: ScenarioRoute | null;
  selectedCommunityId: string | null;
  selectedObjectId: string | null;
  layers: Record<string, boolean>;
  appearance?: LayerAppearance;
};

export type OverlayHit =
  | { type: 'community'; id: string }
  | { type: 'road'; id: string }
  | { type: 'hazard'; id: string }
  | { type: 'poi'; id: string }
  | { type: 'aoi'; id: string };

/** Right-click on the map: the object under the pointer, if any, and its WGS84 position. */
export type MapContextRequest = {
  clientX: number;
  clientY: number;
  latitude: number;
  longitude: number;
  hit: OverlayHit | null;
  /** Zoom in around this position (object positions use a street-level zoom). */
  zoomHere: () => void;
};

export type BasemapStyle = 'satellite' | 'terrain';
export type BasemapState = {
  provider?: 'configured' | 'eox';
  relief?: 'loading' | 'ready' | 'partial' | 'error';
  status: 'off' | 'loading' | 'ready' | 'partial' | 'error' | 'unavailable';
  style: BasemapStyle;
  loaded: number;
  total: number;
};

export type ViewControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  frameProjected?: (points: Array<{x:number;y:number}>, inset?: {right?:number;bottom?:number}) => void;
  retryBasemap: () => void;
  setOrbit?: (enabled: boolean) => void;
  /** Centre a point in the part of the map not covered by floating panels (`inset` in px). */
  focusProjected: (point: { x: number; y: number }, inset?: { right?: number }) => void;
  /** Route flyover playback and video export (3D only). */
  flyover?: import('../../terrain/flyover/flyoverController').FlyoverControls;
};

export type MapDisplayProps = {
  locale?: Locale;
  /** Explicit demo person. Kept separate from real device position and road assessments. */
  deviceFeed?: import('../tracking/deviceFeed').DeviceFeed | null;
  routeSimulation?: import('../routes/routeSimulation').RouteSimulation | null;
  /** Choosing route endpoints takes priority over feature inspection. */
  pointPickActive?: boolean;
  onPointPick?: (latitude: number, longitude: number, roadId?: string) => void;
  contextGeometry?: MapContextGeometry;
  contextAlwaysVisibleAreaIds?: string[];
  roadAreaLinks?: LocalRoadAreaLink[];
  showRoadAreaLinks?: boolean;
  selectedContextAreaId?: string | null;
  onSelectContextArea?: (id:string)=>void;
  /** Resident map: other unblocked routes, tappable to choose, and closure signs on blocked roads. */
  alternativeRoutes?: import('../../types/dear').ScenarioRoute[];
  onChooseRoute?: (id: string) => void;
  roadAlerts?: import('../../types/dear').RoadSegment[];
  /** Blocked corridor for comparison only; never offered as a route choice. */
  comparisonRoute?: ScenarioRoute | null;
  onInspectRoad?: (id: string) => void;
  /** Field huts with people from the resident app; isolated ones show as alarms. */
  households?: import('../presence/householdIsolation').HouseholdAccess[];
  selectedHouseholdId?: string | null;
  attendedHouseholds?: string;
  onSelectHousehold?: (id: string) => void;
  /** Hide context areas below this zoom, where they would only be specks. */
  contextMinZoom?: number;
  /** Prepared EO rendering drawn above the basemap and below every vector layer. */
  analysisImagery?: { rasters: ImageryRaster[]; opacity: number; balanceBasemap?: boolean };
  scenarioProps?: MapScene;
  onSelectOverlayHit?: (hit: OverlayHit) => void;
  viewControlRef?: MutableRefObject<ViewControls | null>;
  onViewReady?: () => void;
  onOrbitChange?: (enabled: boolean) => void;
  onBasemapState?: (state: BasemapState) => void;
  focusPoint?: { x: number; y: number; z: number } | null;
  profileMetadata?: TerrainMetadata;
};
