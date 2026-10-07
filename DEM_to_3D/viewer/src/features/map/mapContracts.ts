import type { MutableRefObject } from 'react';
import type { AnalysisArea, Community, Hazard, Locale, ResponseSite, RoadSegment, ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import type { LayerAppearance } from './layerAppearance';

/** Shared display contract. It contains no Leaflet or Three.js objects. */
export type MapScene = {
  aoi?: AnalysisArea;
  communities: Community[];
  responseSites?: ResponseSite[];
  hazards: Hazard[];
  roads: RoadSegment[];
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

export type BasemapStyle = 'satellite' | 'terrain';
export type BasemapState = {
  status: 'off' | 'loading' | 'ready' | 'partial' | 'error' | 'unavailable';
  style: BasemapStyle;
  loaded: number;
  total: number;
};

export type ViewControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  retryBasemap: () => void;
  focusProjected: (point: { x: number; y: number }) => void;
};

export type MapDisplayProps = {
  locale?: Locale;
  scenarioProps?: MapScene;
  onSelectOverlayHit?: (hit: OverlayHit) => void;
  viewControlRef?: MutableRefObject<ViewControls | null>;
  onBasemapState?: (state: BasemapState) => void;
  focusPoint?: { x: number; y: number; z: number } | null;
  profileMetadata?: TerrainMetadata;
};
