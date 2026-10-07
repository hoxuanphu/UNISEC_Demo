import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles.css';
import '../styles/tokens.css';
import '../styles/workspace.css';
import '../styles/incident-workspace.css';
import '../features/incident/incident-tools.css';
import '../features/search/search.css';
import '../features/briefing/briefing.css';

import { AppHeader } from '../components/dear/AppHeader';
import { WorkspaceNav } from '../components/dear/WorkspaceNav';
import { IncidentView } from '../components/dear/IncidentView';
import { ImpactView } from '../components/dear/ImpactView';
import { CommunityListView } from '../components/dear/CommunityListView';
import { CommunityDetailView } from '../components/dear/CommunityDetailView';
import { ObjectDetailView } from '../components/dear/ObjectDetailView';
import { MapControls } from '../components/dear/MapControls';
import { MapAttribution } from '../components/dear/MapAttribution';
import { ProfileDrawer } from '../components/dear/ProfileDrawer';
import { NotificationDialog } from '../components/dear/NotificationDialog';
import { DataDialog } from '../components/dear/DataDialog';
import { TimelineDialog } from '../components/dear/TimelineDialog';
import { LayersDialog } from '../components/dear/LayersDialog';
import { EvidenceDialog } from '../components/dear/EvidenceDialog';
import { UiIcon } from '../components/dear/UiIcon';

import { ModelUploadPanel } from '../components/ModelUploadPanel';
import type { ViewControls, OverlayHit, BasemapState } from '../features/map/mapContracts';
import { Map2D } from '../features/map/Map2D';
import { MapLocationPanel } from '../features/map/MapLocationPanel';
import { readTerrainLocation, type MapLocation } from '../features/map/mapLocation';
import { useMeasurementSession } from '../features/measurement/useMeasurementSession';
import type { useTerrainWorkspace } from '../features/terrain/useTerrainWorkspace';
import type { IncidentPacket } from '../data/incidentPacket';
import type { useWorkspacePreferences } from './useWorkspacePreferences';
import { Map3DBoundary } from '../features/map/Map3DBoundary';
import { useRouteTerrainAnalysis } from '../features/routes/useRouteTerrainAnalysis';
import { selectAccessRoute } from '../features/routes/routeReview';
import { usePanelScroll } from '../shared/hooks/usePanelScroll';
import { useModalFocus } from '../shared/hooks/useModalFocus';
import { PanelResizeHandle } from '../shared/ui/PanelResizeHandle';
import { useIncidentWorkspace } from '../features/incident/useIncidentWorkspace';
import { effectiveRevision } from '../features/incident/workspaceRevision';
import { RevisionNotice } from '../features/incident/RevisionNotice';
import { NotificationCenter } from '../features/incident/NotificationCenter';
import { ImageCompareDialog } from '../features/comparison/ImageCompareDialog';
import type { ComparisonPair } from '../features/comparison/comparison';
import { defaultLayerAppearance } from '../features/map/layerAppearance';
import { LayerDetails } from '../features/map/LayerDetails';
import { MapSearch } from '../features/search/MapSearch';
import { searchWorkspace } from '../features/search/searchIndex';
import { createDecisionSnapshot, type DecisionSnapshot } from '../features/briefing/decisionSnapshot';
import { DecisionExportDialog } from '../features/briefing/DecisionExportDialog';

import type {
  CommunityFilter,
  DetailTab,
  ImpactTab,
  RoadFilter,
  WorkspaceView
} from '../types/dear';
import type { TerrainPoint, TerrainMetadata } from '../types/terrain';

import { sampleTiles } from '../terrain/analysisTerrain';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import type { useWorkspaceInteraction } from './useWorkspaceInteraction';

const TerrainViewer = React.lazy(() => import('../components/TerrainViewer').then(module => ({ default: module.TerrainViewer })));
const defaultLayers = { aoi: true, imagery: true, context: true, hillshade: true, landslide: true, flood: true, roads: true, status: true, communities: true, staging: true, hlz: true, route: true };

type Props = {
  preferences: ReturnType<typeof useWorkspacePreferences>;
  interaction: ReturnType<typeof useWorkspaceInteraction>;
  runtime: ReturnType<typeof useTerrainWorkspace> & { packet: IncidentPacket };
};

export function ResponseWorkspace({ preferences, interaction, runtime }: Props): JSX.Element {
  const { locale, setLocale, theme, setTheme, fontChoice, setFontChoice } = preferences;
  const navigation = useWorkspaceNavigation();
  const { view, selectedCommunityId, selectedRouteType, selectedObjectId,
    detailTab, roadFilter, communityFilter, roadQuery, impactTab, communityQuery } = navigation;
  const setDetailTab = (detailTab: DetailTab) => navigation.dispatch({ type: 'filters', values: { detailTab } });
  const setSelectedRouteType = (selectedRouteType: 'candidate' | 'direct') => navigation.dispatch({ type: 'filters', values: { selectedRouteType } });
  const setRoadFilter = (roadFilter: RoadFilter) => navigation.dispatch({ type: 'filters', values: { roadFilter } });
  const setCommunityFilter = (communityFilter: CommunityFilter) => navigation.dispatch({ type: 'filters', values: { communityFilter } });
  const setRoadQuery = (roadQuery: string) => navigation.dispatch({ type: 'filters', values: { roadQuery } });
  const setCommunityQuery = (communityQuery: string) => navigation.dispatch({ type: 'filters', values: { communityQuery } });
  const setImpactTab = (impactTab: ImpactTab) => navigation.dispatch({ type: 'filters', values: { impactTab } });
  const [mapQuery, setMapQuery] = useState('');
  const [decisionSnapshot, setDecisionSnapshot] = useState<DecisionSnapshot | null>(null);
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(null);
  const [layerAppearance, setLayerAppearance] = useState(defaultLayerAppearance);
  const [reportApplied, setReportApplied] = useState(false);
  const [historical, setHistorical] = useState(false);
  const updated = effectiveRevision({ applied: reportApplied, historical });
  const [alertRead, setAlertRead] = useState<boolean>(false);
  const { showProfile, measurementOpen, locationOpen, activeDialog, showCustomUploadModal,
    mapMode, setMapMode, setActiveDialog, focusDistance, setFocusDistance, resetTools,
    recover2D: handle3DUnavailable } = interaction;
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const { session: measureSession, dispatch: dispatchMeasureSession } = useMeasurementSession(mapMode, measurementOpen);
  const [mobileView, setMobileView] = useState<'map' | 'info'>('map');
  const [basemapState, setBasemapState] = useState<BasemapState>({ status: 'off', style: 'satellite', loaded: 0, total: 0 });
  const [locationPoint, setLocationPoint] = useState<MapLocation | null>(null);
  const closeLocation = useCallback(() => { interaction.dispatch({ type: 'close-tool', tool: 'location' }); document.querySelector<HTMLButtonElement>('.map-location-trigger')?.focus(); }, [interaction.dispatch]);
  const [evidenceModalId, setEvidenceModalId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<[string, string] | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>(() => ({ ...defaultLayers, context: !runtime.offline }));

  const map2DViewport = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const viewControlRef = useRef<ViewControls | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const modalKey = showCustomUploadModal ? 'upload' : activeDialog === 'layers' ? null : activeDialog;
  useModalFocus(workspaceRef, modalKey, () => {
    setActiveDialog(null);
  });
  const panelKey = view === 'priority'
    ? selectedCommunityId ? `community:${selectedCommunityId}:${detailTab}` : `priority:${communityFilter}:${communityQuery}`
    : selectedObjectId
    ? `object:${selectedObjectId}`
    : view === 'impact'
    ? `impact:${impactTab}:${roadFilter}:${roadQuery}`
    : 'incident';
  usePanelScroll(sidebarRef, panelKey);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((msg: [string, string]) => {
    clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const shownFallback = useRef(0);
  useEffect(() => {
    if (interaction.fallbackVersion <= shownFallback.current) return;
    shownFallback.current = interaction.fallbackVersion;
    showToast(['Không mở được 3D. Đã chuyển sang bản đồ 2D.', '3D unavailable. Switched to the 2D map.']);
  }, [interaction.fallbackVersion, showToast]);
  const { packet, manifest: scenarioManifest, defaultTerrain: defaultTerrainData, snapshotReady, startupError,
    offline: offlineMode, models, mode: uploadMode, geographicMerge, fileNames: uploadedNames,
    busy: uploadBusy, error: uploadError, loading3D: terrain3DBusy, placements: geographicPlacements,
    retry: retryTerrain, reload: reloadTerrain, clear: clearTerrain, upload: uploadTerrain,
    changeMode: handleUploadModeChange, changeGeographicMerge: handleGeographicMergeChange
  } = runtime;
  const { roads, hazards, evidence, routes, assessments, communities, incident, responseSites } = useIncidentWorkspace(packet, updated);
  useEffect(() => { if (offlineMode) setLayers(previous => ({ ...previous, context: false })); }, [offlineMode]);

  const resetTerrainTools = useCallback(() => { resetTools(); setLocationPoint(null); }, [resetTools]);
  const clearUploadedModels = useCallback(() => { clearTerrain(); resetTerrainTools(); }, [clearTerrain, resetTerrainTools]);
  const handleUpload = useCallback(async (files: File[]) => {
    if (await uploadTerrain(files)) { resetTerrainTools(); }
  }, [uploadTerrain, resetTerrainTools]);

  const handlePick = useCallback((point: TerrainPoint, metadata: TerrainMetadata) => setLocationPoint(readTerrainLocation(point, metadata)), []);

  // Selected Community & Route objects
  const selectedCommunity = useMemo(
    () => (selectedCommunityId ? communities.find((c) => c.id === selectedCommunityId) || null : null),
    [selectedCommunityId, communities]
  );

  const selectedRoutePair = useMemo(
    () => (selectedCommunityId ? routes.get(selectedCommunityId) || null : null),
    [routes, selectedCommunityId]
  );

  const activeRoute = useMemo(() => {
    return selectAccessRoute(selectedRoutePair, selectedRouteType);
  }, [selectedRoutePair, selectedRouteType]);

  const mapTerrain = useMemo(() => models[0]?.metadata && models[0]?.grid && models[0]?.gridBuffer
    ? { metadata: models[0].metadata, grid: models[0].grid, gridBuffer: models[0].gridBuffer } : defaultTerrainData, [models, defaultTerrainData]);
  const scenarioTerrainCompatible = Boolean(mapTerrain?.grid &&
    mapTerrain.metadata.crs.authority.toUpperCase() === 'EPSG' &&
    mapTerrain.metadata.crs.code === 32648 && mapTerrain.metadata.crs.linear_unit === 'metre');
  const analysisModels = useMemo(() => models.length ? models : defaultTerrainData ? [defaultTerrainData] : [], [models, defaultTerrainData]);
  const profileTarget = useMemo(() => selectedObjectId?.startsWith('road:')
    ? roads.find(road => `road:${road.id}` === selectedObjectId) ?? null
    : activeRoute, [selectedObjectId, roads, activeRoute]);
  const { analysisTerrain, routeProfile, focusPoint } =
    useRouteTerrainAnalysis(analysisModels, scenarioTerrainCompatible ? profileTarget : null, focusDistance);
  const communityTerrainCoverage = useMemo(() => {
    if (!analysisTerrain || analysisTerrain.metadata.crs.authority.toUpperCase() !== 'EPSG' || analysisTerrain.metadata.crs.code !== 32648) return null;
    return new Map(communities.map(community => [community.id,
      sampleTiles(analysisTerrain.tiles, community.projected.x, community.projected.y).elevation !== undefined
    ]));
  }, [analysisTerrain, communities]);

  const revealPanel = () => { setPanelCollapsed(false); setMobileView('info'); resetTools(); };
  const selectCommunity = (id: string) => { navigation.dispatch({ type: 'select-community', id }); revealPanel(); };
  const inspectObject = (id: string) => { navigation.dispatch({ type: 'inspect-object', id }); revealPanel(); };
  const handleOverlayHit = (hit: OverlayHit) => {
    if (hit.type === 'community') selectCommunity(hit.id);
    else inspectObject(`${hit.type}:${hit.id}`);
  };

  // Simulate U-1 Incoming Field Update
  const handleSimulateUpdate = useCallback(() => {
    if (reportApplied && !historical) return;
    resetTools();
    setReportApplied(true); setHistorical(false);
    setActiveDialog(null);
    showToast(['Đã cập nhật bản đồ', 'Map updated']);
  }, [showToast, reportApplied, historical, resetTools]);

  const changeView = (view: WorkspaceView) => { navigation.dispatch({ type: 'view', view }); revealPanel(); };
  const openList = (view: WorkspaceView) => { navigation.dispatch({ type: 'view', view, list: true }); revealPanel(); };
  const toggleProfile = () => { interaction.dispatch({ type: 'toggle-tool', tool: 'profile' }); setMobileView('map'); };

  const mapResults = useMemo(() => searchWorkspace(mapQuery, { communities, roads, hazards, responseSites, aoi: packet.aoi }, locale),
    [mapQuery, communities, roads, hazards, responseSites, packet.aoi, locale]);

  const openDecisionExport = () => {
    if (!selectedCommunity) return;
    setDecisionSnapshot(createDecisionSnapshot({ packet, updated, community: selectedCommunity,
      assessment: assessments.get(selectedCommunity.id)!, route: activeRoute, roads, hazards, evidence, communities,
      terrainAssets: defaultTerrainData ? scenarioManifest?.terrain : undefined }));
    setActiveDialog('exportDecision');
  };

  return (
    <div ref={workspaceRef} className="workspace" data-mobile={mobileView} data-panel-collapsed={panelCollapsed}>
      <AppHeader
        locale={locale}
        incident={incident}
        areaName={packet.aoi.name}
        report={packet.report}
        reportRoad={roads.find(road => road.id === packet.report.roadId)}
        dataAvailable={snapshotReady}
        theme={theme}
        fontChoice={fontChoice}
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
        onOpenIncident={() => { setAlertRead(true); setActiveDialog(null); openList('incident'); }}
        onOpenUpload={() => setActiveDialog('upload')}
        onOpenTimeline={() => setActiveDialog('timeline')}
        onOpenNotifications={() => { setAlertRead(true); setActiveDialog('notificationCenter'); }}
        onReset={() => {
          dispatchMeasureSession({ type: 'reset' }); setPanelCollapsed(false);
          setLocationPoint(null);
          setReportApplied(false); setHistorical(false); setAlertRead(false);
          navigation.dispatch({ type: 'reset' }); interaction.dispatch({ type: 'reset' }); setMapQuery('');
          setDecisionSnapshot(null); setMobileView('map'); viewControlRef.current?.resetView();
          setLayerAppearance(defaultLayerAppearance);
          setLayers({ ...defaultLayers, context: !offlineMode });
          setComparisonPair(null); map2DViewport.current = null;
          if (!defaultTerrainData) reloadTerrain();
          showToast(['Đã đặt lại phiên làm việc', 'Workspace reset']);
        }}
        activeModelName={models[0]?.name}
      />

      <main className="work-area">
        <WorkspaceNav view={view} locale={locale} onChangeView={changeView} />
        <aside id="response-panel" ref={sidebarRef} className="sidebar" aria-label={locale === 'vi' ? 'Thông tin ứng phó' : 'Response information'}>
          {!snapshotReady ? <div className="sidebar-top"><h1>{startupError ? (locale === 'vi' ? 'Chưa tải được dữ liệu' : 'Dataset unavailable') : (locale === 'vi' ? 'Đang tải dữ liệu' : 'Loading dataset')}</h1>{startupError && <button className="button soft" onClick={retryTerrain}>{locale === 'vi' ? 'Thử lại' : 'Retry'}</button>}</div> : view === 'priority' && selectedCommunity && selectedRoutePair ? (
            <CommunityDetailView
              community={selectedCommunity}
              terrainCovered={communityTerrainCoverage?.get(selectedCommunity.id) ?? null}
              assessment={assessments.get(selectedCommunity.id)!}
              hazards={hazards}
              evidence={evidence}
              locale={locale}
              detailTab={detailTab}
              onChangeDetailTab={setDetailTab}
              onBack={() => { navigation.dispatch({ type: 'close-community' }); resetTools(); }}
              candidateRoute={selectedRoutePair.candidate}
              directRoute={selectedRoutePair.direct}
              selectedRouteType={selectedRouteType}
              onChangeRouteType={(type) => {
                setSelectedRouteType(type);
                setFocusDistance(null);
              }}
              hasTerrainProfile={Boolean(routeProfile?.samples.some(sample => sample.elevation !== undefined))}
              onToggleProfile={toggleProfile}
              onOpenSources={() => {
                setActiveDialog('data');
              }}
              onSelectObject={inspectObject}
              onOpenEvidence={(hazardId) => { setEvidenceModalId(hazardId); setActiveDialog('evidence'); }}
              onExport={openDecisionExport}
            />
          ) : view !== 'priority' && selectedObjectId ? (
            <ObjectDetailView
              objectId={selectedObjectId}
              parentName={navigation.objectOrigins[view] === 'priority' ? selectedCommunity?.name : undefined}
              aoi={packet.aoi}
              locale={locale}
              roads={roads}
              hazards={hazards}
              evidence={evidence}
              communities={communities}
              responseSites={responseSites}
              routes={routes}
              hasTerrainProfile={Boolean(routeProfile?.samples.some(sample => sample.elevation !== undefined))}
              profileOpen={showProfile}
              onToggleProfile={toggleProfile}
              onBack={() => { navigation.dispatch({ type: 'close-object' }); resetTools(); }}
              onSelectCommunity={selectCommunity}
              onSelectObject={inspectObject}
              onOpenEvidence={(hzId) => {
                setEvidenceModalId(hzId);
                setActiveDialog('evidence');
              }}
              onOpenPriority={() => { setCommunityFilter('all'); setCommunityQuery(''); openList('priority'); }}
            />
          ) : view === 'incident' ? (
            <IncidentView
              incident={incident}
              areaName={packet.aoi.name}
              onOpenArea={() => inspectObject(`aoi:${packet.aoi.id}`)}
              locale={locale}
              updated={updated}
              communities={communities}
              routes={routes}
              assessments={assessments}
              blockedRoadCount={roads.filter(road => road.status === 'blocked').length}
              uncertainRoadCount={roads.filter(road => road.status === 'uncertain').length}
              onSelectCommunity={selectCommunity}
              onOpenTimeline={() => setActiveDialog('timeline')}
              onOpenData={() => setActiveDialog('data')}
              onOpenCommunities={() => { setCommunityFilter('all'); setCommunityQuery(''); openList('priority'); }}
              onOpenRoads={filter => { navigation.dispatch({ type: 'road-list', filter }); revealPanel(); }}
            />
          ) : view === 'impact' ? (
            <ImpactView
              roads={roads}
              hazards={hazards}
              locale={locale}
              roadFilter={roadFilter}
              query={roadQuery}
              onChangeQuery={setRoadQuery}
              tab={impactTab}
              onChangeTab={setImpactTab}
              onChangeRoadFilter={setRoadFilter}
              onSelectObject={inspectObject}
            />
          ) : (
            <CommunityListView
              communities={communities}
              locale={locale}
              filter={communityFilter}
              query={communityQuery}
              onChangeQuery={setCommunityQuery}
              onChangeFilter={setCommunityFilter}
              onSelectCommunity={selectCommunity}
              selectedId={selectedCommunityId}
              routes={routes}
            />
          )}
        </aside>

        <PanelResizeHandle locale={locale}/>

        <section className="map-area" aria-label={locale === 'vi' ? 'Bản đồ ứng phó' : 'Response map'} data-profile={showProfile} data-locating={locationOpen}>
          {historical && reportApplied && <RevisionNotice locale={locale} timestamp={incident.asOf} onLatest={() => setHistorical(false)}/>}
          <div className="map-canvas">
          {mapMode === '2d' ? <Map2D
            terrain={mapTerrain}
            profileOpen={showProfile}
            profilePoints={showProfile ? profileTarget?.points : undefined}
            locationOpen={locationOpen}
            locationPoint={locationPoint}
            onLocation={setLocationPoint}
            measurementOpen={measurementOpen}
            measureSession={measureSession}
            dispatchMeasureSession={dispatchMeasureSession}
            onCloseMeasurement={() => { interaction.dispatch({ type: 'close-tool', tool: 'measure' }); document.querySelector<HTMLButtonElement>('.map-measure-trigger')?.focus(); }}
            imageUrl={defaultTerrainData ? scenarioManifest?.terrain.image?.url : undefined}
            viewportRef={map2DViewport}
            locale={locale}
            focusPoint={showProfile ? focusPoint : null}
            profileMetadata={analysisTerrain?.metadata}
            onBasemapState={setBasemapState}
            scenarioProps={snapshotReady && scenarioTerrainCompatible ? { aoi: packet.aoi, communities: communities, responseSites: responseSites, hazards, roads, selectedRoute: activeRoute, selectedCommunityId, selectedObjectId, layers, appearance: layerAppearance } : undefined}
            onSelectOverlayHit={handleOverlayHit}
            viewControlRef={viewControlRef}
          /> : <Map3DBoundary onUnavailable={handle3DUnavailable}><React.Suspense fallback={<div className="map-load-state" role="status">{locale === 'vi' ? 'Đang mở địa hình 3D' : 'Opening 3D terrain'}</div>}><TerrainViewer
            models={models}
            geographicPlacements={geographicPlacements}
            measureMode={locationOpen}
            onPick={handlePick}
            profile={showProfile ? routeProfile : null}
            profileMetadata={analysisTerrain?.metadata}
            focusPoint={locationOpen ? locationPoint?.scene : showProfile ? focusPoint : null}
            mapMode={mapMode}
            theme={theme}
            locale={locale}
            onBasemapState={setBasemapState}
            scenarioProps={snapshotReady && scenarioTerrainCompatible ? {
              aoi: packet.aoi,
              communities: communities,
              responseSites: responseSites,
              hazards,
              roads: roads,
              selectedRoute: activeRoute,
              selectedCommunityId: selectedCommunityId,
              selectedObjectId: selectedObjectId,
              layers: layers,
              appearance: layerAppearance
            } : undefined}
            onSelectOverlayHit={handleOverlayHit}
            viewControlRef={viewControlRef}
            onUnavailable={handle3DUnavailable}
          /></React.Suspense></Map3DBoundary>}
          </div>

          {((!mapTerrain && uploadBusy) || (mapMode === '3d' && terrain3DBusy)) && (
            <div className="map-load-state" role="status">{locale === 'vi' ? 'Đang mở bản đồ địa hình' : 'Opening terrain map'}</div>
          )}
          {!mapTerrain && startupError && (
            <div className="map-load-state" role="alert">
              <strong>{locale === 'vi' ? 'Không mở được bản đồ địa hình' : 'Terrain map could not be opened'}</strong>
              <button className="button soft" onClick={retryTerrain}>
                {locale === 'vi' ? 'Thử lại' : 'Retry'}
              </button>
            </div>
          )}
          {models.length > 0 && !scenarioTerrainCompatible && <p className="map-model-note" role="status">
            {locale === 'vi' ? 'Chưa ghép lớp sự kiện: cần lưới độ cao và hệ tọa độ EPSG:32648.' : 'Incident layers require an elevation grid in EPSG:32648.'}
          </p>}

          <MapControls
            panelCollapsed={panelCollapsed}
            onTogglePanel={() => setPanelCollapsed(value => !value)}
            locale={locale}
            mapMode={mapMode}
            onChangeMapMode={setMapMode}
            onZoomIn={() => viewControlRef.current?.zoomIn()}
            onZoomOut={() => viewControlRef.current?.zoomOut()}
            onResetView={() => viewControlRef.current?.resetView()}
            onOpenLayers={() => setActiveDialog(activeDialog === 'layers' ? null : 'layers')}
            layersOpen={activeDialog === 'layers'}
            layers={scenarioTerrainCompatible ? layers : {}}
            hazards={scenarioTerrainCompatible ? hazards : []}
            hasSelectedRoute={scenarioTerrainCompatible && Boolean(activeRoute)}
            hasHLZData={scenarioTerrainCompatible && responseSites.some(site => site.kind === 'hlz')}
            measuring={measurementOpen}
            locating={locationOpen}
            onLocation={() => interaction.dispatch({ type: 'toggle-tool', tool: 'location' })}
            affectedOnly={layerAppearance.roads === 'affected'}
            onMeasure={() => interaction.dispatch({ type: 'toggle-tool', tool: 'measure' })}
          >
          <MapSearch locale={locale} query={mapQuery} onQuery={setMapQuery} results={mapResults} disabled={!snapshotReady}
            onSelect={result => {
              setPanelCollapsed(false);
              const [kind, id] = result.key.split(':');
              const hazard = kind === 'hazard' ? hazards.find(h => h.id === id) : undefined;
              const site = kind === 'poi' ? responseSites.find(s => s.id === id) : undefined;
              const layer = kind === 'community' ? 'communities' : kind === 'road' ? 'roads' : kind === 'aoi' ? 'aoi'
                : site?.kind ?? (hazard?.kind === 'landslide' ? 'landslide' : hazard?.kind === 'flood' ? 'flood' : 'status');
              setLayers(previous => ({ ...previous, [layer]: true }));
              if (kind === 'community') selectCommunity(id);
              else inspectObject(result.key);
              viewControlRef.current?.focusProjected(result.projected);
            }}/>
          </MapControls>
          <MapAttribution locale={locale} state={basemapState} onRetry={() => viewControlRef.current?.retryBasemap()} localSource={mapTerrain ? defaultTerrainData ? ['Ảnh nền và địa hình', 'Imagery and terrain'] : ['Lưới độ cao từ mô hình đã tải lên', 'Elevation grid from the uploaded model'] : undefined}/>
          {locationOpen && <MapLocationPanel locale={locale} point={locationPoint} onClose={closeLocation}/>}

          {activeDialog === 'layers' && (
            <LayersDialog
              locale={locale}
              imageryPreview={defaultTerrainData ? scenarioManifest?.terrain.image?.url : undefined}
              layers={layers}
              appearance={layerAppearance}
              mapMode={mapMode}
              onAppearance={setLayerAppearance}
              onCompare={() => setActiveDialog('comparison')}
              renderInfo={id => <LayerDetails id={id} locale={locale} packet={packet} updated={updated} evidence={evidence} terrain={mapTerrain?.metadata} route={activeRoute} imagery={layers.imagery}/>}
              hasFloodData={hazards.some(hazard => hazard.kind === 'flood')}
              hasHLZData={responseSites.some(site => site.kind === 'hlz')}
              hasSelectedRoute={Boolean(activeRoute)}
              hasIncidentLayers={scenarioTerrainCompatible}
              onToggleLayer={(layerId) => setLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }))}
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
              onClose={() => interaction.dispatch({ type: 'close-tool', tool: 'profile' })}
            />
          )}

        </section>
      </main>

      <nav className="mobile-view-switch" aria-label={locale === 'vi' ? 'Chế độ xem' : 'View'}>
        <button aria-pressed={mobileView === 'info'} onClick={() => setMobileView('info')}>{locale === 'vi' ? 'Thông tin' : 'Information'}</button>
        <button aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}>{locale === 'vi' ? 'Bản đồ' : 'Map'}</button>
      </nav>

      {/* Dialogs */}
      {activeDialog === 'comparison' && <ImageCompareDialog pair={comparisonPair} onPair={setComparisonPair} triggeredAt={incident.triggeredAt} locale={locale} onClose={() => setActiveDialog(null)}/>}
      {activeDialog === 'exportDecision' && decisionSnapshot && <DecisionExportDialog snapshot={decisionSnapshot}
        terrain={defaultTerrainData} imageUrl={scenarioManifest?.terrain.image?.url} locale={locale} onClose={() => setActiveDialog(null)}/>}
      {activeDialog === 'alerts' && (
        <NotificationDialog
          locale={locale}
          report={packet.report}
          road={roads.find(road => road.id === packet.report.roadId)}
          updated={reportApplied}
          historical={historical}
          onApplyReport={handleSimulateUpdate}
          onClose={() => setActiveDialog(null)}
          onSelectRoad={inspectObject}
        />
      )}

      {activeDialog === 'notificationCenter' && <NotificationCenter packet={packet} applied={reportApplied} locale={locale} onClose={() => setActiveDialog(null)} onOpenReport={() => setActiveDialog('alerts')} onInspect={inspectObject}/>}
      {activeDialog === 'timeline' && <TimelineDialog locale={locale} incident={incident} report={packet.report} updated={reportApplied} historical={historical} onRevision={value => { setHistorical(value); resetTools(); }} onClose={() => setActiveDialog(null)} />}

      {activeDialog === 'data' && (
        <DataDialog
          incident={incident}
          locale={locale}
          updated={updated}
          manifest={defaultTerrainData ? scenarioManifest : null}
          terrainMetadata={mapTerrain?.metadata}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'evidence' && evidenceModalId && (
        <EvidenceDialog
          evidence={evidence.find(item => item.hazardId === evidenceModalId)}
          hazard={hazards.find(item => item.id === evidenceModalId)}
          roads={roads}
          locale={locale}
          onClose={() => setActiveDialog(null)}
          onSelectRoad={inspectObject}
        />
      )}

      {showCustomUploadModal && (
        <div className="modal-overlay" onClick={() => setActiveDialog(null)}>
          <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title" onClick={(e) => e.stopPropagation()} style={{ width: '640px' }}>
            <div className="modal-head">
              <h2 id="upload-dialog-title">{locale === 'en' ? 'Terrain model' : 'Mô hình địa hình'}</h2>
              <button className="icon-button" onClick={() => setActiveDialog(null)} aria-label={locale === 'vi' ? 'Đóng' : 'Close'}>
                <UiIcon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <ModelUploadPanel
                locale={locale}
                mode={uploadMode}
                geographicMerge={geographicMerge}
                fileNames={uploadedNames}
                busy={uploadBusy}
                error={uploadError}
                onModeChange={handleUploadModeChange}
                onGeographicMergeChange={handleGeographicMergeChange}
                onFiles={handleUpload}
                onClear={clearUploadedModels}
              />
            </div>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast" role="status">{toastMessage[locale === 'vi' ? 0 : 1]}</div>}
    </div>
  );
}
