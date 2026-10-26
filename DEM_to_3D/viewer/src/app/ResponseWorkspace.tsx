import {areaResponsePriority} from '../features/landslides/responsePriority';
import type { GeometryRecord } from '../geo/vector/types';
import { latestOperationalReports } from '../features/observations/operationalReports';
import { routeProposalOf, useResidentGuidance } from '../features/tracking/residentGuidance';
import { GuidanceDialog } from '../features/tracking/GuidanceDialog';
import { useRescueDispatch } from '../features/tracking/useRescueDispatch';
import { planDispatch, type DispatchTarget } from '../features/tracking/dispatchOrders';
import { MapOverview } from '../features/map/MapOverview';
import {useResidentLocation} from '../features/tracking/useResidentLocation';
import {residentDeviceId,mergeLocationFeeds} from '../features/tracking/residentLocation';
import {ResidentDeviceList,ResidentDeviceDetail} from '../features/tracking/ResidentDevices';
import { useDeviceFeed } from '../features/tracking/useDeviceFeed';
import { useLocalNetwork } from '../features/route-film/networkContext';
import { LocalAreaCard } from '../features/route-film/LocalAreaCard';
import { useResidentPresence } from '../features/presence/residentPresence';
import { assessHouseholdAccess } from '../features/presence/householdIsolation';
import { HouseholdCard } from '../features/presence/HouseholdCard';
import { householdWork } from '../features/presence/householdWork';
import { householdRescues } from '../features/presence/householdRescue';
import { householdStatuses, postEventCoverage } from '../features/presence/householdStatus';
import { defaultCoverageLayers, coverageSpots, createRescueTrail } from '../features/presence/rescueCoverage';
import { openMapSurface } from '../features/map/mapSurfaces';
import { rescueBases } from '../features/tracking/rescueBase';
import { communeVillages } from '../features/presence/communeSites';
import { CommuneVillages } from '../features/presence/CommuneVillages';
import { RescueTeamDetail, RescueTeamList, RescueView } from '../features/tracking/RescueTeams';
import { surveyConditionAreas } from '../features/routes/surveyRoadConditions';
import { LocalRoadCard } from '../features/route-film/LocalRoadCard';
import { supportsBasemapTone } from '../features/imagery/basemapTone';
import { analysisSourceInfo, type AnalysisSelection } from '../features/imagery/analysisImagery';
import proj4 from 'proj4';
import { mapSelectionFrame } from './mapSelectionFrame';
import { geometryPositions } from '../geo/vector/types';
import { AssessmentTimeline } from '../features/incident/AssessmentTimeline';
import './workspace-layout.css';
import { visibleMapRecords } from '../features/map/visibleMapRecords';
import { detailInset } from '../features/map/detailInset';
import { representedHazard } from '../features/map/sourceRepresentation';
import { useMapPreview } from '../features/map/useMapPreview';
import { landslideAreaOf } from '../features/landslides/landslideAreas';
import type { ScenarioTarget } from '../features/geodata/scenarioOverlay';
import type { ScenarioEdits } from '../features/access/scenarioEdits';
import { deriveIncidentWorkspace } from '../features/incident/deriveIncidentWorkspace';
import { scenarioProperties } from '../features/access/scenarioProperties';
import { UiIcon } from '../shared/ui/UiIcon';
import type { ScenarioRevision } from '../features/access/useScenarioRevision';
import {
  journeyMarkers,
  useRoadJourney
} from '../features/routes/useRoadJourney';
import { RoadJourneyPanel } from '../features/routes/RoadJourneyPanel';
import { gisJourneyPlaces } from '../features/routes/journeyPlaces';
import type { RenameScenario } from '../features/access/ScenarioLabels';
import type { DemoIdentity } from '../features/access/demoSession';
import { submissionOf } from '../features/access/submissions';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import '../styles.css';
import '../styles/tokens.css';
import '../styles/workspace.css';
import '../styles/incident-workspace.css';
import '../styles/cartographic.css';
import '../styles/sheet.css';
import '../features/incident/incident-tools.css';
import '../features/search/search.css';
import '../features/briefing/briefing.css';

import { observationOf } from '../features/observations/model';
import { useGeometrySession } from '../features/geodata/useGeometrySession';
import { PointGroupCard } from '../features/observations/PointGroupCard';
import { ResponsePanel } from './ResponsePanel';
import { ResponseDetails } from './ResponseDetails';
import { useResponseDetailLayout } from './useResponseDetailLayout';
import { PanelResizeHandle } from '../shared/ui/PanelResizeHandle';
import { useNotice } from '../shared/hooks/useNotice';
import { NoticeToast } from '../shared/ui/NoticeToast';
import { WorkspaceDialogs } from './WorkspaceDialogs';
import { AppHeader } from '../components/dear/AppHeader';
import { WorkspaceNav } from '../components/dear/WorkspaceNav';
import { MapControls } from '../components/dear/MapControls';
import { MapAttribution } from '../components/dear/MapAttribution';
import { ProfileDrawer } from '../components/dear/ProfileDrawer';
import { useTerrainOverlays } from '../features/terrain/useTerrainOverlays';
import { useAnalysisImagery } from '../features/imagery/useAnalysisImagery';
import { usePreparedPhotos } from '../features/fieldPhotos/preparedPhotos';
import { FlyoverBar } from '../features/flyover/FlyoverBar';
import { buildFlyoverInput } from '../features/flyover/flyoverInput';
import type { FlyoverState } from '../terrain/flyover/flyoverController';
import { LayersDialog } from '../components/dear/LayersDialog';

import type {
  ViewControls,
  OverlayHit,
  BasemapState,
  MapContextRequest
} from '../features/map/mapContracts';
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRequest
} from '../shared/ui/ContextMenu';
import { roadProjected } from '../features/routes/selectedRoadJourney';
import { measurementPoint, useMeasurementSession } from '../features/measurement';
import { useDrawSession } from '../features/drawing';
import { drawingMessages } from '../features/drawing/locales';
import { Map2D } from '../features/map/Map2D';
import { MapLocationPanel } from '../features/map/MapLocationPanel';
import {
  readMapLocation,
  readTerrainLocation,
  type MapLocation
} from '../features/map/mapLocation';
import type { useTerrainWorkspace } from '../features/terrain/useTerrainWorkspace';
import type { IncidentPacket } from '../data/incidentPacket';
import type { useWorkspacePreferences } from './useWorkspacePreferences';
import { Map3DBoundary } from '../features/map/Map3DBoundary';
import { useRouteTerrainAnalysis } from '../features/routes/useRouteTerrainAnalysis';
import { selectAccessRoute } from '../features/routes/routeReview';
import { useModalFocus } from '../shared/hooks/useModalFocus';
import { useIncidentWorkspace } from '../features/incident/useIncidentWorkspace';
import { effectiveRevision } from '../features/incident/workspaceRevision';
import { RevisionNotice } from '../features/incident/RevisionNotice';
import { useResponseWork } from '../features/incident/useResponseWork';
import { responseWork, workState } from '../features/incident/responseWork';
import type { ComparisonPair } from '../features/comparison/comparison';
import { defaultLayerAppearance } from '../features/map/layerAppearance';
import { MapSearch } from '../features/search/MapSearch';
import { searchWorkspace } from '../features/search/searchIndex';
import {
  createDecisionSnapshot,
  type DecisionSnapshot
} from '../features/briefing/decisionSnapshot';

import type { WorkspaceView } from '../types/dear';
import type { TerrainPoint, TerrainMetadata } from '../types/terrain';

import { sampleTiles } from '../terrain/analysisTerrain';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import type { useWorkspaceInteraction } from './useWorkspaceInteraction';

const loadTerrainViewer = () => import('../components/TerrainViewer');
const TerrainViewer = React.lazy(() =>
  loadTerrainViewer().then((module) => ({
    default: module.TerrainViewer
  }))
);
const defaultLayers = {
  gis: true,
  aoi: false,
  imagery: true,
  context: true,
  hillshade: true,
  landslide: true,
  flood: true,
  roads: true,
  localRoads:true,
  devices:true,
  households:true,
  rescueCoverage:true,
  status: true,
  crossings: true,
  communities: true,
  staging: true,
  hlz: false,
  route: true
};

type Props = {
  revision: ScenarioRevision;
  onReportRevision: (applied: boolean) => void;
  identity: DemoIdentity;
  onSignOut: () => void;
  onRename: RenameScenario;
  scenarioEdits?: ScenarioEdits;
  preferences: ReturnType<typeof useWorkspacePreferences>;
  interaction: ReturnType<typeof useWorkspaceInteraction>;
  runtime: ReturnType<typeof useTerrainWorkspace> & { packet: IncidentPacket };
};


export function ResponseWorkspace({
  revision,
  onReportRevision,
  identity,
  onSignOut,
  onRename,
  scenarioEdits,
  preferences,
  interaction,
  runtime
}: Props): JSX.Element {
  const { locale, setLocale, theme, setTheme, fontChoice, setFontChoice } =
    preferences;
  const navigation = useWorkspaceNavigation();
  const [cameraIntent,setCameraIntent] = useState<{kind:'selection'|'route';version:number}>({kind:'selection',version:0});
  const gis = useGeometrySession({prepared: runtime.fieldDataset});
  const [gisScenarioRequest, setGisScenarioRequest] = useState<ScenarioTarget | null>(null);
  const [gisCardId, setGisCardId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('gisPoint')
  );
  const [gisResponseView, setGisResponseView] = useState({
    version: 0,
    id: null as string | null
  });
  const gisCard = gis.records.find(
    (record) => record.id === gisCardId && record.visible
  );
  const [gisGroupIds, setGisGroupIds] = useState<string[]>([]);
  const gisGroup = gis.records.filter(
    (record) => record.visible && gisGroupIds.includes(record.id)
  );
  const inspectGisRecord = (id: string, keepGroup = false) => {
    journey.setOpen(false);
    const record=gis.records.find(item=>item.id===id),submission=record&&submissionOf(record);
    if(record&&(observationOf(record)?.kind==='help'||record.feature.properties.dearRouteProposal)&&submission?.locationSource==='device'&&submission.deviceId&&deviceFeed?.getSnapshot().some(device=>device.id===submission.deviceId)){selectDevice(submission.deviceId);return;}
    setLocalAreaId(null);setHouseholdId(null);
    setLocalRoadId(null);
    navigation.dispatch({type:'view',view:navigation.view,list:true});
    gis.select(id);
    setGisCardId(id);
    if (!keepGroup) setGisGroupIds([]);
    setPanelCollapsed(false);
    setMobileView('info');
    resetTools();
  };
  const showGisOnResponse = (id: string) => {
    journey.setOpen(false);
    const record=gis.records.find(item=>item.id===id),submission=record&&submissionOf(record);
    if(record&&(observationOf(record)?.kind==='help'||record.feature.properties.dearRouteProposal)&&submission?.locationSource==='device'&&submission.deviceId&&deviceFeed?.getSnapshot().some(device=>device.id===submission.deviceId)){selectDevice(submission.deviceId);return;}
    setLocalAreaId(null);setHouseholdId(null);setLocalRoadId(null);
    navigation.dispatch({type:'view',view:navigation.view,list:true});
    gis.select(id);
    setGisCardId(id);
    setGisResponseView((previous) => ({ version: previous.version + 1, id }));
    const area = gis.records.find(record => record.id === id);
    setLayers((previous) => ({ ...previous, gis: true, ...(area && (landslideAreaOf(area) || area.feature.properties.sourceDatasetId && area.feature.geometry.type === 'Point') ? {landslide: true} : {}) }));
    setPanelCollapsed(false);
    setGisGroupIds([]);
    setMapMode('2d');
    setMobileView('info');
    resetTools();
    setActiveDialog(null);
  };
  const { view, selectedCommunityId, selectedRouteType, selectedObjectId } =
    navigation;
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('gisPoint');
    if (id && gis.records.some((record) => record.id === id)) {
      gis.select(id);
      gis.fit(id);
      setGisResponseView({ version: 1, id });
      setMapMode('2d');
      setMobileView('info');
    }
  }, []);
  const [mapQuery, setMapQuery] = useState('');
  const [decisionSnapshot, setDecisionSnapshot] =
    useState<DecisionSnapshot | null>(null);
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(
    null
  );
  const [layerAppearance, setLayerAppearance] = useState(
    defaultLayerAppearance
  );
  const reportApplied = revision.applied,
    appliedAt = revision.at,
    setReportApplied = onReportRevision;
  const [workTaskId, setWorkTaskId] = useState<string | null>(null);
  const work = useResponseWork(runtime.packet.datasetVersion);
  const [historical, setHistorical] = useState(false);
  const updated = effectiveRevision({ applied: reportApplied, historical });
  const surveyAreas = useMemo(() => surveyConditionAreas(gis.records), [gis.records]);
  const incidentSnapshot = useIncidentWorkspace(runtime.packet, updated, historical ? undefined : scenarioEdits?.edits, appliedAt, surveyAreas);
  const [alertRead, setAlertRead] = useState<boolean>(false);
  const {
    showProfile,
    measurementOpen,
    drawOpen,
    locationOpen,
    activeDialog,
    mapMode,
    setMapMode,
    setActiveDialog,
    focusDistance,
    setFocusDistance,
    resetTools,
    recover2D: handle3DUnavailable
  } = interaction;
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const { session: measureSession, dispatch: dispatchMeasureSession } =
    useMeasurementSession(mapMode, measurementOpen);
  const { session: drawSession, dispatch: dispatchDrawSession } = useDrawSession(mapMode, drawOpen);
  const [mobileView, setMobileView] = useState<'map' | 'info'>('map');
  const [basemapState, setBasemapState] = useState<BasemapState>({
    status: 'off',
    style: 'satellite',
    loaded: 0,
    total: 0
  });
  const [locationPoint, setLocationPoint] = useState<MapLocation | null>(null);
  const focusMapTool = (selector: string) => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    (button?.getClientRects().length ? button : document.querySelector<HTMLButtonElement>('.map-tool-toggle'))?.focus();
  };
  const closeLocation = useCallback(() => {
    interaction.dispatch({ type: 'close-tool', tool: 'location' });
    focusMapTool('.map-location-trigger');
  }, [interaction.dispatch]);
  const [evidenceModalId, setEvidenceModalId] = useState<string | null>(null);
  const { notice, notify: showToast, dismiss: dismissToast } = useNotice();
  const terrainOverlays = useTerrainOverlays();
  const [layers, setLayers] = useState<Record<string, boolean>>(() => ({
    ...defaultLayers,
    context: !runtime.offline || runtime.localMap
  }));

  const displayedGis = useMemo(() => historical ? [] : visibleMapRecords(gis.records, layers, runtime.packet.datasetVersion, incidentSnapshot.hazards, gisCardId), [gis.records, layers, historical, runtime.packet.datasetVersion, incidentSnapshot.hazards, gisCardId]);

  useEffect(() => {
    if (gisCardId && !displayedGis.some(record => record.id === gisCardId)) setGisCardId(null);
    setGisGroupIds(ids => ids.every(id => displayedGis.some(record => record.id === id)) ? ids : ids.filter(id => displayedGis.some(record => record.id === id)));
  }, [displayedGis, gisCardId]);

  const map2DViewport = useRef<{
    center: [number, number];
    zoom: number;
  } | null>(null);
  const [orbiting, setOrbiting] = useState(false);
  const viewControlRef = useRef<ViewControls | null>(null);
  const showMappedAreas = () => {
    const points = gis.records.filter(record => record.visible && landslideAreaOf(record))
      .flatMap(record => geometryPositions(record.feature.geometry))
      .map(([lon, lat]) => { const [x, y] = proj4('EPSG:4326', 'EPSG:32648', [lon, lat]); return { x, y }; });
    if (!points.length) return;
    resetTools(); navigation.dispatch({type:'reset'}); setGisCardId(null); setGisGroupIds([]);
    setMobileView('map'); setMapMode('2d');
    setLayers(previous => ({...previous, landslide:true}));
    requestAnimationFrame(() => viewControlRef.current?.frameProjected?.(points));
  };
  const [viewReadyVersion, setViewReadyVersion] = useState(0);
  const onViewReady = useCallback(() => setViewReadyVersion(version => version + 1), []);
  useEffect(() => {
    if (window.matchMedia('(max-width:900px)').matches && mobileView !== 'map') return;
    if (!gisCard || !models[0]?.metadata) return;
    const metadata = models[0].metadata;
    const points = geometryPositions(gisCard.feature.geometry).map(([lon,lat]) => {
      const [x,y] = proj4('EPSG:4326', metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`, [lon,lat]);return {x,y};
    });
    const frame = points.length === 1 ? [
      {x:points[0].x - 250, y:points[0].y - 250},
      {x:points[0].x + 250, y:points[0].y + 250}
    ] : points;
    const timer = requestAnimationFrame(() => {
      const map = document.querySelector<HTMLElement>('.map-canvas');
      viewControlRef.current?.frameProjected?.(frame,map ? detailInset(map) : undefined);
    });
    return () => cancelAnimationFrame(timer);
  }, [gisCardId, gisCard?.feature.geometry, mapMode, viewReadyVersion, mobileView, panelCollapsed]);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const detailReturnTarget = useRef<HTMLElement | null>(null);
  const profileReturnTarget = useRef<HTMLElement | null>(null);
  const detailLayout = useResponseDetailLayout(workspaceRef, showProfile);
  const modalKey = interaction.dialog === 'layers' ? null : interaction.dialog;
  useModalFocus(workspaceRef, modalKey, () => {
    setActiveDialog(null);
  });

  const shownFallback = useRef(0);
  useEffect(() => {
    if (interaction.fallbackVersion <= shownFallback.current) return;
    shownFallback.current = interaction.fallbackVersion;
    showToast([
      'Không mở được 3D. Đã chuyển sang bản đồ 2D.',
      '3D unavailable. Switched to the 2D map.'
    ]);
  }, [interaction.fallbackVersion, showToast]);
  const {
    packet,
    manifest: scenarioManifest,
    defaultTerrain: defaultTerrainData,
    contextTerrain,
    snapshotReady,
    startupError,
    offline: offlineMode,
    models,
    mode: uploadMode,
    geographicMerge,
    fileNames: uploadedNames,
    busy: uploadBusy,
    error: uploadError,
    loading3D: terrain3DBusy,
    progress3D,
    placements: geographicPlacements,
    retry: retryTerrain,
    reload: reloadTerrain,
    clear: clearTerrain,
    upload: uploadTerrain,
    changeMode: handleUploadModeChange,
    changeGeographicMerge: handleGeographicMergeChange
  } = runtime;
  // Undo restores the status the road would have without that edit (including a field report
  // applied since), not the stored "from", which can be stale.
  const revertRoadStatus = (edits: ScenarioEdits, id: string): boolean => {
    const edit = edits.edits.find(item => item.id === id);
    if (edit?.change.kind !== 'status') return false;
    const current = incidentSnapshot.roads.find(road => road.id === edit.target.id)?.status;
    const previous = deriveIncidentWorkspace(packet, updated, edits.edits.filter(item => item.id !== id), appliedAt, surveyAreas)
      .roads.find(road => road.id === edit.target.id)?.status;
    if (!current || !previous || current === previous) return false;
    return edits.record({ target: edit.target, change: { kind: 'status', from: current, to: previous },
      note: locale === 'vi' ? 'Hoàn tác thay đổi trước' : 'Undo previous change', reverts: id });
  };
  // Published landslide areas drawn on this road network; their road links can raise checks.
  const areaLinks = useMemo(() => gis.records.flatMap(record => {
    const area = landslideAreaOf(record);
    return area && area.networkVersion === packet.datasetVersion
      ? area.roadLinks.map(link => ({ areaId: record.id, areaName: record.name, roadId: link.roadId, relation: link.relation })) : [];
  }), [gis.records, packet.datasetVersion]);
  const evidenceWork = useMemo(
    () => responseWork(packet, incidentSnapshot, reportApplied, areaLinks),
    [packet, incidentSnapshot, reportApplied, areaLinks]
  );
  const {
    roads,
    hazards,
    evidence,
    routes,
    assessments,
    communities,
    incident,
    responseSites
  } = incidentSnapshot;
  const selectedSourceHazard = gisCard ? representedHazard(gisCard, hazards)?.id : undefined;
  const mapHazards = useMemo(() => hazards.filter(hazard => hazard.id !== selectedSourceHazard)
    .map(hazard => ({...hazard, labelMode: hazard.labelMode ?? 'show' as const})), [hazards, selectedSourceHazard]);
  useMapPreview(workspaceRef,key=>{const [kind,...rest]=key.split(':'),id=rest.join(':');const f=kind==='community'?communities.find(f=>f.id===id):kind==='hazard'?hazards.find(f=>f.id===id):kind==='poi'?responseSites.find(f=>f.id===id):roads.find(f=>f.id===id);if(f)return {point:'projected' in f?f.projected:f.points[Math.floor(f.points.length/2)],name:typeof f.name==='string'?f.name:f.name[locale==='vi'?0:1]};const r=gis.records.find(r=>r.id===id);if(r?.feature.geometry.type==='Point'){const [lon,lat]=r.feature.geometry.coordinates;return {point:roadProjected(lat,lon),name:r.name};}return null;});
  useEffect(() => {
    if (offlineMode) setLayers((previous) => ({ ...previous, context: runtime.localMap }));
  }, [offlineMode,runtime.localMap]);
  const analysisImagery = useAnalysisImagery(scenarioManifest?.analysisImagery);
  const imageryControls = {...analysisImagery,setSelection:(selection:AnalysisSelection)=>{
    terrainOverlays.suspendSar();
    analysisImagery.setSelection(selection);
  }};
  const fieldPhotos = usePreparedPhotos(scenarioManifest?.fieldPhotos);
  const localNetwork=useLocalNetwork(packet.datasetVersion.startsWith('che-tao'),gis.records);
  const [localAreaId,setLocalAreaId]=useState<string|null>(null);
  // People the resident app still places at field huts, and whether any road out remains.
  const presence=useResidentPresence(scenarioManifest?.residentPresence);
  const households=useMemo(()=>!historical&&localNetwork.network&&presence?assessHouseholdAccess(localNetwork.network,presence.clusters):[],[historical,localNetwork.network,presence]);
  const [householdId,setHouseholdId]=useState<string|null>(null);
  const [localRoadId,setLocalRoadId]=useState<string|null>(null);
  const localRoad=localNetwork.network?.roads.find(road=>road.id===localRoadId);
  const showLocalRoads=()=>{
    navigation.dispatch({type:'view',view:navigation.view,list:true});
    setGisCardId(null);setGisGroupIds([]);
    setLayers(previous=>({...previous,roads:true,localRoads:true}));
    setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);resetTools();setMobileView('map');
    requestAnimationFrame(()=>viewControlRef.current?.frameProjected?.(localNetwork.network?.roads.flatMap(road=>road.points)??[]));
  };
  // Condition signs sit where a mapped extent touches the road, on the main road and the commune roads alike.
  const roadAreaLinks=useMemo(()=>[...incidentSnapshot.surveyLinks,...(localNetwork.network?.conditions?.areaLinks??[])],[incidentSnapshot.surveyLinks,localNetwork.network]);
  const journeyRoads=useMemo(()=>[...roads,...(localNetwork.network?.roads??[])],[roads,localNetwork.network]);
  // Teams muster at the scenario's assembly points on the commune roads.
  const bases=useMemo(()=>localNetwork.network?rescueBases(responseSites,localNetwork.network.roads):[],[localNetwork.network,responseSites]);
  const [guidanceProposal,setGuidanceProposal]=useState<{destination:{id:string;name:[string,string];projected:{x:number;y:number}};roadIds:string[]}|null>(null);
  const [guidanceTarget,setGuidanceTarget]=useState<DispatchTarget|null>(null);
  const guidance=useResidentGuidance(localNetwork.network,residentDeviceId,bases);
  const rescueDispatch=useRescueDispatch(localNetwork.network,bases);
  // Teams sent to the isolated huts move in the same feed as the other rescue and resident dots.
  const householdTeams=useMemo(()=>localNetwork.network?householdRescues(localNetwork.network,households,bases):[],[localNetwork.network,households,bases]);
  const householdMissions=useMemo(()=>householdTeams.map(team=>team.plan),[householdTeams]);
  // Where each hut cluster stands: cut off, unverified, awaiting a team, or rescued.
  const imageryCoverage=useMemo(()=>postEventCoverage(analysisImagery.layers,incident.triggeredAt,incident.asOf),[analysisImagery.layers,incident.triggeredAt,incident.asOf]);
  const householdTeamIds=useMemo(()=>new Set([...householdTeams.map(team=>team.householdId),...(!rescueDispatch.order?.recalledAt&&rescueDispatch.order?.target.id.startsWith('household:')?[rescueDispatch.order.target.id.slice(10)]:[])]),[householdTeams,rescueDispatch.order]);
  const householdBase=useMemo(()=>householdStatuses(households,imageryCoverage,householdTeamIds,new Set()),[households,imageryCoverage,householdTeamIds]);
  // People at field huts are relief or verification work alongside the evidence checks.
  const workTasks=useMemo(()=>[...householdWork(historical?[]:householdBase),...evidenceWork].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id)),[householdBase,evidenceWork,historical]);
  const assistedHouseholds=useMemo(()=>new Set(workTasks.filter(task=>task.id.startsWith('household:')&&workState(task,work.entries).status==='done').map(task=>task.id.slice(10))),[workTasks,work.entries]);
  const householdViews=useMemo(()=>historical?[]:householdStatuses(households,imageryCoverage,householdTeamIds,assistedHouseholds),[historical,households,imageryCoverage,householdTeamIds,assistedHouseholds]);
  const household=householdViews.find(item=>item.cluster.id===householdId&&item.status!=='clear');
  // Villages as reached from the commune's first assembly point, with the huts around each.
  const villages=useMemo(()=>localNetwork.network?communeVillages(localNetwork.network,householdViews,bases[0]):[],[localNetwork.network,householdViews,bases]);
  const operationalDeviceFeed=useDeviceFeed(journeyRoads,snapshotReady && !historical && !!localNetwork.network,localNetwork.network?.conditions?.areaLinks,householdMissions,bases);
  const residentLocation=useResidentLocation(historical?null:localNetwork.network,bases,guidance);
  const deviceFeed=useMemo(()=>historical?null:mergeLocationFeeds(mergeLocationFeeds(operationalDeviceFeed,residentLocation),rescueDispatch.feed),[operationalDeviceFeed,residentLocation,rescueDispatch.feed,historical]);
  // The ground rescue teams have covered this session, for the overview's fog of war.
  const [rescueTrail,setRescueTrail]=useState<ReturnType<typeof createRescueTrail>|null>(null);
  const rescueTrailMemory=useRef<{dataset:string;trail:ReturnType<typeof createRescueTrail>}|null>(null);
  useEffect(()=>{const previous=rescueTrailMemory.current;const trail=createRescueTrail(deviceFeed,previous?.dataset===packet.datasetVersion?previous.trail.points():[]);
    rescueTrailMemory.current={dataset:packet.datasetVersion,trail};setRescueTrail(trail);return trail.dispose;
  },[deviceFeed,packet.datasetVersion]);
  const currentReports=useMemo(()=>latestOperationalReports(gis.records),[gis.records]);
  const responseMapRecords=useMemo(()=>{
    const current=new Set(currentReports.map(record=>record.id));
    const devices=new Set(deviceFeed?.getSnapshot().map(device=>device.id)??[]);
    return displayedGis.filter(record=>{
      const submission=submissionOf(record);
      if(observationOf(record)?.kind!=='help'||!submission)return true;
      if(submission.review.status!=='pending'||!current.has(record.id))return record.id===gisCardId;
      return !(submission.locationSource==='device'&&submission.deviceId&&devices.has(submission.deviceId));
    }).map(record=>{const submission=submissionOf(record);return submission?{...record,name:submission.authorName}:record;});
  },[displayedGis,currentReports,deviceFeed,gisCardId]);
  const dispatchTo=(target:DispatchTarget)=>{
    const result=rescueDispatch.dispatch(target);
    if(result==='ok'&&!guidance.issue(target,null,identity.name)){showToast(['Đã giao đội; chưa gửi được hướng dẫn chờ.','Team assigned; wait instruction could not be sent.']);return;}
    showToast(result==='ok'?['Đã giao đội cứu hộ 05.','Rescue team 05 assigned.']:result==='busy'?['Đội 05 đang có nhiệm vụ.','Team 05 already has a task.']:result==='storage-error'?['Chưa lưu được lệnh điều đội.','Dispatch could not be saved.']:['Chưa có tuyến tiếp cận liên thông.','No connected approach route.']);
  };
  const dispatchReport=(record:GeometryRecord)=>{
    const geometry=record.feature.geometry;if(geometry.type!=='Point')return;
    const name=submissionOf(record)?.authorName??record.name;
    dispatchTo({id:`report:${record.id}`,name:[name,name],point:roadProjected(geometry.coordinates[1],geometry.coordinates[0])});
  };
  const inspectApproach=(target:DispatchTarget)=>{
    if(!localNetwork.network)return;
    const order=rescueDispatch.order?.target.id===target.id?rescueDispatch.order:planDispatch(localNetwork.network.roads,bases,target,Date.now());
    if(!order){showToast(['Chưa có tuyến tiếp cận liên thông.','No connected approach route.']);return;}
    journey.setPoint('start',order.points[0],'dispatch:base',locale==='vi'?'Điểm tập kết':'Assembly point',localJourneyRoadIds);
    journey.setPoint('end',order.points.at(-1)!,'dispatch:approach',locale==='vi'?'Điểm tiếp cận':'Approach point',localJourneyRoadIds);
    setHouseholdId(null);resetTools();journey.setOpen(true);
  };
  const selectedDeviceId=selectedObjectId?.startsWith('device:')?selectedObjectId.slice(7):selectedObjectId?.startsWith('team:')?selectedObjectId.slice(5):null;
  const [layerSection,setLayerSection]=useState<'map'|'rescue'>('map');
  const [coverageLayers,setCoverageLayers]=useState(defaultCoverageLayers);
  const liveAlerts=useMemo(()=>historical?[]:latestOperationalReports(gis.records).map(record=>{
    const submission=submissionOf(record)!;
    return {id:record.id,name:submission.authorName,at:submission.submittedAt,kind:observationOf(record)?.kind==='help'?'help' as const:'proposal' as const};
  }),[gis.records,historical]);
  const knownAlerts=useRef<Set<string>|null>(null);
  useEffect(()=>{if(historical)return;const previous=knownAlerts.current;knownAlerts.current=new Set(liveAlerts.map(alert=>alert.id));
    const incoming=previous?liveAlerts.find(alert=>alert.kind==='help'&&!previous.has(alert.id)):null;
    if(incoming)showToast([`Cầu cứu: ${incoming.name}`,`Rescue request: ${incoming.name}`]);
  },[liveAlerts,showToast,historical]);
  const rescueCoverage=useMemo(()=>localNetwork.network&&!historical?{
    layers:coverageLayers,
    onOpenLayers:()=>{setLayerSection('rescue');setActiveDialog('layers');},
    selected:()=>{if(household)return {point:household.projected,label:household.cluster.name[locale==='vi'?0:1]};
      const device=deviceFeed?.getSnapshot().find(item=>item.id===selectedDeviceId);
      return device?{point:device.point,label:device.name[locale==='vi'?0:1]}:null;},
    spots:()=>coverageSpots({households:householdViews,devices:deviceFeed?.getSnapshot()??[],trail:rescueTrail?.points()??[],bases:bases.map(base=>base.projected),requests:currentReports.flatMap(record=>{
      if(observationOf(record)?.kind!=='help'||record.feature.geometry.type!=='Point')return [];
      const submission=submissionOf(record),device=submission?.locationSource==='device'?deviceFeed?.getSnapshot().find(item=>item.id===submission.deviceId):undefined;
      return [device?.point??roadProjected(record.feature.geometry.coordinates[1],record.feature.geometry.coordinates[0])];
    })}),
    rescued:()=>householdViews.filter(item=>item.status==='rescued').map(item=>item.projected),
    subscribe:deviceFeed?.subscribe??(()=>()=>undefined),
    focus:localNetwork.network.roads.flatMap(road=>[road.points[0],road.points[road.points.length-1]]),
  }:undefined,[localNetwork.network,historical,householdViews,deviceFeed,rescueTrail,bases,currentReports,coverageLayers,household,selectedDeviceId,locale]);
  const localJourneyRoadIds=useMemo(()=>localNetwork.network?.roads.map(road=>road.id)??[],[localNetwork.network]);
  const localContext=useMemo(()=>{
    if(!localNetwork.context)return undefined;
    const urgentAreas=new Set(householdViews.filter(h=>h.status==='cut-off'||h.status==='team').flatMap(h=>h.cutBy.flatMap(c=>c.kind==='area'?[c.id]:[])));
    return {areas:localNetwork.context.areas.filter(area=>area.kind==='landslide'&&layers.landslide!==false).map(area=>({...area,responsePriority:areaResponsePriority(area.id,localNetwork.network?.roads??[],[],urgentAreas.has(area.id))})),closures:[]};
  },[localNetwork.context,localNetwork.network,householdViews,layers.landslide]);
  const localArea=localContext?.areas.find(area=>area.id===localAreaId);
  // Whatever is chosen on the map comes into view; on phones its card covers the lower half, so keep it above.
  const focusMapOn=(points:Array<{x:number;y:number}>)=>requestAnimationFrame(()=>viewControlRef.current?.frameProjected?.(points,matchMedia('(max-width: 600px)').matches?{bottom:400}:undefined));
  const inspectLocalArea=(id:string)=>{
    journey.setOpen(false);
    navigation.dispatch({type:'view',view:navigation.view,list:true});
    setGisCardId(null);setGisGroupIds([]);setLocalRoadId(null);setLocalAreaId(id);setHouseholdId(null);resetTools();setMobileView('map');
    const area=localNetwork.context?.areas.find(item=>item.id===id);
    if(area)focusMapOn([{x:area.center.x-area.radius,y:area.center.y-area.radius},{x:area.center.x+area.radius,y:area.center.y+area.radius}]);
  };
  const inspectHousehold=(id:string)=>{
    journey.setOpen(false);
    const item=householdViews.find(entry=>entry.cluster.id===id&&entry.status!=='clear');if(!item)return;
    navigation.dispatch({type:'view',view:navigation.view,list:true});
    setGisCardId(null);setGisGroupIds([]);setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(id);resetTools();setMobileView('map');
    focusMapOn([item.projected,...(item.access?[item.access.point]:[])]);
  };
  // A team opens in the detail panel and comes to the middle of the map.
  const selectTeam=(id:string)=>{
    inspectObject('team:'+id);
    const device=deviceFeed?.getSnapshot().find(item=>item.id===id);
    if(device)focusMapOn([device.point]);
  };
  const selectDevice=(id:string)=>{
    const device=deviceFeed?.getSnapshot().find(device=>device.id===id);
    if(device?.role==='rescue'){selectTeam(id);return;}
    inspectObject('device:'+id);
    if(device)focusMapOn([device.point]);
  };
  const showHouseholds=()=>{
    const isolated=householdViews.filter(entry=>entry.status!=='clear');if(!isolated.length)return;
    setGisCardId(null);setGisGroupIds([]);setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);resetTools();setMobileView('map');setMapMode('2d');
    requestAnimationFrame(()=>viewControlRef.current?.frameProjected?.(isolated.flatMap(entry=>[entry.projected,...(entry.access?[entry.access.point]:[])])));
  };
  const householdAreaName=(id:string)=>localNetwork.context?.areas.find(area=>area.id===id)?.name[locale==='vi'?0:1]??gis.records.find(record=>record.id===id)?.name??id;
  const analysisDisplay = useMemo(() => ({ rasters: analysisImagery.rasters, opacity: analysisImagery.selection.opacity, balanceBasemap:analysisImagery.balanceBasemap && supportsBasemapTone(analysisImagery.layers) && analysisImagery.layers.some(layer=>layer.id===analysisImagery.selection.layer && layer.kind==='optical') }),
    [analysisImagery.rasters, analysisImagery.selection.opacity,analysisImagery.balanceBasemap,analysisImagery.layers,analysisImagery.selection.layer]);
  const [flyoverState, setFlyoverState] = useState<FlyoverState>({ status: 'idle', time: 0, duration: 0 });
  const flyoverInput = useMemo(() => buildFlyoverInput({ communities, routes, hazards, responseSites, overviewPoints:packet.aoi.points, fieldPhotos, mappedAreas:displayedGis, imageryLayers: analysisImagery.layers, imagerySelection: analysisImagery.selection }),
    [communities, routes, hazards, responseSites, packet.aoi.points, fieldPhotos, displayedGis, analysisImagery.layers, analysisImagery.selection]);

  const resetTerrainTools = useCallback(() => {
    resetTools();
    setLocationPoint(null);
  }, [resetTools]);
  const clearUploadedModels = useCallback(() => {
    clearTerrain();
    resetTerrainTools();
  }, [clearTerrain, resetTerrainTools]);
  const handleUpload = useCallback(
    async (files: File[]) => {
      if (await uploadTerrain(files)) {
        resetTerrainTools();
      }
    },
    [uploadTerrain, resetTerrainTools]
  );

  const handlePick = useCallback(
    (point: TerrainPoint, metadata: TerrainMetadata) =>
      setLocationPoint(readTerrainLocation(point, metadata)),
    []
  );

  // Selected Community & Route objects
  const selectedCommunity = useMemo(
    () =>
      selectedCommunityId
        ? communities.find((c) => c.id === selectedCommunityId) || null
        : null,
    [selectedCommunityId, communities]
  );

  const selectedRoutePair = useMemo(
    () =>
      selectedCommunityId ? routes.get(selectedCommunityId) || null : null,
    [routes, selectedCommunityId]
  );

  const activeRoute = useMemo(() => {
    return selectAccessRoute(selectedRoutePair, selectedRouteType);
  }, [selectedRoutePair, selectedRouteType]);

  const mapTerrain = useMemo(
    () =>
      models[0]?.metadata && models[0]?.grid && models[0]?.gridBuffer
        ? {
            metadata: models[0].metadata,
            grid: models[0].grid,
            gridBuffer: models[0].gridBuffer
          }
        : defaultTerrainData,
    [models, defaultTerrainData]
  );
  const scenarioTerrainCompatible = Boolean(
    mapTerrain?.grid &&
    mapTerrain.metadata.crs.authority.toUpperCase() === 'EPSG' &&
    mapTerrain.metadata.crs.code === 32648 &&
    mapTerrain.metadata.crs.linear_unit === 'metre'
  );
  const analysisModels = useMemo(
    () =>
      models.length ? models : defaultTerrainData ? [defaultTerrainData,...contextTerrain] : [],
    [models, defaultTerrainData,contextTerrain]
  );
  const journey = useRoadJourney(journeyRoads, undefined, 'conditions');
  const journeyTerrainEndpoints = useMemo(() => journey.open ? [journey.start, journey.end].flatMap((endpoint, index) => endpoint ? [{label: index === 0 ? 'A' : 'B', point: endpoint.origin, anchor: endpoint.anchor?.point}] : []) : [], [journey.open, journey.start, journey.end]);
  const framedJourney = useRef<{route: typeof journey.route; start: typeof journey.start; end: typeof journey.end; sequence: number; canvas: Element} | null>(null);
  useEffect(() => {
    if (!journey.open || mapMode !== '3d') { framedJourney.current = null; return; }
    if (terrain3DBusy) return;
    const canvas = workspaceRef.current?.querySelector('canvas.terrain-canvas');
    const previous = framedJourney.current;
    if (previous?.route === journey.route && previous.start === journey.start && previous.end === journey.end && previous.sequence === journey.fitSequence && previous.canvas === canvas) return;
    const points = [...(journey.route?.points ?? []), ...[journey.start, journey.end].flatMap(point => point ? [point.origin] : [])];
    if (!points.length) return;
    const frame = requestAnimationFrame(() => {
      const map = document.querySelector<HTMLElement>('.map-area');
      if (!canvas || !map || !viewControlRef.current?.frameProjected) return;
      const panel = map.querySelector<HTMLElement>('.road-journey-panel');
      framedJourney.current = {route: journey.route, start: journey.start, end: journey.end, sequence: journey.fitSequence, canvas};
      const right = panel && matchMedia('(min-width: 761px)').matches ? panel.getBoundingClientRect().width + 32 : 0;
      const bottom = panel && !matchMedia('(min-width: 761px)').matches ? panel.getBoundingClientRect().height + 24 : 0;
      viewControlRef.current?.frameProjected?.(points, {right, bottom});
    });
    return () => cancelAnimationFrame(frame);
  }, [journey.open, journey.fitSequence, journey.route, journey.start, journey.end, mapMode, viewReadyVersion, terrain3DBusy]);
  // One map tool at a time: opening the journey already resets the others, so the
  // others close the journey too. Its chosen points are kept for when it reopens.
  const otherMapTool = measurementOpen || drawOpen || locationOpen;
  useEffect(() => {
    if (otherMapTool && journey.open) journey.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherMapTool]);
  const profileTarget = useMemo(
    () =>
      journey.open && journey.route
        ? journey.route
        : selectedObjectId?.startsWith('road:')
          ? (roads.find((road) => `road:${road.id}` === selectedObjectId) ??
            null)
          : activeRoute?.segs.find(road => road.id === navigation.routeSectionId) ?? activeRoute,
    [selectedObjectId, roads, activeRoute, navigation.routeSectionId, journey.open, journey.route]
  );
  const { analysisTerrain, routeProfile, focusPoint } = useRouteTerrainAnalysis(
    analysisModels,
    scenarioTerrainCompatible ? profileTarget : null,
    focusDistance
  );
  const communityTerrainCoverage = useMemo(() => {
    if (
      !analysisTerrain ||
      analysisTerrain.metadata.crs.authority.toUpperCase() !== 'EPSG' ||
      analysisTerrain.metadata.crs.code !== 32648
    )
      return null;
    return new Map(
      communities.map((community) => [
        community.id,
        sampleTiles(
          analysisTerrain.tiles,
          community.projected.x,
          community.projected.y
        ).elevation !== undefined
      ])
    );
  }, [analysisTerrain, communities]);

  const returnDetailFocus = () => {
    requestAnimationFrame(() => {
      const detail = document.querySelector<HTMLElement>(
        '#response-details:not([hidden]) h1'
      );
      if (detail) {
        detail.focus({ preventScroll: true });
        return;
      }
      const previous = detailReturnTarget.current;
      if (previous?.isConnected && previous.getClientRects().length)
        previous.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>(
            '#response-panel button, .workspace-nav button[aria-current="page"]'
          )
          ?.focus({ preventScroll: true });
    });
  };
  const rememberDetailTrigger = () => {
    journey.setOpen(false);
    setLocalAreaId(null);setHouseholdId(null);
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active.closest('#response-panel, .map-toolbar, .workspace-nav')
    )
      detailReturnTarget.current = active;
    setGisCardId(null);
    setGisGroupIds([]);
  };
  const revealPanel = () => {
    setPanelCollapsed(false);
    setMobileView('info');
    resetTools();
  };
  const selectCommunity = (
    id: string,
    routeType?: 'candidate' | 'direct',
    sectionId?: string
  ) => {
    setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);
    rememberDetailTrigger();
    setCameraIntent(previous=>({kind:'selection',version:previous.version+1}));
    setLayers(previous => ({...previous, communities:true}));
    navigation.dispatch({ type: 'select-community', id });
    if (routeType)
      navigation.dispatch({
        type: 'filters',
        values: { selectedRouteType: routeType, detailTab: 'decision' }
      });
    if (sectionId)
      navigation.dispatch({ type: 'route-section', id: sectionId });
    revealPanel();
  };
  const inspectObject = (id: string) => {
    if (id.startsWith('household:')) { setActiveDialog(null); inspectHousehold(id.slice(10)); return; }
    setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);
    if (id.startsWith('community:')) {
      selectCommunity(id.slice(10));
      return;
    }
    rememberDetailTrigger();
    setCameraIntent(previous=>({kind:'selection',version:previous.version+1}));
    const hazard = id.startsWith('hazard:') ? hazards.find(item => `hazard:${item.id}` === id) : undefined;
    const layer = id.startsWith('device:') || id.startsWith('team:') ? 'devices' : hazard ? hazard.kind === 'landslide' ? 'landslide' : hazard.kind === 'flood' ? 'flood' : 'crossings'
      : id.startsWith('road:') ? 'roads' : id.startsWith('aoi:') ? 'aoi' : responseSites.find(item => `poi:${item.id}` === id)?.kind;
    if (layer) setLayers(previous => ({ ...previous, [layer]: true }));
    navigation.dispatch({ type: 'inspect-object', id });
    revealPanel();
  };
  const selectRouteSection = (id: string | null) => {
    rememberDetailTrigger();
    navigation.dispatch({ type: 'route-section', id });
    setFocusDistance(null);
    setPanelCollapsed(false);
    setMobileView('info');
  };
  /** 3D start-up state: the mesh download is the long step, so it shows real progress. */
  const terrainLoading = (progress: number | null) => (
    <div className="map-load-state terrain-loading" role="status">
      <span>{locale === 'vi' ? 'Đang tải địa hình 3D' : 'Loading 3D terrain'}</span>
      {progress !== null && (
        <>
          <span
            className="terrain-loading-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={locale === 'vi' ? 'Tiến độ tải' : 'Download progress'}
          >
            <i style={{ width: `${progress * 100}%` }} />
          </span>
          <small>{Math.round(progress * 100)}%</small>
        </>
      )}
    </div>
  );
  // Fetch the 3D viewer code alongside the mesh rather than after it arrives.
  useEffect(() => {
    if (mapMode === '3d') void loadTerrainViewer();
  }, [mapMode]);
  const handleOverlayHit = (hit: OverlayHit) => {
    if (hit.type==='road' && localNetwork.network?.roads.some(road=>road.id===hit.id)) {
      journey.setOpen(false);
      navigation.dispatch({type:'view',view:navigation.view,list:true});
      setLocalAreaId(null);setHouseholdId(null);setGisCardId(null);setGisGroupIds([]);setLocalRoadId(hit.id);resetTools();setMobileView('map');
      const road=localNetwork.network.roads.find(item=>item.id===hit.id);if(road)focusMapOn(road.points);
      return;
    }
    setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);
    if (hit.type === 'community') selectCommunity(hit.id);
    else if (
      hit.type === 'road' &&
      view === 'priority' &&
      activeRoute?.segs.some((road) => road.id === hit.id)
    )
      selectRouteSection(hit.id);
    else inspectObject(`${hit.type}:${hit.id}`);
  };

  const [mapMenu, setMapMenu] = useState<ContextMenuRequest | null>(null);
  const closeMapMenu = useCallback(() => setMapMenu(null), []);
  /** Right-click on the map: actions for the place or object under the pointer. */
  const openMapMenu = (request: MapContextRequest) => {
    const vi = locale === 'vi';
    const { latitude, longitude, hit } = request;
    const object =
      hit?.type === 'community'
        ? communities.find((item) => item.id === hit.id)
        : undefined;
    const site =
      hit?.type === 'poi'
        ? responseSites.find((item) => item.id === hit.id)
        : undefined;
    const hazard =
      hit?.type === 'hazard'
        ? hazards.find((item) => item.id === hit.id)
        : undefined;
    const road =
      hit?.type === 'road' ? journeyRoads.find((item) => item.id === hit.id) : undefined;
    const name =
      object?.name ??
      (site && site.name[vi ? 0 : 1]) ??
      (hazard && hazard.name[vi ? 0 : 1]) ??
      (road && (typeof road.name === 'string' ? road.name : road.name[vi ? 0 : 1]));
    const projected =
      object?.projected ??
      site?.projected ??
      hazard?.projected ??
      roadProjected(latitude, longitude);
    const source = object
      ? `community:${object.id}`
      : site
        ? `site:${site.id}`
        : 'map';
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const stop = (letter: 'A' | 'B') => (
      <span className={'context-menu-stop is-' + letter.toLowerCase()}>
        {letter}
      </span>
    );
    const directions = (side: 'start' | 'end') => () => {
      resetTools();
      journey.setOpen(true);
      journey.setPoint(side, projected, source, name);
    };
    const copy: ContextMenuItem = {
      id: 'copy',
      label: coordinates,
      detail: vi ? 'Sao chép' : 'Copy',
      icon: <UiIcon name="copy" size={16} />,
      onSelect: () => {
        void navigator.clipboard
          ?.writeText(coordinates)
          .then(() => showToast(['Đã sao chép tọa độ', 'Coordinates copied']));
      }
    };
    const point = measurementPoint(latitude, longitude);
    const items: ContextMenuItem[] = [
      ...(hit
        ? ([
            {
              id: 'details',
              label: vi ? 'Xem chi tiết' : 'Show details',
              icon: <UiIcon name="info" size={16} />,
              onSelect: () => handleOverlayHit(hit)
            },
            'separator'
          ] satisfies ContextMenuItem[])
        : ([copy, 'separator'] satisfies ContextMenuItem[])),
      {
        id: 'from',
        label: vi ? 'Chỉ đường từ đây' : 'Directions from here',
        icon: stop('A'),
        onSelect: directions('start')
      },
      {
        id: 'to',
        label: vi ? 'Chỉ đường đến đây' : 'Directions to here',
        icon: stop('B'),
        onSelect: directions('end')
      },
      'separator',
      ...(hit
        ? []
        : ([
            {
              id: 'here',
              label: vi ? 'Thông tin vị trí này' : "What's here?",
              icon: <UiIcon name="location" size={16} />,
              onSelect: () => {
                if (!locationOpen)
                  interaction.dispatch({ type: 'toggle-tool', tool: 'location' });
                setLocationPoint(readMapLocation(latitude, longitude, mapTerrain));
              }
            }
          ] satisfies ContextMenuItem[])),
      {
        id: 'measure',
        label: vi ? 'Đo khoảng cách từ đây' : 'Measure distance from here',
        icon: <UiIcon name="ruler" size={16} />,
        disabled: !point,
        onSelect: () => {
          if (!point) return;
          if (!measurementOpen)
            interaction.dispatch({ type: 'toggle-tool', tool: 'measure' });
          dispatchMeasureSession({ type: 'new' });
          dispatchMeasureSession({ type: 'mode', mode: 'distance' });
          dispatchMeasureSession({ type: 'points', points: [point] });
        }
      },
      {
        id: 'zoom',
        label: vi ? 'Phóng to tại đây' : 'Zoom in here',
        icon: <UiIcon name="zoomIn" size={16} />,
        onSelect: request.zoomHere
      },
      ...(hit ? (['separator', copy] satisfies ContextMenuItem[]) : [])
    ];
    setMapMenu({ x: request.clientX, y: request.clientY, title: name, items });
  };

  const reportRoad = roads.find((road) => road.id === packet.report.roadId);
  const pendingReport: [string, string] = reportRoad?.name ?? packet.report.hazard.name;
  // Apply the reviewed field report as a new assessment.
  const handleSimulateUpdate = useCallback(() => {
    if (reportApplied && !historical) return;
    resetTools();
    setReportApplied(true);
    setHistorical(false);
    setActiveDialog(null);
    showToast(['Đã cập nhật bản đồ', 'Map updated']);
  }, [showToast, reportApplied, historical, resetTools, setReportApplied, setActiveDialog]);

  const changeView = (view: WorkspaceView) => {
    rememberDetailTrigger();
    navigation.dispatch({ type: 'view', view });
    revealPanel();
  };
  const openList = (view: WorkspaceView) => {
    rememberDetailTrigger();
    navigation.dispatch({ type: 'view', view, list: true });
    revealPanel();
  };
  const closeProfile = () => {
    interaction.dispatch({ type: 'close-tool', tool: 'profile' });
    requestAnimationFrame(() => {
      const previous = profileReturnTarget.current;
      if (previous?.isConnected && previous.getClientRects().length)
        previous.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>('#response-details:not([hidden]) h1')
          ?.focus({ preventScroll: true });
    });
  };
  const toggleProfile = () => {
    if (showProfile) {
      closeProfile();
      return;
    }
    profileReturnTarget.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    interaction.dispatch({ type: 'toggle-tool', tool: 'profile' });
    setMobileView('map');
  };

  const mapResults = useMemo(
    () =>
      searchWorkspace(
        mapQuery,
        { communities, roads, hazards, responseSites, aoi: packet.aoi },
        locale
      ),
    [mapQuery, communities, roads, hazards, responseSites, packet.aoi, locale]
  );

  const openDecisionExport = () => {
    if (!selectedCommunity) return;
    setDecisionSnapshot(
      createDecisionSnapshot({
        packet,
        updated,
        community: selectedCommunity,
        assessment: assessments.get(selectedCommunity.id)!,
        route: activeRoute,
        roads,
        hazards,
        evidence,
        communities,
        responseSites,
        manualUpdatedAt: incidentSnapshot.manualUpdatedAt,
        terrainAssets: defaultTerrainData
          ? scenarioManifest?.terrain
          : undefined
      })
    );
    setActiveDialog('exportDecision');
  };

  const mapCaseAvailable=!otherMapTool&&!journey.open&&!activeDialog&&!guidanceTarget;
  const activateOverview=()=>{
    setLocalAreaId(null);setLocalRoadId(null);setHouseholdId(null);setGisCardId(null);setGisGroupIds([]);
    navigation.dispatch({type:'view',view:navigation.view,list:true});journey.setOpen(false);resetTools();
  };
  const responseDetailSelected =
    snapshotReady &&
    Boolean(
      gisCard || (view === 'priority'
        ? selectedCommunity && selectedRoutePair
        : selectedObjectId)
    );
  const responseDetailVisible =
    responseDetailSelected &&
    !panelCollapsed &&
    !measurementOpen &&
    !drawOpen &&
    !locationOpen &&
    !journey.open &&
    (Boolean(gisCard) || gisGroup.length < 2) &&
    !activeDialog && !guidanceTarget;
  // A detail panel opening folds the overview and the legend: one secondary surface at a time.
  useEffect(() => { if (responseDetailVisible) openMapSurface('detail'); }, [responseDetailVisible]);
  useEffect(() => {
    if(showProfile || journey.open)return; // The active route tool owns framing.
    const selection = view === 'priority' ? selectedObjectId ?? (selectedCommunityId && `community:${selectedCommunityId}`) : selectedObjectId;
    if (!selection || gisCard || gisGroup.length > 1) return;
    if (window.matchMedia('(max-width:900px)').matches && mobileView !== 'map') return;
    let firstFrame = 0,
      secondFrame = 0;
    const focusSelection = () => {
      const frame = mapSelectionFrame({ roads, hazards, communities, responseSites, aoi: packet.aoi }, selection,
        selection.startsWith('community:') && cameraIntent.kind === 'route' ? (activeRoute?.segs.find(road=>road.id===navigation.routeSectionId)?.points ?? activeRoute?.points) : undefined);
      if (!frame.length) return;
      // The dock floats over the map: centre the selection in the uncovered part.
      const reserve = responseDetailVisible && detailLayout.mode === 'dock' ?
        parseFloat(
          getComputedStyle(workspaceRef.current ?? document.documentElement).getPropertyValue(
            '--response-detail-reserve'
          )
        ) || 0 : 0;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (viewControlRef.current?.frameProjected) viewControlRef.current.frameProjected(frame,{right:reserve});
          else viewControlRef.current?.focusProjected(frame[Math.floor(frame.length / 2)], { right: reserve });
        });
      });
    };
    focusSelection();
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [
    responseDetailVisible,
    view,
    detailLayout.mode,
    selectedCommunityId,
    selectedObjectId,
    mapMode,
    viewReadyVersion,
    navigation.routeSectionId,
    showProfile,
    journey.open,
    cameraIntent,
    activeRoute,
    mobileView,
    roads,
    communities,
    hazards,
    responseSites,
    packet.aoi,
    gisCard,
    gisGroup.length
  ]);

  return (
    <div
      ref={workspaceRef}
      className="workspace workspace-shell"
      data-response-gis-detail={!journey.open && !locationOpen && !measurementOpen && !drawOpen && (mapMode === '2d' || !!gisCard && (!!landslideAreaOf(gisCard) || !!gisCard.feature.properties.sourceDatasetId)) && (Boolean(gisCard) || gisGroup.length > 1)}
      data-gis-open={activeDialog === 'geodata'}
      data-mobile={mobileView}
      data-timeline-expanded={timelineExpanded}
      data-header-collapsed={headerCollapsed}
      data-panel-collapsed={panelCollapsed}
      data-response-detail={responseDetailVisible}
      data-response-layout={detailLayout.mode}
      data-response-profile={showProfile && !!profileTarget}
    >
      {guidanceTarget&&localNetwork.network&&<GuidanceDialog network={localNetwork.network} bases={bases} target={guidanceTarget} locale={locale} activeTeam={rescueDispatch.order?.target.id===guidanceTarget.id&&!rescueDispatch.order.recalledAt?rescueDispatch.order.teamId:null} onOpenTeam={()=>{setGuidanceTarget(null);if(rescueDispatch.order)selectTeam(rescueDispatch.order.teamId);}} proposal={guidanceProposal} onIssue={(destination,roadIds)=>{if(destination&&rescueDispatch.order?.target.id===guidanceTarget.id&&!rescueDispatch.order.recalledAt)return false;const current=deviceFeed?.getSnapshot().find(device=>device.id===guidanceTarget.id);const saved=guidance.issue(current?{...guidanceTarget,point:current.point}:guidanceTarget,destination,identity.name,roadIds);if(saved)showToast([`Đã gửi hướng dẫn cho ${guidanceTarget.name[0]}.`,`Guidance sent to ${guidanceTarget.name[1]}.`]);return saved;}} onClose={()=>setGuidanceTarget(null)}/>}
      <AppHeader rescueAlerts={liveAlerts} onRescueOpen={showGisOnResponse}
        locked={activeDialog === 'geodata'}
        collapsed={headerCollapsed}
        onCollapse={() => {setHeaderCollapsed(true);requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLButtonElement>('.map-header-restore')?.focus());}}
        locale={locale}
        incident={incident}
        areaName={packet.aoi.name}
        snapshotDisplay="date"
        report={packet.report}
        reportRoad={roads.find((road) => road.id === packet.report.roadId)}
        dataAvailable={snapshotReady}
        theme={theme}
        fontChoice={fontChoice}
        onOpenReports={() => setActiveDialog('fieldReports')}
        reportsPending={gis.records.some(record => { const submission = submissionOf(record); return submission?.role === 'resident' && submission.review.status === 'pending'; })}
        identityName={locale === 'en' ? 'Response coordinator' : identity.name}
        onSignOut={onSignOut}
        onOpenHelp={() => setActiveDialog('help')}
        updated={updated}
        reportApplied={reportApplied}
        alertRead={alertRead}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onToggleLocale={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
        onChangeFontChoice={setFontChoice}
        onOpenAlerts={() => {
          setAlertRead(true);
          setActiveDialog('alerts');
        }}
        onOpenData={() => setActiveDialog('data')}
        onOpenIncident={() => {
          setAlertRead(true);
          setActiveDialog(null);
          openList('incident');
        }}
        onOpenUpload={() => setActiveDialog('upload')}
        onOpenTimeline={() => setActiveDialog('timeline')}
        onOpenNotifications={() => {
          setAlertRead(true);
          setActiveDialog('notificationCenter');
        }}
        onReset={() => {
          work.reset();
          dispatchMeasureSession({ type: 'reset' });
          dispatchDrawSession({ type: 'discard' });
          setPanelCollapsed(false);
          setTimelineExpanded(false);
          setHeaderCollapsed(false);
          setLocationPoint(null);
          setReportApplied(false);
          setHistorical(false);
          setAlertRead(false);
          navigation.dispatch({ type: 'reset' });
          interaction.dispatch({ type: 'reset' });
          setMapQuery('');
          setDecisionSnapshot(null);
          setMobileView('map');
          viewControlRef.current?.resetView();
          setLayerAppearance(defaultLayerAppearance);
          setLayers({ ...defaultLayers, context: !offlineMode || runtime.localMap });
          analysisImagery.resetSelection();
          terrainOverlays.suspendSar();
          setComparisonPair(null);
          map2DViewport.current = null;
          if (!defaultTerrainData) reloadTerrain();
          showToast(['Đã đặt lại phiên làm việc', 'Workspace reset']);
        }}
      />

      <main className="work-area">
        <WorkspaceNav view={view} locale={locale} onChangeView={changeView} rescue={bases.length > 0} />
        <ResponsePanel residentDevices={!historical&&<ResidentDeviceList selectedId={selectedDeviceId} feed={deviceFeed} roads={journeyRoads} locale={locale} onSelect={selectDevice} records={gis.records}/>}
          fieldPhotos={fieldPhotos}
          survey={!historical && runtime.fieldDataset ? {areas:gis.records.filter(r => r.feature.properties.sourceDatasetId === runtime.fieldDataset!.id && r.feature.geometry.type !== 'Point').length,points:gis.records.filter(r => r.feature.properties.sourceDatasetId === runtime.fieldDataset!.id && r.feature.geometry.type === 'Point').length} : undefined}
          onShowCorridor={!historical && gis.records.some(r => r.feature.properties.referenceKind === 'road-corridor') ? () => {
            const corridor = gis.records.find(r => r.feature.properties.referenceKind === 'road-corridor');
            if (corridor) {setMapMode('2d'); showGisOnResponse(corridor.id);}
          } : undefined}
          onShowSurvey={showMappedAreas}
          locale={locale}
          navigation={navigation}
          onNavigate={navigation.dispatch}
          snapshot={incidentSnapshot}
          aoi={packet.aoi}
          updated={updated}
          workTasks={workTasks}
          workEntries={work.entries}
          reportPending={!reportApplied}
          pendingReport={pendingReport}
          onApplyReport={handleSimulateUpdate}
          historical={historical && reportApplied}
          onOpenWork={(id) => {
            setWorkTaskId(id ?? null);
            setActiveDialog('responseWork');
          }}
          onOpenReport={() => setActiveDialog('alerts')}
          ready={snapshotReady}
          unavailable={startupError}
          onRetry={retryTerrain}
          onSelectCommunity={selectCommunity}
          onInspectObject={inspectObject}
          onRevealPanel={revealPanel}
          onOpenDialog={setActiveDialog}
          households={householdViews}
          onSelectHousehold={inspectHousehold}
          onShowHouseholds={showHouseholds}
          communityExtra={!historical&&<CommuneVillages villages={villages} entryName={bases[0]?.name} locale={locale}
            onSelectVillage={village=>focusMapOn([village.place.projected,...village.huts.map(item=>item.projected)])} onSelectHuts={inspectHousehold}/>}
          rescueView={<RescueView feed={historical?null:deviceFeed} bases={bases} locale={locale} selectedId={navigation.objectIds.rescue}
            onSelectTeam={selectTeam} onSelectBase={id=>inspectObject('poi:'+id)}
            onShowAll={()=>{const teams=deviceFeed?.getSnapshot().filter(device=>device.role==='rescue')??[];if(teams.length)focusMapOn([...teams.map(team=>team.point),...bases.map(base=>base.projected)]);}}/>}
        />

        <ResponseDetails onDispatchReport={historical?undefined:dispatchReport}
          renderObject={(objectId,close)=>objectId.startsWith('device:')?<ResidentDeviceDetail onReviewProposal={record=>{const proposal=routeProposalOf(record.feature.properties.dearRouteProposal),device=deviceFeed?.getSnapshot().find(d=>d.id===selectedDeviceId);if(!proposal||!device||!localNetwork.network)return;
            const roadIds=localNetwork.network.roads.filter(road=>proposal.roadIds.some(id=>id===road.id||id.startsWith(road.id+':part:'))).map(road=>road.id);
            setGuidanceProposal({destination:{id:'proposal:'+record.id,name:proposal.name,projected:proposal.end},roadIds});setGuidanceTarget({id:device.id,name:device.name,point:device.point});}}
            onGuidance={()=>{setGuidanceProposal(null);const device=deviceFeed?.getSnapshot().find(d=>d.id===selectedDeviceId);if(device)setGuidanceTarget({id:device.id,name:device.name,point:device.point});}} onDispatch={()=>{const device=deviceFeed?.getSnapshot().find(d=>d.id===selectedDeviceId);if(device)dispatchTo({id:device.id,name:device.name,point:device.point});}}
                  onApproach={()=>{const device=deviceFeed?.getSnapshot().find(d=>d.id===selectedDeviceId);if(device)inspectApproach({id:device.id,name:device.name,point:device.point});}}
                  onShowTeam={selectTeam} feed={deviceFeed} id={objectId.slice(7)} roads={journeyRoads} locale={locale} onClose={close} onShow={point=>focusMapOn([point])} onRoad={id=>handleOverlayHit({type:'road',id})} records={gis.records} onReport={id=>showGisOnResponse(id)}/>:objectId.startsWith('team:')?<RescueTeamDetail onRecall={objectId.slice(5)===rescueDispatch.order?.teamId&&!rescueDispatch.order?.recalledAt?()=>{if(!rescueDispatch.recall())showToast(['Chưa lưu được lệnh gọi đội về.','Recall could not be saved.']);}:undefined} onRoad={id=>handleOverlayHit({type:'road',id})} key={objectId} feed={deviceFeed} id={objectId.slice(5)} bases={bases} locale={locale} onClose={close}
            onShow={point=>focusMapOn([point])} onSelectBase={id=>inspectObject('poi:'+id)}
            onSelectTarget={team=>{
              if(team.missionId?.startsWith('household:'))inspectHousehold(team.missionId.slice(10));
              else{const target=deviceFeed?.getSnapshot().find(device=>device.id===team.targetId);if(target)focusMapOn([target.point]);}
            }}/>:null}
          siteContent={id=>bases.some(base=>base.id===id)&&<RescueTeamList feed={deviceFeed} locale={locale} onSelect={selectTeam} baseId={id} title={locale==='vi'?'Đội tại điểm này':'Teams based here'}/>}
          onCompareImagery={()=>setActiveDialog('comparison')}
          gisRecord={gisCard}
          gisRecords={gis.records}
          gisRoads={gisCard && landslideAreaOf(gisCard)?.networkVersion === packet.datasetVersion ? roads : []}
          onCloseGis={() => {setGisCardId(null);setGisGroupIds([]);}}
          onEditGis={() => {if(gisCard){gis.select(gisCard.id);setActiveDialog('geodata');}}}
          onBackToGisGroup={gisCard && gisGroup.length > 1 && gisGroupIds.includes(gisCard.id) ? () => {setGisCardId(null);setMobileView('map');} : undefined}
          fieldPhotos={fieldPhotos}
          locale={locale}
          mappedAreas={historical ? [] : gis.records.filter(record => landslideAreaOf(record))}
          onOpenMappedArea={showGisOnResponse}
          onEditScenario={!historical ? target => {setGisScenarioRequest(target);setActiveDialog('geodata');} : undefined}
          scenarioEdits={historical ? undefined : scenarioEdits?.edits}
          signals={packet.signals}
          workTasks={workTasks}
          workEntries={work.entries}
          onOpenWork={(id) => {
            setWorkTaskId(id ?? null);
            setActiveDialog('responseWork');
          }}
          onSetRoadStatus={!historical && scenarioEdits?.canEdit ? (road, status, note) => scenarioEdits.record({
            target: { type: 'road', id: road.id, name: road.name[0] }, change: { kind: 'status', from: road.status, to: status }, note }) : undefined}
          onRevertEdit={!historical && scenarioEdits?.canEdit ? id => revertRoadStatus(scenarioEdits, id) : undefined}
          navigation={navigation}
          onNavigate={navigation.dispatch}
          snapshot={incidentSnapshot}
          aoi={packet.aoi}
          ready={snapshotReady}
          community={selectedCommunity}
          routePair={selectedRoutePair}
          terrainCoverage={communityTerrainCoverage}
          hasTerrainProfile={Boolean(
            routeProfile?.samples.some(
              (sample) => sample.elevation !== undefined
            )
          )}
          profileOpen={showProfile}
          onToggleProfile={toggleProfile}
          onSelectRouteSection={selectRouteSection}
          onChangeRoute={(selectedRouteType) => {
            navigation.dispatch({
              type: 'filters',
              values: { selectedRouteType }
            });
            setFocusDistance(null);
            setCameraIntent(previous=>({kind:'route',version:previous.version+1}));
          }}
          onSelectCommunity={selectCommunity}
          onInspectObject={inspectObject}
          onRevealPanel={revealPanel}
          onResetTools={resetTools}
          onOpenDialog={setActiveDialog}
          onOpenEvidence={(hazardId) => {
            setEvidenceModalId(hazardId);
            setActiveDialog('evidence');
          }}
          onExport={openDecisionExport}
          visible={responseDetailVisible}
          onReturnFocus={returnDetailFocus}
        />


        <PanelResizeHandle locale={locale} />

        <section
          className="map-area"
          aria-label={locale === 'vi' ? 'Bản đồ ứng phó' : 'Response map'}
          data-profile={showProfile && !!profileTarget}
          data-locating={locationOpen}
        >
          {historical && reportApplied && (
            <RevisionNotice
              locale={locale}
              timestamp={incident.asOf}
              onLatest={() => setHistorical(false)}
            />
          )}
          <div className="map-canvas">
            {mapMode === '2d' ? (
              <Map2D onOpenOverview={activateOverview} showOverview={activeDialog!=='layers'} selectedDeviceId={selectedDeviceId} onSelectDevice={selectDevice} deviceFeed={layers.devices!==false?deviceFeed:null} contextGeometry={localContext} selectedContextAreaId={localAreaId} onSelectContextArea={inspectLocalArea}
                households={layers.households!==false?householdViews:[]} selectedHouseholdId={household?.cluster.id??null} onSelectHousehold={inspectHousehold} rescueCoverage={rescueCoverage} rescueCoverageOnMap={layers.rescueCoverage===true}
                analysisImagery={analysisDisplay}
                gisEnabled={true}
                gisRecords={responseMapRecords}
                gisSelectedId={gisCardId}
                gisRequest={gisResponseView}
                onGisSelect={inspectGisRecord}
                gisGroupIds={gisGroupIds}
                onGisGroup={(ids) => {
                  navigation.dispatch({type:'view',view:navigation.view,list:true});
                  setPanelCollapsed(false);
                  setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);resetTools();setMobileView('map');
                  setGisGroupIds(ids);
                  setGisCardId(null);
                }}
                terrain={mapTerrain}
                profileOpen={showProfile}
                profilePoints={showProfile ? profileTarget?.points : undefined}
                pointPickActive={journey.open && !!journey.picking}
                onPointPick={journey.pick}
                onMapContextMenu={snapshotReady ? openMapMenu : undefined}
                journeyEndpoints={journeyMarkers(journey)}
                journeyFitRequest={journey.fitSequence}
                locationOpen={locationOpen}
                locationPoint={locationPoint}
                onLocation={setLocationPoint}
                measurementOpen={measurementOpen}
                measureSession={measureSession}
                dispatchMeasureSession={dispatchMeasureSession}
                onCloseMeasurement={() => {
                  interaction.dispatch({ type: 'close-tool', tool: 'measure' });
                  focusMapTool('.map-measure-trigger');
                }}
                drawOpen={drawOpen}
                drawSession={drawSession}
                dispatchDrawSession={dispatchDrawSession}
                onCloseDraw={() => {
                  interaction.dispatch({ type: 'close-tool', tool: 'draw' });
                  focusMapTool('.map-draw-trigger');
                }}
                onSaveDrawing={(record) => {
                  // A drawing is GIS reference data: it is listed and exported with imported layers.
                  gis.add([record]);
                  setLayers((previous) => ({ ...previous, gis: true }));
                  showToast([
                    drawingMessages.vi.saved.replace('{name}', record.name),
                    drawingMessages.en.saved.replace('{name}', record.name)
                  ]);
                }}
                imageUrl={
                  defaultTerrainData
                    ? scenarioManifest?.terrain.image?.url
                    : undefined
                }
                viewportRef={map2DViewport}
                locale={locale}
                focusPoint={showProfile ? focusPoint : null}
                profileMetadata={analysisTerrain?.metadata}
                onBasemapState={setBasemapState}
                scenarioProps={
                  snapshotReady && scenarioTerrainCompatible
                    ? {
                        datasetVersion: packet.datasetVersion,
                        aoi: packet.aoi,
                        communities: communities,
                        responseSites: responseSites,
                        hazards: mapHazards,
                        roads,
                        contextRoads:localNetwork.network?.roads,
                        roadAreaLinks,
                        selectedRoute: journey.open
                          ? journey.route
                          : activeRoute,
                        selectedCommunityId: gisCard || view !== 'priority' ? null : selectedCommunityId,
                        selectedObjectId: localRoad ? `road:${localRoad.id}` : gisCard ? null : selectedObjectId,
                        layers,
                        appearance: layerAppearance
                      }
                    : undefined
                }
                onSelectOverlayHit={handleOverlayHit}
                viewControlRef={viewControlRef}
                onViewReady={onViewReady}
              />
            ) : (
              <Map3DBoundary onUnavailable={handle3DUnavailable}>
                <React.Suspense
                  fallback={terrain3DBusy ? null : terrainLoading(null)}
                >
                  <TerrainViewer selectedDeviceId={selectedDeviceId} onSelectDevice={selectDevice} deviceFeed={layers.devices!==false?deviceFeed:null}
                    households={layers.households!==false?householdViews:[]} selectedHouseholdId={household?.cluster.id??null} onSelectHousehold={inspectHousehold} rescueCoverage={rescueCoverage} rescueCoverageOnMap={layers.rescueCoverage===true}
                    pointPickActive={journey.open && !!journey.picking}
                    onPointPick={journey.pick}
                    routeEndpoints={journeyTerrainEndpoints}
                    contextGeometry={localContext} selectedContextAreaId={localAreaId} onSelectContextArea={inspectLocalArea}
                    analysisImagery={analysisDisplay}
                    surfaceLayers={layers}
                    terrainOverlays={terrainOverlays.options}
                    onTerrainOverlayStatus={(kind, message) => kind === 'sar' ? terrainOverlays.setError(message) : terrainOverlays.setStatus(message)}
                    models={models}
                    onOrbitChange={setOrbiting}
                    gisRecords={responseMapRecords}
                    gisSelectedId={gisCardId}
                    onGisSelect={inspectGisRecord}
                    geographicPlacements={geographicPlacements}
                    measureMode={locationOpen}
                    onPick={handlePick}
                    profile={showProfile ? routeProfile : null}
                    profileMetadata={analysisTerrain?.metadata}
                    focusPoint={
                      locationOpen
                        ? locationPoint?.scene
                        : showProfile
                          ? focusPoint
                          : null
                    }
                    mapMode={mapMode}
                    theme={theme}
                    locale={locale}
                    onBasemapState={setBasemapState}
                    scenarioProps={
                      snapshotReady && scenarioTerrainCompatible
                        ? {
                            datasetVersion: packet.datasetVersion,
                            aoi: packet.aoi,
                            communities: communities,
                            responseSites: responseSites,
                            hazards: mapHazards,
                            roads: roads,
                            contextRoads:localNetwork.network?.roads,
                            roadAreaLinks,
                            selectedRoute: journey.open ? journey.route : activeRoute,
                            selectedCommunityId: gisCard || view !== 'priority' ? null : selectedCommunityId,
                            selectedObjectId: localRoad ? `road:${localRoad.id}` : gisCard ? null : selectedObjectId,
                            layers: layers,
                            appearance: layerAppearance
                          }
                        : undefined
                    }
                    onSelectOverlayHit={handleOverlayHit}
                    viewControlRef={viewControlRef}
                    onViewReady={onViewReady}
                    onUnavailable={handle3DUnavailable}
                    flyover={snapshotReady && scenarioTerrainCompatible ? flyoverInput : null}
                    onFlyoverState={setFlyoverState}
                  />
                </React.Suspense>
              </Map3DBoundary>
            )}
          </div>

          {mapMode === '3d' && defaultTerrainData && rescueCoverage && <MapOverview onActivate={activateOverview}
            terrain={defaultTerrainData} imageUrl={scenarioManifest?.terrain.image?.url}
            coverage={rescueCoverage} locale={locale} viewControlRef={viewControlRef} viewVersion={viewReadyVersion}
            enabled={activeDialog!=='layers' && !otherMapTool && !showProfile && !['playing','loading','paused','exporting'].includes(flyoverState.status)}
            onNavigate={point => { const host = workspaceRef.current?.querySelector<HTMLElement>('.map-area'); viewControlRef.current?.focusProjected(point, host ? detailInset(host) : undefined); }}/>}

          {mapCaseAvailable&&household&&presence&&!localArea&&!localRoad&&<HouseholdCard key={household.cluster.id} item={household} areaName={householdAreaName} locale={locale} onClose={()=>setHouseholdId(null)}
            workStatus={(()=>{const task=workTasks.find(item=>item.id===`household:${household.cluster.id}`);return task?workState(task,work.entries).status:undefined;})()}
            onDispatch={historical?undefined:()=>dispatchTo({id:`household:${household.cluster.id}`,name:household.cluster.name,point:household.projected})}
            onWork={historical?undefined:()=>{setWorkTaskId(`household:${household.cluster.id}`);setActiveDialog('responseWork');}}
            onDirections={()=>inspectApproach({id:`household:${household.cluster.id}`,name:household.cluster.name,point:household.projected})}
            helipad={(()=>{const pad=localNetwork.network?.places.filter(place=>place.kind==='hlz').map(place=>({place,d:Math.hypot(place.projected.x-household.projected.x,place.projected.y-household.projected.y)})).sort((a,b)=>a.d-b.d)[0];
              return pad?{name:[pad.place.name.replace(/^Helipad$/,'Bãi đáp'),pad.place.name] as [string,string],distanceKm:pad.d/1000}:undefined;})()}
            team={(()=>{const sent=householdTeams.find(entry=>entry.householdId===household.cluster.id);return sent&&deviceFeed?{feed:deviceFeed,id:sent.plan.id,onShow:point=>focusMapOn([point])}:undefined;})()}/>}
          {mapCaseAvailable&&localArea&&<LocalAreaCard key={localArea.id} area={localArea} photos={fieldPhotos} locale={locale} onClose={()=>setLocalAreaId(null)} linkToJourney/>}
          {mapCaseAvailable&&localRoad&&layers.roads&&layers.localRoads!==false&&<LocalRoadCard road={localRoad} locale={locale} onClose={()=>setLocalRoadId(null)} onDirections={()=>{setLocalRoadId(null);resetTools();journey.setOpen(true);}}/>}
          {mapMode === '3d' && terrain3DBusy
            ? terrainLoading(progress3D)
            : !mapTerrain &&
              uploadBusy && (
                <div className="map-load-state" role="status">
                  {locale === 'vi'
                    ? 'Đang mở bản đồ địa hình'
                    : 'Opening terrain map'}
                </div>
              )}
          {!mapTerrain && startupError && (
            <div className="map-load-state" role="alert">
              <strong>
                {locale === 'vi'
                  ? 'Không mở được bản đồ địa hình'
                  : 'Terrain map could not be opened'}
              </strong>
              <button className="button soft" onClick={retryTerrain}>
                {locale === 'vi' ? 'Thử lại' : 'Retry'}
              </button>
            </div>
          )}
          {models.length > 0 && !scenarioTerrainCompatible && (
            <p className="map-model-note" role="status">
              {locale === 'vi'
                ? 'Chưa ghép lớp sự kiện: cần lưới độ cao và hệ tọa độ EPSG:32648.'
                : 'Incident layers require an elevation grid in EPSG:32648.'}
            </p>
          )}

          <MapControls onActivateMapContext={activateOverview} hasLocationDevices={Boolean(deviceFeed?.getSnapshot().length)}
            hasLocalRoads={!!localNetwork.network}
            householdStatuses={layers.households!==false?householdViews.map(item=>item.status):[]}
            timelineExpanded={timelineExpanded}
            onToggleTimeline={() => setTimelineExpanded(open => !open)}
            headerCollapsed={headerCollapsed}
            onShowHeader={() => {setHeaderCollapsed(false);requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLButtonElement>('.settings-anchor > button')?.focus());}}
            journeyControl={<button
              className="icon-button map-journey-trigger"
              title={
                locale === 'vi'
                  ? 'Tìm đường giữa hai điểm'
                  : 'Directions between two points'
              }
              aria-label={
                locale === 'vi'
                  ? 'Tìm đường giữa hai điểm'
                  : 'Directions between two points'
              }
              aria-pressed={journey.open}
              onClick={() => {
                resetTools();
                setLocalAreaId(null);setHouseholdId(null);setLocalRoadId(null);setGisCardId(null);setGisGroupIds([]);
                journey.setOpen(!journey.open);
              }}
            >
              <UiIcon name="route" /><span>{locale === 'vi' ? 'Tìm đường' : 'Directions'}</span>
            </button>}
            flyoverControl={snapshotReady && (flyoverInput || localNetwork.network) && !historical && <FlyoverBar locale={locale} state={flyoverState} mapMode={mapMode} disabled={!flyoverInput} networkJourney={!!localNetwork.network}
            onOpen={()=>{resetTools();journey.setOpen(false);setActiveDialog(null);setLocalRoadId(null);setLocalAreaId(null);setHouseholdId(null);setGisCardId(null);setGisGroupIds([]);}}
            title={flyoverInput ? locale === 'vi' ? `Từ ${flyoverInput.start[0]} đến ${flyoverInput.end[0]}` : `${flyoverInput.start[1]} to ${flyoverInput.end[1]}` : undefined}
            fileName={flyoverInput ? `hanh-trinh-${[flyoverInput.start[1], flyoverInput.end[1]].join('-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp4` : 'DEAR-route.mp4'}
            onRequest3D={() => setMapMode('3d')} controlRef={viewControlRef}/>}
            mappedAreas={displayedGis}
            panelCollapsed={panelCollapsed}
            onTogglePanel={() => setPanelCollapsed((value) => !value)}
            locale={locale}
            mapMode={mapMode}
            onChangeMapMode={setMapMode}
            onZoomIn={() => viewControlRef.current?.zoomIn()}
            onZoomOut={() => viewControlRef.current?.zoomOut()}
            onResetView={() => viewControlRef.current?.resetView()}
            onOpenGis={() => setActiveDialog('geodata')}
            onCompareImagery={() => setActiveDialog('comparison')}
            gisObservations={
              mapMode === '2d' && layers.gis
                ? gis.records
                    .filter((record) => record.visible)
                    .flatMap((record) => {
                      const observation = observationOf(record);
                      return observation ? [observation.kind] : [];
                    })
                : []
            }
            onOpenLayers={() => {setLayerSection('map');setActiveDialog(activeDialog==='layers'?null:'layers');}}
            orbiting={orbiting}
            onToggleOrbit={() => viewControlRef.current?.setOrbit?.(!orbiting)}
            layersOpen={activeDialog === 'layers'}
            layers={scenarioTerrainCompatible ? layers : {}}
            hazards={scenarioTerrainCompatible ? hazards : []}
            hasSelectedRoute={scenarioTerrainCompatible && Boolean(activeRoute)}
            hasHLZData={
              scenarioTerrainCompatible &&
              responseSites.some((site) => site.kind === 'hlz')
            }
            measuring={measurementOpen}
            drawing={drawOpen}
            onDraw={() => interaction.dispatch({ type: 'toggle-tool', tool: 'draw' })}
            locating={locationOpen}
            onLocation={() =>
              interaction.dispatch({ type: 'toggle-tool', tool: 'location' })
            }
            affectedOnly={layerAppearance.roads === 'affected'}
            onMeasure={() =>
              interaction.dispatch({ type: 'toggle-tool', tool: 'measure' })
            }
          >
            <MapSearch
              locale={locale}
              query={mapQuery}
              onQuery={setMapQuery}
              results={mapResults}
              disabled={!snapshotReady}
              onSelect={(result) => {
                setPanelCollapsed(false);
                const [kind, id] = result.key.split(':');
                const hazard =
                  kind === 'hazard'
                    ? hazards.find((h) => h.id === id)
                    : undefined;
                const site =
                  kind === 'poi'
                    ? responseSites.find((s) => s.id === id)
                    : undefined;
                const layer =
                  kind === 'community'
                    ? 'communities'
                    : kind === 'road'
                      ? 'roads'
                      : kind === 'aoi'
                        ? 'aoi'
                        : (site?.kind ??
                          (hazard?.kind === 'landslide'
                            ? 'landslide'
                            : hazard?.kind === 'flood'
                              ? 'flood'
                              : 'crossings'));
                setLayers((previous) => ({ ...previous, [layer]: true }));
                if (kind === 'community') selectCommunity(id);
                else inspectObject(result.key);
                if (kind !== 'community') viewControlRef.current?.focusProjected(result.projected);
              }}
            />
          </MapControls>

          <MapAttribution
            analysisSource={analysisSourceInfo(analysisImagery.layers,analysisImagery.selection,locale)}
            osmReference={layers.gis && displayedGis.some(r => r.visible && r.feature.properties.referenceKind === 'road-corridor')}
            fieldSource={runtime.fieldDataset?.records[0]?.source.name}
            terrainDisplay={mapMode === '3d' && models[0]?.metadata ? {exaggeration:models[0].metadata.elevation.exaggeration * (geographicPlacements?.[0]?.scaleY ?? 1)} : undefined}
            locale={locale}
            state={basemapState}
            onRetry={() => viewControlRef.current?.retryBasemap()}
            localSource={
              mapTerrain
                ? defaultTerrainData
                  ? (models.length > 1 ? ['DEM Chế Tạo và Lao Chải', 'Chế Tạo and Lao Chải DEMs'] : ['Ảnh nền và địa hình', 'Imagery and terrain'])
                  : [
                      'Lưới độ cao từ mô hình đã tải lên',
                      'Elevation grid from the uploaded model'
                    ]
                : undefined
            }
          />
          {journey.open && !activeDialog && !guidanceTarget && !localArea && !localRoad && !gisCard && (
            <RoadJourneyPanel
              locale={locale}
              journey={journey}
              communities={communities}
              sites={responseSites}
              roads={journeyRoads}
              places={[...(localNetwork.network?.places??[]).map(place=>({key:`local:${place.id}`,label:locale==='vi'?place.name.replace(/^Village /,'Bản ').replace(/^Helipad$/,'Bãi đáp'):place.name,
                group:locale==='vi'?'Trong xã Chế Tạo':'Within Chế Tạo',latitude:place.latitude,longitude:place.longitude,
                roadIds:localJourneyRoadIds})),
                ...householdViews.filter(item=>item.status!=='clear').map(item=>({key:`household:${item.cluster.id}`,label:item.cluster.name[locale==='vi'?0:1],
                  group:locale==='vi'?'Hộ dân':'Households',latitude:item.cluster.latitude,longitude:item.cluster.longitude,roadIds:localJourneyRoadIds})),
                ...(layers.gis ? gisJourneyPlaces(gis.records) : [])]}
              onProfile={() =>
                interaction.dispatch({ type: 'toggle-tool', tool: 'profile' })
              }
            />
          )}
          {mapMode === '2d' &&
            !journey.open &&
            layers.gis &&
            !gisCard &&
            mapCaseAvailable && gisGroup.length > 1 && !localRoad && !localArea && !household && !selectedObjectId &&
            !locationOpen &&
            !measurementOpen &&
            !drawOpen && (
              <PointGroupCard
                records={gisGroup}
                locale={locale}
                activeId={null}
                openLabel={locale === 'vi' ? 'Xem chi tiết' : 'View details'}
                onOpen={id => inspectGisRecord(id, true)}
                onClose={() => setGisGroupIds([])}
              />
            )}
          {locationOpen && (
            <MapLocationPanel
              locale={locale}
              point={locationPoint}
              onClose={closeLocation}
            />
          )}

          {activeDialog === 'layers' && (
            <LayersDialog
              initialSection={layerSection}
              coverage={rescueCoverage ? {layers:coverageLayers,toggle:(key)=>setCoverageLayers(value=>({...value,[key]:!value[key]}))}:undefined}
              hasLocalRoads={!!localNetwork.network} onShowLocalRoads={showLocalRoads}
              onShowAnalysisImagery={()=>{
                const points=analysisImagery.rasters.flatMap(raster=>{
                  const [left,bottom,right,top]=raster.terrain.bounds;
                  return [{x:left,y:bottom},{x:right,y:top}];
                });
                setActiveDialog(null);
                requestAnimationFrame(()=>viewControlRef.current?.frameProjected?.(points));
              }}
              terrainOverlays={terrainOverlays}
              analysisImagery={imageryControls}
              hasTerrainGrid={models.some(model => Boolean(model.grid && model.metadata?.analysis_supported))}
              locale={locale}
              imageryPreview={
                defaultTerrainData
                  ? scenarioManifest?.terrain.image?.url
                  : undefined
              }
              layers={layers}
              appearance={layerAppearance}
              mapMode={mapMode}
              onAppearance={setLayerAppearance}
              hasFloodData={hazards.some((hazard) => hazard.kind === 'flood')}
              hasHLZData={responseSites.some((site) => site.kind === 'hlz')}
              hasSelectedRoute={Boolean(activeRoute)}
              hasIncidentLayers={scenarioTerrainCompatible}
              areaCount={historical ? 0 : gis.records.filter(record => record.visible && landslideAreaOf(record)).length}
              onShowAreas={showMappedAreas}
              onReset={() => {
                setLayers({...defaultLayers, context:!offlineMode || runtime.localMap});
                analysisImagery.resetSelection();
                setCoverageLayers(defaultCoverageLayers);
                terrainOverlays.suspendSar();
                setLayerAppearance(defaultLayerAppearance);
              }}
              onToggleLayer={(layerId) =>
                setLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }))
              }
              onClose={() => setActiveDialog(null)}
            />
          )}

          {showProfile && profileTarget && (
            <ProfileDrawer
              key={profileTarget.id}
              name={profileTarget.name[locale === 'vi' ? 0 : 1]}
              locale={locale}
              profile={routeProfile}
              onHoverDistance={setFocusDistance}
              onClose={closeProfile}
            />
          )}
        </section>
      </main>

      <nav
        className="mobile-view-switch"
        aria-label={locale === 'vi' ? 'Chế độ xem' : 'View'}
      >
        <button
          aria-pressed={mobileView === 'info'}
          onClick={() => setMobileView('info')}
        >
          {locale === 'vi' ? 'Thông tin' : 'Information'}
        </button>
        <button
          aria-pressed={mobileView === 'map'}
          onClick={() => setMobileView('map')}
        >
          {locale === 'vi' ? 'Bản đồ' : 'Map'}
        </button>
      </nav>

      <AssessmentTimeline expanded={timelineExpanded} onCollapse={() => {setTimelineExpanded(false);requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLButtonElement>('.map-timeline-toggle')?.focus());}} locale={locale} packet={packet} applied={reportApplied} historical={historical} onRevision={setHistorical} onReport={() => setActiveDialog('alerts')} onJournal={() => setActiveDialog('timeline')}/>

      <WorkspaceDialogs
        comparisonRecord={gisCard}
        identity={identity}
        onRename={onRename}
        scenarioEdits={historical ? undefined : scenarioEdits}
        scenarioRequest={gisScenarioRequest}
        onResponseScenario={target => {
          inspectObject(`${target.type === 'site' ? 'poi' : target.type}:${target.id}`);
          setMapMode('2d');setMobileView('map');setActiveDialog(null);setGisScenarioRequest(null);
        }}
        onEditGis={(id) => {
          gis.select(id);
          setActiveDialog('geodata');
        }}
        gisSession={gis}
        onGisResponse={showGisOnResponse}
        dialog={interaction.dialog}
        offline={offlineMode}
        locale={locale}
        packet={packet}
        snapshot={incidentSnapshot}
        updated={updated}
        reportApplied={reportApplied}
        historical={historical}
        workTasks={workTasks}
        workTaskId={workTaskId}
        workEntries={work.entries}
        workStorageError={work.error}
        onRecordWork={work.record}
        onVerifyRoad={!historical && scenarioEdits?.canEdit ? (roadId, status, note) => {
          const road = incidentSnapshot.roads.find(item => item.id === roadId);
          return !!road && scenarioEdits.record({ target: { type: 'road', id: road.id, name: road.name[0] },
            change: { kind: 'status', from: road.status, to: status }, note });
        } : undefined}
        onVerifyHazard={!historical && scenarioEdits?.canEdit ? (hazardId, confirmed, note) => {
          // "Not found" is recorded in the work log only; the hazard keeps its suspected status.
          if (!confirmed) return true;
          const hazard = incidentSnapshot.hazards.find(item => item.id === hazardId);
          if (!hazard) return false;
          const from = scenarioProperties(hazard);
          return scenarioEdits.record({ target: { type: 'hazard', id: hazard.id, name: hazard.name[0] },
            change: { kind: 'properties', from, to: { ...from, observation: 'reported' } }, note });
        } : undefined}
        appliedAt={appliedAt}
        comparisonPair={comparisonPair}
        onComparisonPair={setComparisonPair}
        decisionSnapshot={decisionSnapshot}
        evidenceId={evidenceModalId}
        terrain={defaultTerrainData}
        terrainMetadata={mapTerrain?.metadata}
        manifest={scenarioManifest}
        analysisImagery={imageryControls}
        upload={{
          mode: uploadMode,
          geographicMerge,
          fileNames: uploadedNames,
          busy: uploadBusy,
          error: uploadError,
          onModeChange: handleUploadModeChange,
          onGeographicMergeChange: handleGeographicMergeChange,
          onFiles: handleUpload,
          onClear: clearUploadedModels
        }}
        onClose={() => {setActiveDialog(null);setGisScenarioRequest(null);}}
        onOpenReport={() => setActiveDialog('alerts')}
        onApplyReport={handleSimulateUpdate}
        onRevision={(value) => {
          setHistorical(value);
          resetTools();
        }}
        onInspectObject={inspectObject}
      />

      {mapMenu && (
        <ContextMenu
          request={mapMenu}
          label={locale === 'vi' ? 'Thao tác tại vị trí' : 'Map actions'}
          onClose={closeMapMenu}
        />
      )}
      <NoticeToast notice={notice} locale={locale} onDismiss={dismissToast} />
    </div>
  );
}
