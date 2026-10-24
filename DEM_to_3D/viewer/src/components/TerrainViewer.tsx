import { createSimulatedResident } from '../terrain/simulatedResident';
import '../features/routes/route-simulation.css';
import { createRouteEndpoints, type RouteEndpoint } from '../terrain/routeEndpoints';
import { useMapLayerOrder } from '../features/map/useMapLayerOrder';
import { applyDrawingOrder } from '../features/map/mapLayerOrder';
import { createContextAreaOverlay } from '../terrain/contextAreas';
import '../features/map/context-areas.css';
import {detailMaxZoom} from '../features/map/imageryDetail';
import { useLandslideAppearance } from '../features/landslides/useLandslideAppearance';
import { setBasemapTone } from '../terrain/basemapTone';
import { basemapTones,contextBasemapTone,preparedToneAssetId } from '../features/imagery/basemapTone';
import { ImageryStatus, type ImageryLoadState } from '../features/imagery/ImageryStatus';
import '../features/terrain/terrain-overlays.css';
import { createLocalTileImagery } from '../terrain/localTileImagery';
import { createAnalysisDrape } from '../terrain/analysisImageryDrape';
import { createTerrainOverlays } from '../terrain/terrainOverlays';
import type { TerrainOverlayOptions } from '../features/terrain/useTerrainOverlays';
import { createViewImagery, visibleImageryPoints, viewImageryTiles } from '../terrain/viewImagery';
import {terrainReferencePoints} from '../terrain/terrainReferencePoints';
import { detailInset } from '../features/map/detailInset';
import { basemapFrame } from '../terrain/basemapFrame';
import { planBasemapTiles } from '../terrain/regionalBasemap';
import { terrainAreaLabel } from '../features/landslides/terrainAreaLabel';
import { terrainSurfaceElevation } from '../terrain/terrainSurface';
import { responseOverviewPoints } from '../features/map/responseOverview';
import { renderOnDemand } from '../terrain/renderOnDemand';
import { cameraPoseBesideDock, frameCameraPoints } from '../terrain/cameraFraming';
import { terrainReferenceRoads } from '../terrain/terrainReferenceRoads';
import { terrainLandslideAreas, disposeTerrainAreas } from '../features/landslides/terrainAreas';
import type { GeometryRecord } from '../geo/vector/types';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapControls as ThreeMapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { LoadedModel, TerrainPoint, TerrainMetadata } from '../types/terrain';
import { bilinearElevation } from '../terrain/elevationGrid';
import { projectedToWgs84, projectedToScene, projectedToPixel, sceneToProjected } from '../terrain/coordinate';
import { buildBvh, disposeBvh, disposeObjectResources } from '../terrain/raycast';
import type { SurfaceProfile } from '../terrain/profile';
import type { GeographicPlacement } from '../terrain/geographic';
import { applyElevationColorRamp } from '../terrain/colorRamp';
import { createTerrainImagery } from '../terrain/terrainImagery';
import { imagerySource } from '../features/map/imagerySource';
import { buildScenarioOverlays } from '../terrain/scenarioOverlays';
import { createScenarioMarkers } from '../terrain/scenarioMarkers';
import { createMapReference } from '../terrain/mapReference';
import { createRegionalBasemap } from '../terrain/regionalBasemap';
import type { MapDisplayProps, OverlayHit } from '../features/map/mapContracts';
import { createFlyoverController, type FlyoverController, type FlyoverState } from '../terrain/flyover/flyoverController';
import type { FlyoverInput } from '../features/flyover/flyoverInput';
import type { ViewControls } from '../features/map/mapContracts';
import '../features/flyover/flyover.css';

export type TerrainViewerProps = MapDisplayProps & {
  surfaceLayers?: Record<string, boolean>;
  terrainOverlays?: TerrainOverlayOptions;
  onTerrainOverlayStatus?: (kind: 'contours' | 'sar', message: string | null) => void;
  models: LoadedModel[];
  routeEndpoints?: RouteEndpoint[];
  geographicPlacements?: GeographicPlacement[];
  measureMode?: boolean;
  onPick?: (point: TerrainPoint, metadata: TerrainMetadata) => void;
  profile?: SurfaceProfile | null;
  mapMode?: '3d' | '2d';
  theme?: 'light' | 'dark';
  onUnavailable?: () => void;
  gisRecords?: GeometryRecord[];
  gisSelectedId?: string | null;
  onGisSelect?: (id: string) => void;
  /** Route flyover: what to fly, and where its playback state goes. */
  flyover?: FlyoverInput | null;
  onFlyoverState?: (state: FlyoverState) => void;
};

type Props = TerrainViewerProps;

type ModelEntry = { model: LoadedModel; root: THREE.Object3D; group: THREE.Group; meshes: THREE.Mesh[] };

function configureRoot(root: THREE.Object3D, model: LoadedModel): void {
  if (root.userData.terrainViewerConfigured) return;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material?.isMeshStandardMaterial) {
      material.roughness = 0.92;
      material.metalness = 0;
    }
  });
  if (model.metadata) applyElevationColorRamp(root, model.metadata);
  root.userData.terrainViewerConfigured = true;
}

function sampleModel(model: LoadedModel, localPoint: THREE.Vector3): { projected: { x: number; y: number }; elevation: number; row: number; column: number; interpolated: boolean } | null {
  if (!model.metadata) return null;
  const converted = sceneToProjected(model.metadata, localPoint);
  const pixel = projectedToPixel(model.metadata, converted.projected.x, converted.projected.y);
  const sampled = model.grid
    ? bilinearElevation(model.grid, model.metadata, converted.projected.x, converted.projected.y)
    : { elevation: undefined, row: Math.round(pixel.row), column: Math.round(pixel.column), interpolated: false };
  return { projected: converted.projected, elevation: sampled.elevation ?? converted.elevation, row: sampled.row, column: sampled.column, interpolated: sampled.interpolated };
}

export function TerrainViewer({
  models, surfaceLayers, terrainOverlays, onTerrainOverlayStatus, analysisImagery,
  geographicPlacements,
  measureMode = false,
  onPick,
  focusPoint,
  profile = null,
  profileMetadata,
  mapMode = '3d',
  theme = 'light',
  locale = 'vi',
  onBasemapState,
  onUnavailable,
  scenarioProps,
  onSelectOverlayHit,
  pointPickActive, onPointPick, routeSimulation,
  viewControlRef,
  onViewReady, onOrbitChange,
  gisRecords, gisSelectedId, onGisSelect, flyover, onFlyoverState, routeEndpoints, contextGeometry, selectedContextAreaId, onSelectContextArea
}: Props): JSX.Element {
  const simulationRef=useRef(routeSimulation);simulationRef.current=routeSimulation;
  const endpointsRef=useRef(routeEndpoints);endpointsRef.current=routeEndpoints;
  const contextRef = useRef({geometry:contextGeometry,selectedId:selectedContextAreaId,onSelect:onSelectContextArea});
  contextRef.current={geometry:contextGeometry,selectedId:selectedContextAreaId,onSelect:onSelectContextArea};
  const flyoverRef = useRef<FlyoverController | null>(null);
  const flyoverInputRef = useRef(flyover); flyoverInputRef.current = flyover;
  const flyoverStateRef = useRef(onFlyoverState); flyoverStateRef.current = onFlyoverState;
  const surfaceLayersRef = useRef(surfaceLayers); surfaceLayersRef.current = surfaceLayers;
  const overlaysRef = useRef<ReturnType<typeof createTerrainOverlays> | null>(null);
  const { order: drawingOrder } = useMapLayerOrder();
  const drawingOrderRef = useRef(drawingOrder); drawingOrderRef.current = drawingOrder;
  const { fillOpacity } = useLandslideAppearance();
  const fillOpacityRef = useRef(fillOpacity); fillOpacityRef.current = fillOpacity;
  const [imageryState,setImageryState]=useState<ImageryLoadState>('off');
  const analysisRef = useRef<ReturnType<typeof createAnalysisDrape> | null>(null);
  const analysisPropsRef = useRef(analysisImagery); analysisPropsRef.current = analysisImagery;
  const overlayPropsRef = useRef({ terrainOverlays, onTerrainOverlayStatus });
  overlayPropsRef.current = { terrainOverlays, onTerrainOverlayStatus };
  const hostRef = useRef<HTMLDivElement>(null);
  const measureModeRef = useRef(measureMode);
  const pointPickRef = useRef({active: pointPickActive, onPick: onPointPick});
  pointPickRef.current = {active: pointPickActive, onPick: onPointPick};
  const onPickRef = useRef(onPick);
  const focusPointRef = useRef(focusPoint);
  const profileRef = useRef(profile);
  const mapModeRef = useRef(mapMode);
  const onSelectOverlayHitRef = useRef(onSelectOverlayHit);
  const scenarioPropsRef = useRef(scenarioProps);
  const themeRef = useRef(theme);
  const localeRef = useRef(locale);
  const profileMetadataRef = useRef(profileMetadata);
  const onBasemapStateRef = useRef(onBasemapState);
  const orbitChangeRef = useRef(onOrbitChange); orbitChangeRef.current = onOrbitChange;
  const onViewReadyRef = useRef(onViewReady);
  const mappedAreasRef = useRef({records:gisRecords,selectedId:gisSelectedId,onSelect:onGisSelect});
  const propsUnavailableRef = useRef(onUnavailable);
  const runtimeRef = useRef<{ updateScenario: () => void; setMode: (mode: '2d' | '3d') => void; updateSurface: () => void; updateSimulation: () => void; invalidate: () => void } | null>(null);

  measureModeRef.current = measureMode;
  onPickRef.current = onPick;
  focusPointRef.current = focusPoint;
  profileRef.current = profile;
  mapModeRef.current = mapMode;
  onSelectOverlayHitRef.current = onSelectOverlayHit;
  scenarioPropsRef.current = scenarioProps;
  themeRef.current = theme;
  localeRef.current = locale;
  profileMetadataRef.current = profileMetadata;
  onBasemapStateRef.current = onBasemapState;
  onViewReadyRef.current = onViewReady;
  mappedAreasRef.current = {records:gisRecords,selectedId:gisSelectedId,onSelect:onGisSelect};
  propsUnavailableRef.current = onUnavailable;

  // Controls remove document listeners through canvas.getRootNode(). Tear them
  // down before React detaches the host, while that root is still the document.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let invalidate = () => {};
    let balanceBasemapMaterials=()=>{};
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeRef.current === 'dark' ? '#151c1a' : '#e6e8df');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1_000_000);
    camera.aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer:true, powerPreference: 'high-performance' });
    } catch (error) {
      if (!propsUnavailableRef.current) throw error;
      propsUnavailableRef.current();
      return undefined;
    }
    const onContextLost = (event: Event): void => { event.preventDefault(); propsUnavailableRef.current?.(); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.className = 'terrain-canvas';
    host.appendChild(renderer.domElement);
    const mapReference = createMapReference(host);

    const controls = new ThreeMapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.18;
    controls.panSpeed = 1;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.85;
    controls.autoRotateSpeed = .4;
    const stopOrbit = () => {if (controls.autoRotate) {controls.autoRotate = false;orbitChangeRef.current?.(false);}};
    controls.target.set(0, 0, 0);
    let markerLayoutDirty = true;
    let scheduleLocalImagery = () => {};
    let scheduleViewImagery = () => {};
    const onControlsChange = (): void => {
      markerLayoutDirty = true;
      invalidate();
      scheduleViewImagery();
      host.parentElement?.style.setProperty('--map-bearing', `${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle())}deg`);
    };
    controls.addEventListener('change', onControlsChange);

    // Lambert diffuse divides irradiance by PI; preserve imagery brightness at unit illumination.
    const ambient = new THREE.AmbientLight('#ffffff', Math.PI * .54);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffffff', Math.PI * .60);
    sun.position.set(-1, 1.1, .65);
    scene.add(sun);

    const entries: ModelEntry[] = models.map((model, index) => {
      const root = model.gltf.scene;
      const group = new THREE.Group();
      group.name = `terrain-model-${model.id}`;
      const placement = geographicPlacements?.[index];
      if (placement) {
        group.position.set(placement.position.x, placement.position.y, placement.position.z);
        group.scale.set(1, placement.scaleY, 1);
      }
      configureRoot(root, model);
      group.add(root);
      scene.add(group);
      const meshes = buildBvh(root);
      model.bvhDisposed = false;
      return { model, root, group, meshes };
    });
    scene.updateMatrixWorld(true);
    const primary = entries[0];
    const located = entries.filter(entry => entry.model.metadata);
    const frame = primary?.model.metadata ? basemapFrame(geographicPlacements ? located.map(entry => entry.model.metadata!) : [primary.model.metadata]) : null;
    const planned = frame ? planBasemapTiles(frame, imagerySource.maxNativeZoom) : undefined;
    const terrainImageries = located.filter(entry => !entry.model.tilePyramid).map(entry => createTerrainImagery(entry.model.metadata!, entry.group, entry.meshes, imagerySource.maxNativeZoom, Math.min(16, renderer.capabilities.getMaxAnisotropy()), planned));
    let refreshReferenceRelief = () => {};
    let lastReferenceRelief: string|undefined;
    // Online relief beyond the DEMs arrives later; a flyover waits for it (bounded).
    let settleRelief = () => {};
    // The context loader can run for 20 seconds. Do not start a camera track
    // at 12 seconds and let a late relief rebuild change the mountains mid-shot.
    const reliefSettled = new Promise<void>(resolve => {
      const timeout=setTimeout(resolve,25000);
      settleRelief=()=>{clearTimeout(timeout);resolve();};
    });
    const basemap = frame && primary
      ? createRegionalBasemap(frame, primary.group.matrixWorld, state => { if(state.relief!==lastReferenceRelief){lastReferenceRelief=state.relief;if(state.relief==='ready'||state.relief==='partial')refreshReferenceRelief();}if(state.relief!=='loading'&&state.status!=='loading')settleRelief(); onBasemapStateRef.current?.(state); balanceBasemapMaterials(); invalidate(); if(state.status!=='loading')scheduleViewImagery(); }, Math.min(16, renderer.capabilities.getMaxAnisotropy()), (tile, bitmap) => { terrainImageries.forEach(imagery => imagery?.tile(tile, bitmap)); invalidate(); }, (geographicPlacements ? located : [primary]).flatMap(entry => entry.model.metadata && entry.model.grid ? [{metadata:entry.model.metadata,grid:entry.model.grid}] : []))
      : null;
    if (basemap) scene.add(basemap.group); else settleRelief();
    const viewImagery = frame && primary ? createViewImagery(() => {
      const context = (basemap?.group.children ?? []).filter((child): child is THREE.Mesh => (child as THREE.Mesh).isMesh);
      const points = visibleImageryPoints(frame,primary.group.matrixWorld,camera,[...located.flatMap(entry=>entry.meshes),...context], Math.max(5000,camera.position.distanceTo(controls.target)*2.5));
      return viewImageryTiles(frame,points,detailMaxZoom(),window.matchMedia('(pointer: coarse)').matches?64:256,Math.min(window.matchMedia('(pointer: coarse)').matches?8:32,Math.floor(renderer.capabilities.maxTextureSize/256)));
    }, Math.min(16,renderer.capabilities.getMaxAnisotropy()), atlas => {
      terrainImageries.forEach(imagery=>imagery?.setDetail(atlas));basemap?.setDetail(atlas);
    },()=>invalidate(),atlas=>{terrainImageries.forEach(imagery=>imagery?.setBase(atlas));basemap?.setBase(atlas);},atlas=>{
      // Decode/upload every stop image and build its clipped mesh while loading,
      // instead of blocking a moving camera at a detail-page boundary.
      if(atlas)renderer.initTexture(atlas.texture);
      terrainImageries.forEach(imagery=>{const texture=imagery?.primeDetail(atlas);if(texture)renderer.initTexture(texture);});
    }) : null;
    if(viewImagery)host.append(viewImagery.status);
    // A flyover keeps the imagery it started with: a moving camera would only abort tile requests.
    scheduleViewImagery=()=>{if(flyoverActive)return;viewImagery?.schedule();scheduleLocalImagery();};


    // Use the same neutral illumination for prepared imagery, online draping and context.
    const sourceMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    entries.forEach(entry => entry.meshes.forEach(mesh => {
      sourceMaterials.set(mesh, mesh.material);
      const convert = (source: THREE.Material): THREE.MeshLambertMaterial => {
        const surface = source as THREE.MeshStandardMaterial;
        const material=new THREE.MeshLambertMaterial({ map: surface.map ?? null, color: surface.color ?? '#ffffff',
          vertexColors: surface.vertexColors, side: source.side, transparent: source.transparent,
          opacity: source.opacity, alphaTest: source.alphaTest });
        material.userData.preparedBasemap=entry.model.metadata?.asset_id===preparedToneAssetId;
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    }));
    balanceBasemapMaterials=()=>{
      const active=analysisPropsRef.current?.balanceBasemap && surfaceLayersRef.current?.imagery!==false;
      const online=active&&!imagerySource.custom?contextBasemapTone():null;
      terrainImageries.forEach(imagery=>imagery?.setTone(online));
      basemap?.setTone(online);
      // Uploaded imagery is independent. Only the calibrated prepared asset
      // receives this profile; factory-owned online materials handle their own lifecycle.
      for(const entry of entries)for(const mesh of entry.meshes){
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          if(material.userData.preparedBasemap)setBasemapTone(material,active?basemapTones.prepared:null);
        }
      }
    };
    balanceBasemapMaterials();
    type SurfaceMaterial = THREE.MeshLambertMaterial;
    const originalMaterials = new Map<SurfaceMaterial, { map: THREE.Texture | null; color: THREE.Color; vertexColors: boolean }>();
    const textureAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    entries.forEach(entry => entry.meshes.forEach(mesh => {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
        const surface = material as SurfaceMaterial;
        if (surface.color && 'map' in surface && !originalMaterials.has(surface)) {
          if (surface.map && surface.map.anisotropy !== textureAnisotropy) {
            surface.map.anisotropy = textureAnisotropy; surface.map.needsUpdate = true;
          }
          originalMaterials.set(surface, { map: surface.map, color: surface.color.clone(), vertexColors: surface.vertexColors });
        }
      });
    }));
    const localImagery = createLocalTileImagery(entries, camera, renderer.capabilities.maxTextureSize, () => invalidate());
    const analysisDrape = createAnalysisDrape(entries, renderer.capabilities.maxTextureSize, () => invalidate(), Math.min(16, renderer.capabilities.getMaxAnisotropy()), setImageryState);
    analysisRef.current = analysisDrape;
    analysisDrape.set(analysisPropsRef.current?.rasters ?? [], analysisPropsRef.current?.opacity ?? 1);
    scheduleLocalImagery = localImagery.schedule;
    const updateSurface = (): void => {
      const layers = surfaceLayersRef.current ?? scenarioPropsRef.current?.layers;
      localImagery.setEnabled(layers?.imagery !== false);
      basemap?.setOptions(layers?.context !== false, layers?.imagery === false ? 'terrain' : 'satellite');
      terrainImageries.forEach(imagery => imagery?.setVisible(layers?.context !== false && layers?.imagery !== false));
      viewImagery?.setEnabled(layers?.context !== false && layers?.imagery !== false);
      if (!basemap) onBasemapStateRef.current?.({ status: layers?.context === false || !models.length ? 'off' : 'unavailable', style: layers?.imagery === false ? 'terrain' : 'satellite', loaded: 0, total: 0 });
      scene.background = new THREE.Color(themeRef.current === 'dark' ? '#151c1a' : '#e6e8df');
      originalMaterials.forEach((original, material) => {
        const imagery = layers?.imagery !== false;
        const nextMap = imagery ? original.map : null;
        if (material.map !== nextMap) { material.map = nextMap; material.needsUpdate = true; }
        material.color.copy(imagery ? original.color : new THREE.Color(themeRef.current === 'dark' ? '#354a50' : '#c8d5c4'));
        if (material.vertexColors !== (imagery && original.vertexColors)) { material.vertexColors = imagery && original.vertexColors; material.needsUpdate = true; }
      });
      balanceBasemapMaterials();
      ambient.intensity = Math.PI * (layers?.hillshade === false ? 1 : .54);
      sun.intensity = Math.PI * (layers?.hillshade === false ? 0 : .60);
      invalidate();
    };
    updateSurface();
    const optionalOverlays = createTerrainOverlays(host, entries, () => { markerLayoutDirty = true; invalidate(); }, (kind, message) => overlayPropsRef.current.onTerrainOverlayStatus?.(kind, message));
    overlaysRef.current = optionalOverlays;
    if (overlayPropsRef.current.terrainOverlays) optionalOverlays.setOptions(overlayPropsRef.current.terrainOverlays);

    const overlay = new THREE.Group();
    overlay.name = 'profile-overlay';
    scene.add(overlay);

    let scenarioOverlayGroup: THREE.Group | null = null;
    // While a flyover plays it owns the camera; status-coloured roads would compete with its trail.
    let flyoverActive = false;
    let residentMarker:ReturnType<typeof createSimulatedResident>|null=null;
    const updateSimulation=()=>{
      residentMarker?.dispose();residentMarker=null;
      if(simulationRef.current)residentMarker=createSimulatedResident(host,simulationRef.current,localeRef.current,projectedWorld,camera);
    };
    let endpointLayer:ReturnType<typeof createRouteEndpoints>|null=null;
    let contextLayer:ReturnType<typeof createContextAreaOverlay>|null=null;
    let mappedAreaGroup: THREE.Group | null = null;
    let referencePoints:ReturnType<typeof terrainReferencePoints>|null=null;
    let mappedLabel: ReturnType<typeof terrainAreaLabel> = null;
    let scenarioMarkers: ReturnType<typeof createScenarioMarkers> | null = null;
    const rebuildScenarioOverlays = (): void => {
      const focused = document.activeElement as HTMLElement | null;
      const focusId = focused?.closest('.map-marker-layer')?.parentElement === host ? focused.dataset.mapObject : undefined;
      scenarioMarkers?.dispose();
      scenarioMarkers = null;
      updateSurface();
      if (scenarioOverlayGroup) {
        scene.remove(scenarioOverlayGroup);
        scenarioOverlayGroup.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
            else mesh.material?.dispose();
          }
        });
        scenarioOverlayGroup = null;
      }

      const sp = scenarioPropsRef.current;
      const primaryModel = entries[0]?.model;
      referencePoints?.dispose();referencePoints=null;
      disposeTerrainAreas(mappedAreaGroup); mappedAreaGroup = null;
      mappedLabel?.dispose();mappedLabel = null;
      if (mappedAreasRef.current.records) {
        mappedAreaGroup = new THREE.Group();
        const chosen = mappedAreasRef.current.records.find(record => record.id === mappedAreasRef.current.selectedId);
        referencePoints = terrainReferencePoints(host,mappedAreasRef.current.records,mappedAreasRef.current.selectedId??null,entries,id=>mappedAreasRef.current.onSelect?.(id),(x,y)=>basemap?.surfacePoint(x,y),()=>!measureModeRef.current);
        for (const entry of entries) {
          if (!entry.model.metadata || !entry.model.grid) continue;
          const group = terrainLandslideAreas(mappedAreasRef.current.records, entry.model.metadata, entry.model.grid, sp?.roads ?? [], mappedAreasRef.current.selectedId ?? null, {width:host.clientWidth,height:host.clientHeight}, sp?.datasetVersion, fillOpacityRef.current);
          group.matrix.copy(entry.group.matrixWorld); group.matrixAutoUpdate = false; mappedAreaGroup.add(group);
          if (chosen && !mappedLabel) mappedLabel = terrainAreaLabel(host,chosen,entry.model.metadata,entry.model.grid,entry.group.matrixWorld,localeRef.current);
        }
        mappedAreaGroup.add(terrainReferenceRoads(mappedAreasRef.current.records,entries,mappedAreasRef.current.selectedId??null,{width:host.clientWidth,height:host.clientHeight},(x,y)=>basemap?.surfacePoint(x,y)));
        scene.add(mappedAreaGroup);
      }
      if (sp && primaryModel?.metadata && primaryModel?.grid) {
        // Scenario objects may sit on context terrain: sample it and express the height in the primary frame.
        const primaryMetadata = primaryModel.metadata, primaryInverse = entries[0].group.matrixWorld.clone().invert();
        const elevationAt = (x: number, y: number): number | undefined => {
          for (const entry of entries) {
            if (!entry.model.metadata || !entry.model.grid) continue;
            const elevation = terrainSurfaceElevation(entry.model.grid, entry.model.metadata, x, y);
            if (elevation === undefined) continue;
            if (entry === entries[0]) return elevation;
            const p = projectedToScene(entry.model.metadata, { x, y }, elevation);
            const local = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(entry.group.matrixWorld).applyMatrix4(primaryInverse);
            return sceneToProjected(primaryMetadata, local).elevation;
          }
          return undefined;
        };
        scenarioOverlayGroup = buildScenarioOverlays({
          surfaceFrames: entries.flatMap(entry=>entry.model.metadata ? [entry.model.metadata] : []),
          elevationAt,
          metadata: primaryModel.metadata,
          grid: primaryModel.grid,
          communities: sp.communities,
          hazards: sp.hazards,
          roads: sp.roads,
          contextRoads:sp.contextRoads,
          aoi: sp.aoi,
          selectedRoute: flyoverActive && flyoverInputRef.current?.retainContext ? null : sp.selectedRoute,
          selectedCommunityId: sp.selectedCommunityId,
          selectedObjectId: sp.selectedObjectId,
          layers: sp.layers,
          appearance: sp.appearance,
          screenMarkers: true,
          resolution: { width: host.clientWidth, height: host.clientHeight }
        });
        scenarioOverlayGroup.position.copy(entries[0].group.position);
        scenarioOverlayGroup.scale.copy(entries[0].group.scale);
        scenarioOverlayGroup.visible = !flyoverActive || Boolean(flyoverInputRef.current?.retainContext);
        scene.add(scenarioOverlayGroup);
        scenarioMarkers = createScenarioMarkers(host, {
          ...sp, focusId, elevationAt, metadata: primaryModel.metadata, grid: primaryModel.grid,
          interactive: !measureModeRef.current,
          transform: entries[0].group.matrixWorld, locale: localeRef.current,
          canExpandGroup: () => camera.position.distanceTo(controls.target) > controls.minDistance * 1.15,
          onExpandGroup: points => viewControlRef?.current?.frameProjected?.(points),
          onPreviewFocus:point=>viewControlRef?.current?.focusProjected(point,detailInset(host)),
          onSelect: hit => onSelectOverlayHitRef.current?.(hit)
        });
      }
      endpointLayer?.dispose();endpointLayer=null;
      if(endpointsRef.current?.length && entries.length){endpointLayer=createRouteEndpoints(host,endpointsRef.current,projectedWorld,{width:host.clientWidth,height:host.clientHeight});scene.add(endpointLayer.group);}
      contextLayer?.dispose();contextLayer=null;
      const context=contextRef.current;
      if(context.geometry && entries.length){
        contextLayer=createContextAreaOverlay(host,context.geometry,context.selectedId??null,projectedWorld,localeRef.current,()=>!measureModeRef.current&&!flyoverActive,{width:host.clientWidth,height:host.clientHeight});
        contextLayer.group.visible=!flyoverActive||Boolean(flyoverInputRef.current?.context);
        scene.add(contextLayer.group);
      }
      for (const group of [scenarioOverlayGroup, mappedAreaGroup, contextLayer?.group]) if (group) applyDrawingOrder(group, drawingOrderRef.current);
      markerLayoutDirty = true;
      invalidate();
    };
    rebuildScenarioOverlays();

    const focusMarker = document.createElement('div');
    focusMarker.className = 'map-profile-point';
    focusMarker.setAttribute('role', 'img');
    focusMarker.hidden = true;
    host.appendChild(focusMarker);
    const focusPosition = new THREE.Vector3();

    const bounds = new THREE.Box3();
    entries.forEach((entry) => bounds.expandByObject(entry.group));
    // Frame the incident rather than the entire rectangular DEM and its surrounding tiles.
    const incidentBounds = new THREE.Box3();
    const initialScenario = scenarioPropsRef.current;
    if (primary?.model.metadata && primary.model.grid && initialScenario) {
      const metadata = primary.model.metadata;
      for (const point of responseOverviewPoints(initialScenario, mappedAreasRef.current.records ?? [], metadata)) {
        for (const entry of entries) {
          if (!entry.model.metadata || !entry.model.grid) continue;
          const elevation = bilinearElevation(entry.model.grid, entry.model.metadata, point.x, point.y).elevation;
          if (elevation === undefined) continue;
          const p = projectedToScene(entry.model.metadata, point, elevation);
          incidentBounds.expandByPoint(entry.group.localToWorld(new THREE.Vector3(p.x, p.y, p.z)));
          break;
        }
      }
    }
    if (!incidentBounds.isEmpty()) bounds.copy(incidentBounds.expandByScalar(Math.max(incidentBounds.getSize(new THREE.Vector3()).length() * .035, 1)));
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(1, 1, 1) : bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);

    type CameraTransition = {
      fromPosition: THREE.Vector3; fromTarget: THREE.Vector3;
      toPosition: THREE.Vector3; toTarget: THREE.Vector3;
      startedAt: number; duration: number; mode: '3d' | '2d';
    };
    let cameraTransition: CameraTransition | null = null;
    const applyModeConstraints = (mode: '3d' | '2d'): void => {
      controls.minPolarAngle = mode === '2d' ? 0 : 0.12;
      controls.maxPolarAngle = mode === '2d' ? 0.05 : Math.PI / 2.35;
      controls.enableRotate = mode === '3d';
    };
    const setInitialCamera = (mode: '3d' | '2d', smooth = false): void => {
      stopOrbit();
      const direction = mode === '2d' ? new THREE.Vector3(0, 1, .0001).normalize() : new THREE.Vector3(.6, .85, .65).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const tanH = tanV * camera.aspect;
      let distance = 1;
      for (const x of [-size.x / 2, size.x / 2]) for (const y of [-size.y / 2, size.y / 2]) for (const z of [-size.z / 2, size.z / 2]) {
        const corner = new THREE.Vector3(x, y, z);
        distance = Math.max(distance, corner.dot(direction) + Math.max(Math.abs(corner.dot(right)) / tanH, Math.abs(corner.dot(up)) / tanV));
      }
      distance *= 1.12;
      const nextPosition = center.clone().addScaledVector(direction, distance);
      controls.cursor.copy(center);
      controls.maxTargetRadius = Math.max(Math.hypot(size.x, size.z) * 0.75, 1);
      camera.near = Math.max(distance / 10_000, 0.01);
      camera.far = Math.max(distance * 25, 1000);
      controls.minDistance = Math.max(maxDimension * .008, size.y * .12);
      controls.maxDistance = Math.max(distance * 2.2, maxDimension * 2.5);
      camera.updateProjectionMatrix();
      if (smooth && !reducedMotion.matches && camera.position.distanceTo(nextPosition) > 1) {
        // Clear residual damping before interpolating, otherwise the old drag
        // continues to move the camera during a mode change.
        controls.enableDamping = false;
        controls.update();
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2.35;
        controls.enableRotate = true;
        cameraTransition = {
          fromPosition: camera.position.clone(), fromTarget: controls.target.clone(),
          toPosition: nextPosition, toTarget: center.clone(),
          startedAt: performance.now(), duration: 540, mode
        };
      } else {
        cameraTransition = null;
        camera.position.copy(nextPosition);
        controls.target.copy(center);
        applyModeConstraints(mode);
        controls.enableDamping = true;
        controls.update();
      }
      markerLayoutDirty = true;
      invalidate();
    };
    setInitialCamera(mapModeRef.current);
    const interruptCameraTransition = (): void => {
      stopOrbit();
      if (!cameraTransition) return;
      const mode = cameraTransition.mode;
      cameraTransition = null;
      applyModeConstraints(mode);
      controls.enableDamping = true;
      controls.enabled = !measureModeRef.current;
      controls.update();
      markerLayoutDirty = true;
    };
    refreshReferenceRelief = () => {rebuildScenarioOverlays();invalidate();onViewReady?.();};
    runtimeRef.current = { updateScenario: rebuildScenarioOverlays, setMode: mode => setInitialCamera(mode, true), updateSurface, updateSimulation, invalidate: () => invalidate() };
    updateSimulation();

    const moveCamera = (position: THREE.Vector3, target: THREE.Vector3, duration = 480) => {
      interruptCameraTransition();
      if (reducedMotion.matches) {
        camera.position.copy(position);controls.target.copy(target);controls.update();
      } else {
        controls.enableDamping = false;controls.update();
        cameraTransition = {fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),toPosition:position,toTarget:target,startedAt:performance.now(),duration,mode:mapModeRef.current};
      }
      markerLayoutDirty = true;invalidate();
    };
    function projectedWorld(point: {x:number;y:number}) {
      for (const entry of entries) {
        if (!entry.model.metadata || !entry.model.grid) continue;
        const elevation = bilinearElevation(entry.model.grid, entry.model.metadata, point.x, point.y).elevation;
        if (elevation === undefined) continue;
        const p = projectedToScene(entry.model.metadata, point, elevation);
        return entry.group.localToWorld(new THREE.Vector3(p.x,p.y,p.z));
      }
      return basemap?.surfacePoint(point.x,point.y) ?? null;
    };
    const viewApi: ViewControls = {
        setOrbit: enabled => {
          interruptCameraTransition();
          controls.autoRotate = enabled && !reducedMotion.matches && !measureModeRef.current;
          orbitChangeRef.current?.(controls.autoRotate); invalidate();
        },
        zoomIn: () => {
          interruptCameraTransition();
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(0.8);
          const position = controls.target.clone().add(offset);
          moveCamera(position,controls.target.clone(),260);
        },
        zoomOut: () => {
          interruptCameraTransition();
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(1.25);
          const position = controls.target.clone().add(offset);
          moveCamera(position,controls.target.clone(),260);
        },
        resetView: () => {
          setInitialCamera(mapModeRef.current, true);
        },
        retryBasemap: () => {basemap?.retry();viewImagery?.retry();},
        focusProjected: (point, inset) => {
          const target = projectedWorld(point);if (!target) return;
          const nearby = [{x:point.x-250,y:point.y-250},point,{x:point.x+250,y:point.y+250}]
            .map(projectedWorld).filter((item): item is THREE.Vector3 => item !== null);
          const framed = nearby.length > 1 ? frameCameraPoints(camera,controls.target,nearby,{width:host.clientWidth,height:host.clientHeight,right:inset?.right ?? 0,minDistance:controls.minDistance,maxDistance:controls.maxDistance}) : null;
          if (framed) { moveCamera(framed.position,framed.target); return; }
          const position = camera.position.clone().add(target.clone().sub(controls.target));
          const pose = cameraPoseBesideDock(camera,position,target,inset?.right ?? 0,host.clientWidth);
          moveCamera(pose.position,pose.target);
        },
        frameProjected: (points, inset) => {
          const worldPoints = points.map(projectedWorld).filter((point): point is THREE.Vector3 => point !== null);
          const pose = frameCameraPoints(camera,controls.target,worldPoints,{width:host.clientWidth,height:host.clientHeight,right:inset?.right ?? 0,bottom:inset?.bottom ?? 0,minDistance:controls.minDistance,maxDistance:controls.maxDistance});
          if (pose) moveCamera(pose.position,pose.target,560);
        }
    };
    if (viewControlRef) viewControlRef.current = viewApi;

    const groundAt = (x: number, z: number): number | undefined => {
      for (const entry of entries) {
        const { metadata, grid } = entry.model;
        if (!metadata || !grid) continue;
        const local = entry.group.worldToLocal(new THREE.Vector3(x, 0, z));
        const { projected } = sceneToProjected(metadata, local);
        const elevation = terrainSurfaceElevation(grid, metadata, projected.x, projected.y);
        if (elevation === undefined) continue;
        const p = projectedToScene(metadata, projected, elevation);
        return entry.group.localToWorld(new THREE.Vector3(p.x, p.y, p.z)).y;
      }
      if (!basemap || !primary?.model.metadata) return undefined;
      const { projected } = sceneToProjected(primary.model.metadata, primary.group.worldToLocal(new THREE.Vector3(x, 0, z)));
      return basemap.surfacePoint(projected.x, projected.y)?.y;
    };
    const flyoverController = createFlyoverController({
      host, renderer, scene, camera, terrainMeshes: entries.flatMap(entry => entry.meshes),
      surfaceWorld: projectedWorld, groundAt,
      setDrape: image => { if (image) analysisDrape.setCanvas(image.canvas, image.bounds, .24, image.opacity); else void analysisDrape.set(analysisPropsRef.current?.rasters ?? [], analysisPropsRef.current?.opacity ?? 1); },
      ready: async () => {
        // Use the same regional source on both sides of the Planet footprint.
        // Preparing the route window avoids freezing the low-detail launch view.
        const route=flyoverInputRef.current?.route;
        if(frame && route?.length && surfaceLayersRef.current?.context!==false) {
          const points=route.flatMap(p=>[{x:p.x-2200,y:p.y-2200},{x:p.x+2200,y:p.y+2200}]);
          const axis=Math.min(32,Math.floor(renderer.capabilities.maxTextureSize/256));
          const focus=[route[0],...(flyoverInputRef.current?.stops.map(stop=>stop.projected)??[]),route.at(-1)!];
          const pageAxis=window.matchMedia('(pointer: coarse)').matches?Math.min(8,axis):Math.min(12,axis);
          const windows=focus.map(p=>viewImageryTiles(frame,[{x:p.x-1200,y:p.y-1200},{x:p.x+1200,y:p.y+1200}],imagerySource.maxNativeZoom,pageAxis*pageAxis,pageAxis));
          await Promise.all([reliefSettled,viewImagery?.prepare(viewImageryTiles(frame,points,imagerySource.maxNativeZoom,384,axis),windows)]);
        } else await reliefSettled;
      },
      cancelPreparation:()=>viewImagery?.release(),
      onFrame: (target,areaId)=>{
        contextLayer?.setActiveArea(areaId??null);
        if(primary?.model.metadata) {
          const point=sceneToProjected(primary.model.metadata,primary.group.worldToLocal(target.clone())).projected;
          viewImagery?.filmAt(point,primary.model.metadata);
        }
      },
      onResolution: (width,height) => {
        contextLayer?.resolution(width,height);endpointLayer?.resolution(width,height);
        mappedAreaGroup?.traverse(object => {const material=(object as THREE.Mesh).material as THREE.Material & {resolution?:THREE.Vector2};material?.resolution?.set(width,height);});
      },
      maxTextureSize: renderer.capabilities.maxTextureSize,
      enter: () => {
        interruptCameraTransition(); stopOrbit();
        flyoverActive = true; controls.enabled = false;
        if(contextLayer)contextLayer.group.visible=Boolean(flyoverInputRef.current?.context);
        if(flyoverInputRef.current?.retainContext){
          rebuildScenarioOverlays();
          scenarioOverlayGroup?.traverse(object=>{const id=object.userData.id;if(scenarioPropsRef.current?.roads.some(road=>(road.sourceRoadId??road.id)===id && road.status==='blocked'))object.renderOrder=60;});
        }else if (scenarioOverlayGroup) scenarioOverlayGroup.visible = false;
        host.classList.add('flyover-active'); host.closest('.map-area')?.classList.add('flyover-active');
      },
      leave: target => {
        flyoverActive = false;
        rebuildScenarioOverlays();
        host.classList.remove('flyover-active'); host.closest('.map-area')?.classList.remove('flyover-active');
        controls.target.copy(target); controls.enabled = !measureModeRef.current; controls.update();
        markerLayoutDirty = true; viewImagery?.release(); scheduleViewImagery(); invalidate();
      },
      render: () => optionalOverlays.render(() => renderer.render(scene, camera)),
      invalidate: () => invalidate(),
      restoreViewport: () => resize(),
      locale: () => localeRef.current === 'en' ? 'en' : 'vi',
      onState: state => flyoverStateRef.current?.(state)
    });
    flyoverController.setInput(flyoverInputRef.current ?? null);
    flyoverRef.current = flyoverController;
    // The placeholder viewer can mount before its GLBs/grids arrive. Do not let
    // Play/Export capture that soon-to-be-disposed, empty renderer.
    if (viewControlRef?.current && entries.some(entry => entry.model.metadata && entry.model.grid && entry.meshes.length)) {
      viewControlRef.current.flyover = flyoverController.controls;
    }

    const meshEntries = new Map<THREE.Object3D, ModelEntry>();
    entries.forEach((entry) => entry.meshes.forEach((mesh) => meshEntries.set(mesh, entry)));

    const raycaster = new THREE.Raycaster();
    // Line2 uses screen pixels for this extra selection width.
    raycaster.params.Line2 = { threshold: window.matchMedia('(pointer: coarse)').matches ? 20 : 12 };
    raycaster.firstHitOnly = true;
    const terrainMeshes = entries.flatMap(entry => entry.meshes);
    const pointer = new THREE.Vector2();
    let renderedProfile: SurfaceProfile | null | undefined;

    const clearOverlay = (): void => {
      while (overlay.children.length) {
        const child = overlay.children[0];
        if (!child) continue;
        overlay.remove(child);
        child.traverse((object) => {
          const line = object as THREE.Line;
          line.geometry?.dispose();
          const material = line.material as THREE.Material | undefined;
          material?.dispose();
        });
      }
    };

    const updateProfileOverlay = (): void => {
      const nextProfile = profileRef.current;
      if (nextProfile !== renderedProfile) {
        clearOverlay();
        renderedProfile = nextProfile;
        // Route geometry already carries road-status colours. A second profile
        // line would cover blocked/uncertain segments with an unqualified blue.
        if (nextProfile && nextProfile.geometry !== 'route') {
          nextProfile.segments.forEach((segment) => {
            const points = segment.map((index) => {
              const sample = nextProfile.samples[index];
              const metadata = profileMetadataRef.current;
              if (!metadata) return new THREE.Vector3();
              const scenePoint = projectedToScene(metadata, sample.projected, sample.elevation!);
              return new THREE.Vector3(scenePoint.x, scenePoint.y + 6, scenePoint.z);
            });
            if (points.length < 2) return;
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: '#60a5fa', linewidth: 3, depthTest: false });
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 9;
            overlay.add(line);
          });
        }
      }
    };

    let lastProfilePoint:typeof focusPoint | undefined;
    const updateFocusMarker = (): void => {
      const point = focusPointRef.current;
      focusMarker.hidden = !point;
      if (!point) {lastProfilePoint=point;return;}
      const changed=lastProfilePoint!==point;lastProfilePoint=point;
      const metadata=profileMetadataRef.current;
      if(!metadata){focusMarker.hidden=true;return;}
      const world=projectedWorld(sceneToProjected(metadata,point).projected);
      if(!world){focusMarker.hidden=true;return;}
      focusPosition.copy(world);focusPosition.y+=12;focusPosition.project(camera);
      const x = (focusPosition.x + 1) * host.clientWidth / 2;
      const y = (1 - focusPosition.y) * host.clientHeight / 2;
      const dock=host.closest('.workspace')?.querySelector<HTMLElement>('#response-details');
      const box=host.getBoundingClientRect(),panel=dock?.getBoundingClientRect();
      const reserve=panel && getComputedStyle(dock!).visibility!=='hidden' && panel.left>=box.left ? Math.max(0,box.right-panel.left) : 0;
      if(changed && !flyoverActive && (focusPosition.z< -1 || focusPosition.z>1 || x<50 || x>host.clientWidth-reserve-50 || y<50 || y>host.clientHeight-50)){
        const position=camera.position.clone().add(world.clone().sub(controls.target));
        const pose=cameraPoseBesideDock(camera,position,world,reserve,host.clientWidth);
        moveCamera(pose.position,pose.target,300);
      }

      focusMarker.hidden = focusPosition.z < -1 || focusPosition.z > 1 || x < 0 || y < 0 || x > host.clientWidth || y > host.clientHeight;
      focusMarker.style.transform = `translate(${x - 5}px,${y - 5}px)`;
      focusMarker.setAttribute('aria-label', localeRef.current === 'vi' ? 'Vị trí đang đọc trên mặt cắt' : 'Current profile position');
    };

    let pointerStart: { x: number; y: number } | null = null;
    let dragged = false;
    let hoverFrame = 0;
    let hoverPosition: { clientX: number; clientY: number } | null = null;
    const setRay = (position: { clientX: number; clientY: number }): void => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((position.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((position.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const visibleIntersection = (objects: THREE.Object3D[]): THREE.Intersection | undefined => {
      const hit = raycaster.intersectObjects(objects, true)[0];
      if (!hit) return undefined;
      const ground = raycaster.intersectObjects(terrainMeshes, false)[0];
      // Match depth-tested layers: a hidden road/area must not intercept a ground click.
      const tolerance = Math.max(1, maxDimension / Math.max(1, host.clientHeight));
      return !ground || hit.distance <= ground.distance + tolerance ? hit : undefined;
    };
    const pickOverlay = (): OverlayHit | null => {
      if (!scenarioOverlayGroup || !onSelectOverlayHitRef.current) return null;
      const hit = visibleIntersection(scenarioOverlayGroup.children);
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object && !object.userData?.type) object = object.parent;
      return object?.userData?.type ? { type: object.userData.type, id: object.userData.id } as OverlayHit : null;
    };
    const pickContextArea = (): string | null => {
      if(!contextLayer||!contextRef.current.onSelect)return null;
      return visibleIntersection(contextLayer.group.children)?.object.userData.contextAreaId??null;
    };
    const pickMappedArea = (): string | null => {
      if (!mappedAreaGroup || !mappedAreasRef.current.onSelect) return null;
      return visibleIntersection(mappedAreaGroup.children)?.object.userData.recordId ?? null;
    };
    const updateCursor = (): void => {
      hoverFrame = 0;
      if (measureModeRef.current || pointPickRef.current.active) { renderer.domElement.style.cursor = 'crosshair'; return; }
      if (pointerStart) { renderer.domElement.style.cursor = 'grabbing'; return; }
      if (hoverPosition) setRay(hoverPosition);
      renderer.domElement.style.cursor = hoverPosition && (pickOverlay() || pickMappedArea() || pickContextArea()) ? 'pointer' : 'grab';
    };
    const scheduleCursor = (): void => { if (!hoverFrame) hoverFrame = requestAnimationFrame(updateCursor); };
    const onPointerDown = (event: PointerEvent): void => {
      interruptCameraTransition();
      pointerStart = { x: event.clientX, y: event.clientY };
      dragged = false;
      renderer.domElement.style.cursor = measureModeRef.current ? 'crosshair' : 'grabbing';
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (pointerStart && event.buttons && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) dragged = true;
      hoverPosition = { clientX: event.clientX, clientY: event.clientY };
      if (event.pointerType !== 'touch') scheduleCursor();
    };
    const onPointerUp = (): void => { pointerStart = null; scheduleCursor(); };
    const onPointerCancel = (): void => { pointerStart = null; dragged = true; hoverPosition = null; scheduleCursor(); };
    const onPointerLeave = (): void => { hoverPosition = null; scheduleCursor(); };
    const onWheel = (): void => interruptCameraTransition();
    // Capture before MapControls handles the gesture, so the first drag or
    // wheel tick immediately takes control from a camera transition.
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('wheel', onWheel, true);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const onClick = (event: MouseEvent): void => {
      if (dragged || flyoverActive) return;
      setRay(event);

      if (pointPickRef.current.active) {
        const hit = raycaster.intersectObjects(terrainMeshes, false)[0];
        const entry = hit ? meshEntries.get(hit.object) : undefined;
        if (!hit || !entry?.model.metadata) return;
        const sample = sampleModel(entry.model, entry.root.worldToLocal(hit.point.clone()));
        if (!sample) return;
        const geographic = projectedToWgs84(entry.model.metadata, sample.projected);
        if (geographic.latitude === undefined || geographic.longitude === undefined) return;
        const road = pickOverlay();
        pointPickRef.current.onPick?.(geographic.latitude, geographic.longitude, road?.type === 'road' ? road.id : undefined);
        return;
      }
      const contextId=!measureModeRef.current&&pickContextArea();
      if(contextId){contextRef.current.onSelect?.(contextId);return;}
      // Check scenario overlays first
      const overlayHit = pickOverlay();
      if (overlayHit && !measureModeRef.current) { onSelectOverlayHitRef.current?.(overlayHit); return; }
      const mappedId = !measureModeRef.current && pickMappedArea();
      if (mappedId) { mappedAreasRef.current.onSelect?.(mappedId); return; }

      // If measure mode is active, pick ground point
      if (measureModeRef.current && onPickRef.current) {
        const hit = raycaster.intersectObjects(terrainMeshes, false)[0];
        const entry = hit ? meshEntries.get(hit.object) : undefined;
        if (!hit || !entry || !entry.model.metadata) return;
        const localPoint = entry.root.worldToLocal(hit.point.clone());
        const sample = sampleModel(entry.model, localPoint);
        if (!sample) return;
        onPickRef.current({ scene: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, projected: sample.projected, elevation: sample.elevation, row: sample.row, column: sample.column, interpolated: sample.interpolated }, entry.model.metadata);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    const resize = (): void => {
      if (flyoverController.exporting) return;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      scenarioOverlayGroup?.traverse(object => {
        const material = (object as THREE.Mesh).material as THREE.Material & { resolution?: THREE.Vector2 };
        material?.resolution?.set(width, height);
      });
      mappedAreaGroup?.traverse(object => { const material=(object as THREE.Mesh).material as THREE.Material & {resolution?:THREE.Vector2}; material?.resolution?.set(width,height); });
      flyoverController.resize(renderer.domElement.width, renderer.domElement.height);
      markerLayoutDirty = true;
      invalidate();
    };
    const resizeObserver = new ResizeObserver(() => {resize();scheduleViewImagery();});
    resizeObserver.observe(host);
    const mapUiObserver = new MutationObserver(() => { markerLayoutDirty = true; invalidate(); });
    const mapArea = host.closest('.map-area');
    const markLayoutDirty = () => { markerLayoutDirty = true; invalidate(); };
    mapArea?.addEventListener('dear:map-layout', markLayoutDirty);
    const workspace = mapArea ?? host.parentElement;
    if (workspace) mapUiObserver.observe(workspace, { childList: true, subtree: true });
    resize();

    let previousFrame = performance.now();
    const loop = renderOnDemand(time => {
      const delta = Math.min(.05, Math.max(0, (time - previousFrame) / 1000)); previousFrame = time;
      // Export renders its own frames; playback drives the camera instead of the controls.
      if (flyoverController.exporting) return false;
      if (flyoverActive) return flyoverController.frame(time);
      if (measureModeRef.current) stopOrbit();
      controls.enabled = !measureModeRef.current && !cameraTransition;
      updateProfileOverlay();
      if (cameraTransition) {
        const transition = cameraTransition;
        const progress = Math.min((time - transition.startedAt) / transition.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
        markerLayoutDirty = true;
        if (progress === 1) {
          cameraTransition = null;
          applyModeConstraints(transition.mode);
          controls.enableDamping = true;
          controls.enabled = !measureModeRef.current;
        }
      }
      const moved = controls.update(delta);
      optionalOverlays.render(() => renderer.render(scene, camera));
      updateFocusMarker();
      if (markerLayoutDirty) {
        mapReference.update(camera, controls.target, controls.getAzimuthalAngle(), mapModeRef.current, localeRef.current, entries[0]?.model.metadata, entries[0]?.group.matrixWorld);
        referencePoints?.update(camera);contextLayer?.update(camera);endpointLayer?.update(camera);residentMarker?.update();
        scenarioMarkers?.update(camera);
        mappedLabel?.update(camera);
        optionalOverlays.updateLabels(camera);
        markerLayoutDirty = false;
      }
      return Boolean(cameraTransition || moved || controls.autoRotate);
    });
    invalidate = loop.invalidate;
    const onVisibility = () => {if (!document.hidden) {markerLayoutDirty = true;invalidate();}};
    document.addEventListener('visibilitychange',onVisibility);
    const onReducedMotion = () => {if (reducedMotion.matches) stopOrbit();if (reducedMotion.matches && cameraTransition) {camera.position.copy(cameraTransition.toPosition);controls.target.copy(cameraTransition.toTarget);interruptCameraTransition();invalidate();}};
    reducedMotion.addEventListener('change',onReducedMotion);
    invalidate();
    onViewReadyRef.current?.();

    return () => {
      flyoverRef.current = null;
      flyoverController.dispose();contextLayer?.dispose();endpointLayer?.dispose();residentMarker?.dispose();
      runtimeRef.current = null;
      overlaysRef.current = null;
      optionalOverlays.dispose();
      localImagery.dispose();
      analysisRef.current = null;
      analysisDrape.dispose();
      stopOrbit();
      loop.dispose();
      document.removeEventListener('visibilitychange',onVisibility);
      reducedMotion.removeEventListener('change',onReducedMotion);
      if (viewControlRef?.current === viewApi) viewControlRef.current = null;
      cancelAnimationFrame(hoverFrame);
      resizeObserver.disconnect();
      mapUiObserver.disconnect();
      mapArea?.removeEventListener('dear:map-layout', markLayoutDirty);
      controls.removeEventListener('change', onControlsChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('wheel', onWheel, true);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      clearOverlay();
      scenarioMarkers?.dispose();
      disposeTerrainAreas(mappedAreaGroup);
      mappedLabel?.dispose();
      referencePoints?.dispose();
      mapReference.dispose();
      viewImagery?.dispose();
      terrainImageries.forEach(imagery => imagery?.dispose());
      settleRelief();basemap?.dispose();
      if (scenarioOverlayGroup) {
        scene.remove(scenarioOverlayGroup);
        scenarioOverlayGroup.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(material => material?.dispose()); });
      }
      originalMaterials.forEach((original, material) => { material.map = original.map; material.color.copy(original.color); material.vertexColors = original.vertexColors; material.needsUpdate = true; });
      sourceMaterials.forEach((source, mesh) => {
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
        mesh.material = source;
      });
      focusMarker.remove();
      entries.forEach((entry) => {
        // A reused model must release this renderer's GPU allocations and dispose
        // listeners too. Three.js can re-upload its retained geometry/texture data.
        disposeObjectResources(entry.root, false);
        if (entry.model.preserveResources) return;
        if (!entry.model.released && !entry.model.bvhDisposed) {
          disposeBvh(entry.root);
          entry.model.bvhDisposed = true;
        }
      });
      controls.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [geographicPlacements, models]);

  useEffect(() => { runtimeRef.current?.updateSimulation(); }, [routeSimulation,locale]);
  useEffect(() => { if (terrainOverlays) overlaysRef.current?.setOptions(terrainOverlays); }, [terrainOverlays]);
  useEffect(() => { runtimeRef.current?.updateSurface(); if (!flyoverRef.current?.active && !flyoverRef.current?.exporting) void analysisRef.current?.set(analysisImagery?.rasters ?? [], analysisImagery?.opacity ?? 1); }, [analysisImagery]);
  useEffect(() => { flyoverRef.current?.setInput(flyover ?? null); }, [flyover]);
  useEffect(() => { runtimeRef.current?.updateScenario(); }, [scenarioProps?.aoi, scenarioProps?.layers, scenarioProps?.appearance, scenarioProps?.communities, scenarioProps?.responseSites, scenarioProps?.hazards, scenarioProps?.roads, scenarioProps?.contextRoads, scenarioProps?.selectedRoute, scenarioProps?.selectedCommunityId, scenarioProps?.selectedObjectId, locale, gisRecords, gisSelectedId, measureMode, fillOpacity, drawingOrder, contextGeometry, selectedContextAreaId, routeEndpoints]);
  useLayoutEffect(() => { runtimeRef.current?.setMode(mapMode); }, [mapMode]);
  useEffect(() => { runtimeRef.current?.updateSurface(); }, [theme, surfaceLayers]);
  useEffect(() => { runtimeRef.current?.invalidate(); }, [focusPoint, profile, measureMode, profileMetadata]);

  return <div ref={hostRef} className="terrain-viewer" aria-label={locale === 'vi' ? `Bản đồ địa hình ${mapMode.toUpperCase()}` : `${mapMode.toUpperCase()} terrain map`}><ImageryStatus state={imageryState} locale={locale} onRetry={()=>void analysisRef.current?.set(analysisPropsRef.current?.rasters ?? [],analysisPropsRef.current?.opacity ?? 1)}/></div>;
}
