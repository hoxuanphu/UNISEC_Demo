import {mergeLocationFeeds, rescueOnly, residentDeviceId} from '../tracking/residentLocation';
import { useResidentPresence } from '../presence/residentPresence';
import { assessHouseholdAccess } from '../presence/householdIsolation';
import { householdRescues } from '../presence/householdRescue';
import { rescueBases } from '../tracking/rescueBase';
import { useDeviceFeed } from '../tracking/useDeviceFeed';
import { useNearestTeam } from '../tracking/nearestTeam';
import { teamStatus } from '../tracking/RescueTeams';
import { MapCompass } from '../map/MapCompass';
import { useDeviceHeading } from '../../shared/hooks/useDeviceHeading';
import { useMovementHeading } from '../tracking/useMovementHeading';
import {useResidentLocation} from '../tracking/useResidentLocation';
import { CitizenMovementControl } from './CitizenMovementControl';
import { useRouteSimulation } from '../routes/useRouteSimulation';
import { useLocalNetwork } from '../route-film/networkContext';
import { northernComparisonRoute } from '../route-film/localRoadConditions';
import { HeaderAccount } from '../../components/dear/HeaderAccount';
import { CitizenMapSummary } from './CitizenMapSummary';
import { difficultRoadLabel } from '../routes/localRoadLabels';
import { roadCondition } from '../routes/roadConditions';
import { RoadConditionSymbol } from '../map/RoadConditionSymbol';
import { roadColors } from '../../terrain/roadStyle';
import { roadAreaContact } from '../route-film/roadAreaContact';
import type { Community, ResponseSite } from '../../types/dear';
import pointOnFeature from '@turf/point-on-feature';
import { useAnalysisImagery } from '../imagery/useAnalysisImagery';
import { analysisSourceInfo } from '../imagery/analysisImagery';
import { supportsBasemapTone } from '../imagery/basemapTone';
import { CitizenPlaceCard } from "./CitizenPlaceCard";
import { routeChainage } from "./routeChainage";
import { roadsForHazard } from "../incident/roadHazards";
import { usePreparedPhotos } from "../fieldPhotos/preparedPhotos";
import { visibleMapRecords } from "../map/visibleMapRecords";
import { landslideAreaOf } from "../landslides/landslideAreas";
import type { ScenarioEdit } from "./scenarioEdits";
import { UiIcon } from "../../shared/ui/UiIcon";
import { observationCode } from "../observations/recordIdentity";
import { accessMessages } from "./locales";
import type { ScenarioRevision } from "./useScenarioRevision";
import { journeyMarkers, useRoadJourney } from "../routes/useRoadJourney";
import { CitizenDirections } from "./CitizenDirections";
import { CitizenReportForm } from "./CitizenReportForm";
import { VoicePlayback } from "../observations/VoicePlayback";
import { useDeviceLocation } from "../../shared/hooks/useDeviceLocation";
import { roadGeographic, roadProjected } from "../routes/selectedRoadJourney";
import { recommendRoute, routeProblems } from "../routes/routeAdvice";
import { CitizenRouteCard } from "./CitizenRouteCard";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OverlayHit,
  ViewControls,
  BasemapState,
} from "../../features/map/mapContracts";
import type { IncidentPacket } from "../../data/incidentPacket";
import type { useTerrainWorkspace } from "../terrain/useTerrainWorkspace";
import type { DemoIdentity } from "./demoSession";
import { useGeometrySession } from "../geodata/useGeometrySession";
import { useIncidentWorkspace } from "../incident/useIncidentWorkspace";
import { useMeasurementSession } from "../measurement";
import { Map2D } from "../map/Map2D";
import { defaultLayerAppearance } from "../map/layerAppearance";
import { ObservationEditor } from "../observations/ObservationEditor";
import {
  annotateRecord,
  observationOf,
  type FieldObservation,
} from "../observations/model";
import { PhotoGallery } from "../observations/PhotoGallery";
import { photoLocation, observationTimeLabel } from '../observations/captureMetadata';
import { reportPhotoContext } from '../observations/photoSummary';
import { observationLabel } from "../observations/labels";
import { validateGeometry } from "../../geo/vector/validateGeometry";
import type { GeometryRecord } from "../../geo/vector/types";
import {
  newSubmission,
  submissionOf,
  canEditSubmission,
  submissionKey,
  type Submission,
} from "./submissions";
import {LanguageSwitch} from "../../shared/ui/LanguageSwitch";
import { MapAttribution } from "../../components/dear/MapAttribution";
import { UserGuide } from "../help/UserGuide";
import "./citizen.css";

type Props = {
  published: ScenarioRevision;
  scenarioEdits?: ScenarioEdit[];
  locale: import("../../types/dear").Locale;
  onChangeLocale: (locale: import("../../types/dear").Locale) => void;
  identity: DemoIdentity;
  onSignOut: () => void;
  runtime: ReturnType<typeof useTerrainWorkspace> & { packet: IncidentPacket };
};
type MapSelection = { kind: 'area' | 'hazard' | 'localArea' | 'road' | 'place'; id: string } | null;
export function CitizenWorkspace({
  published,
  scenarioEdits,
  locale,
  onChangeLocale,
  identity,
  onSignOut,
  runtime,
}: Props): JSX.Element {
  const m = accessMessages[locale];
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const { packet, defaultTerrain, manifest, offline } = runtime;
  const hasLocalNetwork = packet.datasetVersion.startsWith('che-tao');
  const snapshot = useIncidentWorkspace(
      packet,
      published.applied,
      scenarioEdits,
      published.at,
    ),
    gis = useGeometrySession({prepared: runtime.fieldDataset});
  const [openSubmission, setOpenSubmission] = useState<string | null>(null);
  const [tab, setTab] = useState<"roads" | "report" | "mine">("roads"),
    [community, setCommunity] = useState(
      identity.communityId ?? packet.communities[0]?.id ?? "",
    );
  // A single inspected object, so closing a card cannot reveal a stale selection.
  const [mapSelection, setMapSelection] = useState<MapSelection>(null);
  const selectedAreaId = mapSelection?.kind === 'area' ? mapSelection.id : null;
  const selectedHazardId = mapSelection?.kind === 'hazard' ? mapSelection.id : null;
  const localAreaId = mapSelection?.kind === 'localArea' ? mapSelection.id : null;
  const shownRoadId = mapSelection?.kind === 'road' ? mapSelection.id : null;
  const mapPlaceId = mapSelection?.kind === 'place' ? mapSelection.id : null;
  const fieldPhotos = usePreparedPhotos(manifest?.fieldPhotos);
  const [layerOptions, setLayerOptions] = useState({landslide:true,status:true,communities:true,imagery:true});
  const analysisImagery=useAnalysisImagery(manifest?.analysisImagery);
  // The Planet scene is brighter and greener than the basemap; tone the basemap to it, as the coordinator map does.
  const analysisDisplay=useMemo(()=>({rasters:layerOptions.imagery?analysisImagery.rasters:[],opacity:1,
    balanceBasemap:supportsBasemapTone(analysisImagery.layers)&&analysisImagery.layers.some(layer=>layer.id===analysisImagery.selection.layer&&layer.kind==='optical')}),
    [analysisImagery.rasters,analysisImagery.layers,analysisImagery.selection.layer,layerOptions.imagery]);
  // Keep the demo commune graph separate from published village access routes.
  const [roadMode, setRoadMode] = useState<"village" | "journey" | "local">(hasLocalNetwork ? 'local' : 'village');
  const local = useLocalNetwork(hasLocalNetwork, gis.records);
  const localPlaces = useMemo(() => (local.network?.places ?? []).map(place => ({...place,
    name: locale === 'vi' ? place.name.replace(/^Village /, 'Bản ').replace(/^Helipad$/, 'Bãi đáp') : place.name,
  })), [local.network, locale]);
  const localCommunities = useMemo<Community[]>(() => localPlaces.filter(place => place.kind === 'village').map(place => ({
    id: place.id, name: place.name, commune: 'Chế Tạo', prio: 3, pop: 0, hh: 0,
    desc: ['', ''], facts: [], projected: place.projected,
  })), [localPlaces]);
  const localSites = useMemo<ResponseSite[]>(() => localPlaces.filter(place => place.kind === 'hlz').map(place => ({
    id: place.id, name: [place.name, place.name], kind: 'hlz', projected: place.projected,
    assessment: 'candidate', observedAt: '', source: [local.network!.source.file, local.network!.source.file],
  })), [localPlaces, local.network]);
  const [fitWholeNetwork, setFitWholeNetwork] = useState(false);
  const [mapOnMobile, setMapOnMobile] = useState(true),
    [picking, setPicking] = useState(false),
    [help, setHelp] = useState(false),
    [message, setMessage] = useState("");
  const [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [source, setSource] = useState<Submission["locationSource"]>("manual");
  const [draftId, setDraftId] = useState(() => crypto.randomUUID()),
    [locationCommunity, setLocationCommunity] = useState(""),
    [accuracy, setAccuracy] = useState<number | null>(null),
    [ownSelected, setOwnSelected] = useState<string | null>(null);
  const [ownView, setOwnView] = useState({
    version: 0,
    id: null as string | null,
  });
  const [basemap, setBasemap] = useState<BasemapState>({
    status: "off",
    style: "satellite",
    loaded: 0,
    total: 0,
  });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { root.current?.querySelector('.citizen-panel-scroll')?.scrollTo({top: 0}); }, [tab]);
  const viewport = useRef<{ center: [number, number]; zoom: number } | null>(
      null,
    ),
    controls = useRef<ViewControls | null>(null);
  const { session: measure, dispatch } = useMeasurementSession("2d", false);
  const incidentJourney = useRoadJourney(snapshot.roads, undefined, 'conditions');
  const localJourney = useRoadJourney(local.network?.roads ?? [], 250, 'conditions');
  const journey = roadMode === 'local' ? localJourney : incidentJourney;
  const gps = useDeviceLocation();
  const residentLocation=useResidentLocation(local.network);
  // The commune's rescue teams, on the same timetable as the coordination map. Residents see teams only.
  const presence=useResidentPresence(local.network?manifest?.residentPresence:undefined);
  const households=useMemo(()=>local.network&&presence?assessHouseholdAccess(local.network,presence.clusters):[],[local.network,presence]);
  const bases=useMemo(()=>local.network?rescueBases(snapshot.responseSites,local.network.roads):[],[local.network,snapshot.responseSites]);
  const teamMissions=useMemo(()=>local.network?householdRescues(local.network,households,bases).map(team=>team.plan):[],[local.network,households,bases]);
  const teamRoads=useMemo(()=>local.network?[...snapshot.roads,...local.network.roads]:[],[local.network,snapshot.roads]);
  const teamFeed=useDeviceFeed(teamRoads,!!local.network,local.network?.conditions?.areaLinks,teamMissions,bases);
  const rescueTeams=useMemo(()=>teamFeed?rescueOnly(teamFeed):null,[teamFeed]);
  const mapFeed=useMemo(()=>mergeLocationFeeds(rescueTeams,residentLocation),[rescueTeams,residentLocation]);
  const heading=useDeviceHeading();
  // The compass when the phone has one, otherwise the direction of travel.
  const movement=useMovementHeading(residentLocation,residentLocation?residentDeviceId:null);
  const selfHeading=heading.heading??movement;
  const selfPoint=()=>residentLocation?.getSnapshot()[0]?.point??(gps.location?roadProjected(gps.location.latitude,gps.location.longitude):null);
  const nearestTeam=useNearestTeam(rescueTeams,selfPoint,residentLocation);
  const currentResidentPosition=()=>{
    const device=residentLocation?.getSnapshot()[0];
    return device?{...roadGeographic(device.point),accuracy:15,timestamp:device.updatedAt}:null;
  };
  const navigationGps=residentLocation?{...gps,busy:false,error:null,request:async()=>currentResidentPosition()}:gps;
  const [locationRequest, setLocationRequest] = useState(0);
  const advice = recommendRoute(snapshot.routes.get(community)),
    route = advice.best;
  const displayedRoute = tab !== 'roads' ? null : roadMode === 'village' ? route : journey.route;
  const routeSimulation=useRouteSimulation(hasLocalNetwork?null:displayedRoute, tab === 'roads' && !picking && !journey.picking, identity.name);
  const displayedRoads = roadMode === 'local' ? local.network?.roads ?? [] : snapshot.roads;
  // Other ways between the chosen points, and a closure sign on every blocked road shown.
  const alternativeRoutes = useMemo(() => tab === 'roads' && roadMode !== 'village' ? journey.alternatives : [], [tab, roadMode, journey.alternatives]);
  const comparisonRoute = useMemo(() => roadMode === 'local' && tab === 'roads' && layerOptions.status && local.network
    ? northernComparisonRoute(local.network, localJourney.start, localJourney.end) : null,
    [roadMode, tab, layerOptions.status, local.network, localJourney.start, localJourney.end]);
  const roadAreaLinks = useMemo(() => roadMode === 'local' && layerOptions.status
    ? local.network?.conditions?.areaLinks ?? [] : [], [roadMode, layerOptions.status, local.network]);
  const linkedAreaIds = useMemo(() => roadAreaLinks.map(link => link.areaId), [roadAreaLinks]);
  const routeFramePoints = useMemo(() => displayedRoute
    ? [...displayedRoute.points, ...alternativeRoutes.flatMap(route => route.points), ...(comparisonRoute?.points ?? []), ...(comparisonRoute ? roadAreaLinks.map(link => link.areaPoint) : [])] : displayedRoads.flatMap(road => road.points),
    [displayedRoute, displayedRoads, alternativeRoutes, comparisonRoute, roadAreaLinks]);
  const roadAlerts = useMemo(() => layerOptions.status ? displayedRoads.filter(road => ['blocked', 'risk'].includes(roadCondition(road))) : [], [layerOptions.status, displayedRoads]);
  const mapPlace = localPlaces.find(place => place.id === mapPlaceId);
  const inspectedRoad = displayedRoads.find(road => road.id === shownRoadId);
  const own = useMemo(
    () => gis.records.filter((r) => submissionOf(r)?.authorId === identity.id),
    [gis.records, identity.id],
  );
  const reportPosition = useRef({ lat, lon, source });
  reportPosition.current = { lat, lon, source };
  const citizenLayers = useMemo(
    () => ({
      aoi: false,
      gis: true,
      crossings: true,
      roads: true,
      route: true,
      flood: true,
      staging: true,
      hlz: false,
      context: !offline || runtime.localMap,
      hillshade: true,
      ...layerOptions,
    }),
    [offline, runtime.localMap, layerOptions],
  );
  const draft: GeometryRecord = useMemo(
    () => ({
      id: draftId,
      name: m.fieldReport,
      role: "reference",
      visible: true,
      source: {
        name: m.residentReport,
        format: "coordinate",
        importedAt: new Date().toISOString(),
      },
      feature: {
        type: "Feature",
        properties: { observer: identity.name },
        geometry: { type: "Point", coordinates: [Number(lon), Number(lat)] },
      },
    }),
    [draftId, lat, lon, identity.name, locale],
  );
  const mapRecords = useMemo(() => visibleMapRecords(
    gis.records.filter(record => landslideAreaOf(record) || own.some(item => item.id === record.id)),
    citizenLayers, packet.datasetVersion
  ), [gis.records, own, citizenLayers, packet.datasetVersion]);
  const selectedArea = mapRecords.find(record => record.id === selectedAreaId && landslideAreaOf(record));
  const chainage = useMemo(() => routeChainage(route), [route]);
  const routeOrigin = snapshot.responseSites.find(site => site.kind === "staging");
  const originName = routeOrigin ? t(...routeOrigin.name).replace(/^Điểm tập kết /, "").replace(/ staging point$/i, "") : undefined;
  // A nearby incident is not evidence that it represents the selected polygon.
  const placeHazard = snapshot.hazards.find(h => h.id === selectedHazardId);
  const placeArea = selectedArea ? landslideAreaOf(selectedArea) ?? undefined : undefined;
  const placeRoad = (() => {
    if (roadMode === 'local' && selectedArea) {
      const road = displayedRoads.find(item => item.landslideAreaIds?.includes(selectedArea.id) || item.landslideAreaId === selectedArea.id);
      if (road) return { road };
    }
    const road = placeHazard ? roadsForHazard(snapshot.roads, placeHazard.id)[0]
      : placeArea?.networkVersion === packet.datasetVersion ? snapshot.roads.find(r => placeArea.roadLinks.some(link => link.roadId === r.id)) : undefined;
    return road && { road, km: chainage.get(road.id), origin: originName };
  })();
  const localAreas = useMemo(() => local.context && layerOptions.landslide
    ? { areas: local.context.areas.filter(area => area.kind === 'landslide'), closures: [] } : undefined, [local.context, layerOptions.landslide]);
  const localArea = localAreas?.areas.find(area => area.id === localAreaId);
  // The nearest commune road within 150 m names where the area is.
  const localAreaRoad = useMemo(() => {
    if (!localArea || !local.network) return undefined;
    const linkedRoad = local.network.roads.find(road => road.landslideAreaIds?.includes(localArea.id) || road.landslideAreaId === localArea.id);
    if (linkedRoad) return { road: linkedRoad };
    const ring = localArea.coordinates.map(([lon, lat]) => roadProjected(lat, lon));
    const near = local.network.roads.map(road => ({ road, d: roadAreaContact(road.points, ring)?.distanceM ?? Infinity }))
      .filter(item => item.d < 150).sort((a, b) => a.d - b.d)[0];
    return near && { road: near.road, nearby: true };
  }, [localArea, local.network]);
  const reportAt = (point: { x: number; y: number }) => {
    const p = roadGeographic(point);
    setMapSelection(null);
    gps.cancel(); setPicking(false); journey.setPicking(null);
    setTab("report"); setMessage("");
    position(p.latitude, p.longitude, "map");
  };
  const roadView = tab === "roads";
  const showRoadMode = (mode: "village" | "journey" | "local") => {
    gps.cancel();
    incidentJourney.setPicking(null);
    localJourney.setPicking(null);
    incidentJourney.setOpen(mode === 'journey');
    localJourney.setOpen(mode === 'local');
    setMapSelection(null);
    setFitWholeNetwork(false);
    setRoadMode(mode);
  };
  // Fit after the previously hidden map has a measurable viewport.
  useEffect(() => {
    if ((!mapOnMobile && window.matchMedia('(max-width: 760px)').matches) || !defaultTerrain || !roadView || picking || journey.picking) return;
    const frame = requestAnimationFrame(() => {
      if (mapPlace) controls.current?.focusProjected(mapPlace.projected);
      else if (shownRoadId) {
        const road = displayedRoads.find(road => road.id === shownRoadId);
        const link = roadAreaLinks.find(item => item.areaId === road?.landslideAreaId);
        controls.current?.frameProjected?.([...(road?.points ?? []), ...(link ? [link.areaPoint] : [])]);
      }
      else if (fitWholeNetwork && roadMode === 'local' && local.network) controls.current?.frameProjected?.(local.network.roads.flatMap(road => road.points));
      else if (displayedRoute) controls.current?.frameProjected?.(routeFramePoints);
      else if (roadMode === 'local' && local.network) {
        // Like any map app: open on where you are, with the roads around you.
        const me = selfPoint();
        controls.current?.frameProjected?.(me ? [{x: me.x - 900, y: me.y - 900}, {x: me.x + 900, y: me.y + 900}] : local.network.roads.flatMap(road => road.points));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mapOnMobile, defaultTerrain, roadMode, displayedRoute, routeFramePoints, local.network, roadView, shownRoadId, picking, journey.picking, journey.fitSequence, mapPlaceId, fitWholeNetwork, residentLocation]);
  const gpsError = gps.error ? (
    <p className="field-error" role="alert">
      {gps.error === "denied"
        ? t("Chưa được phép lấy vị trí. Bật quyền vị trí trong trình duyệt hoặc chọn trên bản đồ.", "Location permission is denied. Enable browser permission or choose on the map.")
        : gps.error === "insecure"
          ? t("Định vị cần mở ứng dụng qua HTTPS. Bạn vẫn có thể chọn trên bản đồ.", "Location requires HTTPS. You can still choose on the map.")
          : t("Chưa lấy được vị trí. Thử lại hoặc chọn trên bản đồ.", "Location unavailable. Retry or choose on the map.")}
    </p>
  ) : null;
  const position = (
    latitude: number,
    longitude: number,
    kind: Submission["locationSource"],
  ) => {
    if (kind !== "device") gps.cancel();
    setLat(latitude.toFixed(6));
    setLon(longitude.toFixed(6));
    setSource(kind);
    if (kind !== "device") setAccuracy(null);
    setPicking(false);
    setMapOnMobile(false);
  };
  const submit = (observation: FieldObservation): boolean => {
    if (!lat || !lon) {
      setMessage(m.chooseAReportLocationBeforeSubmitting);
      return false;
    }
    try {
      const record = annotateRecord(
        {
          ...draft,
          name: `${observationLabel(observation.kind, locale)} ${observationCode(draft.id)}`,
          feature: {
            ...draft.feature,
            geometry: validateGeometry(draft.feature.geometry),
            properties: {
              ...draft.feature.properties,
              [submissionKey]: {
                ...newSubmission(identity, source),
                ...(source === "community"
                  ? { locationCommunityId: locationCommunity }
                  : {}),
              },
            },
          },
        },
        observation,
      );
      gis.add([record]);
      gps.cancel();
      setOwnSelected(record.id);
      setOwnView((v) => ({ version: v.version + 1, id: record.id }));
      setMessage(m.submittedInThisDemoSessionAwaitingCoordinator);
      setTab("mine");
      setDraftId(crypto.randomUUID());
      setLat("");
      setLon("");
      setAccuracy(null);
      setSource("manual");
      setLocationCommunity("");
      return true;
    } catch {
      setMessage(m.couldNotSaveTheReportCheckCoordinates);
      return false;
    }
  };
  const switchTab = (value: "roads" | "report" | "mine") => {
    gps.cancel();
    setPicking(false);
    journey.setPicking(null);
    setMapOnMobile(false);
    setMapSelection(null);
    setTab(value);
  };
  const onHit = (hit: OverlayHit) => {
    if (roadMode === 'local' && (hit.type === 'community' || hit.type === 'poi')) {
      setMapSelection({kind: 'place', id: hit.id}); return;
    }
    if (hit.type === 'road') {
      setMapSelection({kind: 'road', id: hit.id});
      controls.current?.frameProjected?.(displayedRoads.find(road => road.id === hit.id)?.points ?? []);
      return;
    }
    if (hit.type === "hazard") {
      setMapSelection({kind: 'hazard', id: hit.id});
      return;
    }
    if (hit.type === "community") {
      setMapSelection(null);
      journey.close();
      setCommunity(hit.id);
      setTab("roads");
      setRoadMode("village");
      setMapOnMobile(false);
    }
  };
  return (
    <div
      ref={root}
      className="response-workspace citizen-workspace"
      data-citizen-map={mapOnMobile ? "true" : undefined}
    >
      <header className="citizen-header">
        <div className="citizen-brand">
          <strong>DEAR</strong>
          <span>{snapshot.communities.find(place => place.id === community)?.commune ?? snapshot.communities[0]?.commune}</span>
        </div>
        <LanguageSwitch locale={locale} onChange={onChangeLocale} compact/>
        <button className="icon-button" onClick={() => setHelp(true)} aria-label={m.help} title={m.help}>
          <UiIcon name="help" />
        </button>
        <HeaderAccount locale={locale} identityName={identity.name} role="resident" onSwitchRole={onSignOut}/>
      </header>
      <main className="citizen-body">
        <aside className="citizen-panel">
          <div className="citizen-panel-scroll">
            {message && (
              <p className="citizen-feedback" role="status">
                {message}
              </p>
            )}
            {tab === "roads" && (
              <section className="citizen-roads">
                <h1 className="visually-hidden">{m.accessToAnArea}</h1>
                <div className="citizen-segments" role="group" aria-label={t("Cách xem đường", "Road view")}>
                  <button type="button" aria-pressed={roadMode === "village"} onClick={() => showRoadMode("village")}>
                    <UiIcon name="home" size={16} />
                    {t("Đường về thôn, bản", "Village access")}
                  </button>
                  <button type="button" aria-pressed={roadMode === "journey"} onClick={() => showRoadMode("journey")}>
                    <UiIcon name="route" size={16} />
                    {t("Tìm đường", "Find a route")}
                  </button>
                  {hasLocalNetwork && <button type="button" aria-pressed={roadMode === 'local'} onClick={() => showRoadMode('local')}>
                    <UiIcon name="map" size={16}/>{t('Trong xã', 'In the commune')}
                  </button>}
                </div>
                {roadMode === "village" ? (
                  <section className="citizen-card citizen-village" aria-label={t("Đường về thôn, bản", "Village access")}>
                    {snapshot.communities.length > 1 && (
                      <label className="geodata-field">
                        {m.areaToView}
                        <select value={community} onChange={(e) => setCommunity(e.target.value)}>
                          {snapshot.communities.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {route ? (
                      <CitizenRouteCard
                        route={route}
                        avoided={advice.avoided}
                        problems={routeProblems(route)}
                        chainage={chainage}
                        origin={originName}
                        hazardCount={(road) => snapshot.hazards.filter(h => roadsForHazard(snapshot.roads, h.id).some(r => r.id === road.id)).length}
                        locale={locale}
                        onShowMap={() => { setMapSelection(null); setMapOnMobile(true); }}
                        onShowSection={(road) => {
                          setMapSelection({kind: 'road', id: road.id});
                          controls.current?.frameProjected?.(road.points);
                          setMapOnMobile(true);
                        }}
                      />
                    ) : (
                      <p className="citizen-direction-note">{m.noMappedRouteInTheCurrentDataset}</p>
                    )}
                  </section>
                ) : roadMode === 'journey' ? (
                  <CitizenDirections
                    journey={journey}
                    communities={snapshot.communities}
                    sites={snapshot.responseSites.filter((site) => site.kind === "staging")}
                    locale={locale}
                    gps={navigationGps}
                    gpsError={residentLocation?null:gpsError}
                    onPick={(side) => {
                      gps.cancel();
                      setPicking(false);
                      journey.setPicking(side);
                      setMapOnMobile(true);
                    }}
                    onMap={() => setMapOnMobile(true)}
                  />
                ) : (
                  <section className="citizen-local">
                    <header><h2>{t('Đường trong xã', 'Local roads')}</h2></header>
                    {local.error ? <p role="alert">{t('Chưa tải được đường trong xã.', 'Local roads could not load.')} <button className="text-button" onClick={local.retry}>{t('Thử lại', 'Retry')}</button></p> : !local.network ? <p role="status">{t('Đang tải đường', 'Loading roads')}</p> : <>
                      <button className="button citizen-local-map" onClick={() => { setMapSelection(null); setFitWholeNetwork(true); setMapOnMobile(true); }}><UiIcon name="map" size={18}/>{t('Xem toàn bộ đường và địa điểm', 'See all roads and places')}</button>
                      <CitizenDirections journey={localJourney} communities={localCommunities} sites={localSites} locale={locale} gps={navigationGps} gpsError={residentLocation?null:gpsError} local
                        onPick={side => { gps.cancel(); setPicking(false); localJourney.setPicking(side); setMapOnMobile(true); }} onMap={() => {setMapSelection(null);setFitWholeNetwork(false);setMapOnMobile(true);}}/>
                      <h3>{t('Địa điểm trong xã', 'Places in the commune')} <small>{localPlaces.length}</small></h3>
                      <ul className="citizen-local-places">{localPlaces.map(place => <li key={place.id}><button onClick={() => { setMapSelection({kind: 'place', id: place.id}); setMapOnMobile(true); }}><UiIcon name="location" size={20}/><span><strong>{place.name}</strong>{(() => { const me = selfPoint(); return me && <small>{t(`Cách bạn ${(Math.hypot(place.projected.x - me.x, place.projected.y - me.y) / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 1})} km`, `${(Math.hypot(place.projected.x - me.x, place.projected.y - me.y) / 1000).toLocaleString('en-GB', {maximumFractionDigits: 1})} km away`)}</small>; })()}</span><UiIcon name="next" size={16}/></button></li>)}</ul>
                    </>}
                  </section>
                )}
              </section>
            )}
            <section hidden={tab !== "report"}>
              <h1 className="visually-hidden">{m.fieldObservation}</h1>
              <CitizenReportForm
                key={draftId}
                locale={locale}
                observer={identity.name}
                active={tab === "report" && !mapOnMobile}
                accuracy={accuracy}
                onSave={submit}
                onPhotosChange={(photos) => {
                  const current = reportPosition.current;
                  if ((current.lat || current.lon) && current.source !== 'photo') return;
                  const location = photos.map(photoLocation).find(Boolean);
                  if (location) {
                    position(location.latitude, location.longitude, 'photo');
                    setAccuracy(location.accuracyM);
                  } else if (current.source === 'photo') {
                    setLat(''); setLon(''); setAccuracy(null); setSource('manual');
                  }
                }}
                locationControl={
                  <fieldset className="citizen-card citizen-position">
                    <legend>{m.observationLocation}</legend>
                    <div className="citizen-capture-actions">
                      <button
                        type="button"
                        className="button"
                        disabled={gps.busy}
                        onClick={async () => {
                          const p = await gps.request();
                          if (p) {
                            position(p.latitude, p.longitude, "device");
                            setAccuracy(p.accuracy);
                          }
                        }}
                      >
                        <UiIcon name="myLocation" size={20} />
                        {gps.busy ? m.locating : m.myLocation}
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          gps.cancel();
                          journey.setPicking(null);
                          setPicking(true);
                          setMapOnMobile(true);
                        }}
                      >
                        <UiIcon name="map" size={20} />
                        {m.chooseOnMap}
                      </button>
                    </div>
                    {gpsError}
                    {lat && lon && (
                      <p className="citizen-position-value">
                        <UiIcon name="check" size={16} />
                        <span>
                        <strong>{source === "community"
                          ? t(
                              "Vị trí gần đúng theo thôn/bản",
                              "Approximate village location",
                            )
                          : source === "device"
                            ? t("Vị trí hiện tại", "Current location")
                            : source === "photo"
                              ? t(
                                  "Vị trí khi chụp ảnh",
                                  "Photo capture location",
                                )
                              : t("Vị trí đã chọn", "Selected location")}
                        {accuracy !== null
                          ? t(", sai số ±", ", accuracy ±") + Math.round(accuracy) + " m"
                          : ""}</strong>
                        <small>{Number(lat).toFixed(5)}, {Number(lon).toFixed(5)}</small>
                        </span>
                      </p>
                    )}
                    <label className="geodata-field">
                      {t(
                        "Hoặc chọn thôn, bản nơi xảy ra",
                        "Or choose the village where it happened",
                      )}
                      <select
                        value={source === "community" ? locationCommunity : ""}
                        onChange={(e) => {
                          const c = snapshot.communities.find(
                            (c) => c.id === e.target.value,
                          );
                          if (c) {
                            const p = roadGeographic(c.projected);
                            position(p.latitude, p.longitude, "community");
                            setLocationCommunity(c.id);
                          } else {
                            setLat("");
                            setLon("");
                            setLocationCommunity("");
                            setAccuracy(null);
                          }
                        }}
                      >
                        <option value="">{m.notSelected}</option>
                        {snapshot.communities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <details className="field-extra">
                      <summary>{t("Nhập tọa độ", "Enter coordinates")}</summary>
                      <div className="catalog-dates">
                        <label className="geodata-field">
                          {m.latitude}
                          <input
                            aria-label={m.reportLatitude}
                            type="number"
                            min="-85.05112878"
                            max="85.05112878"
                            step="any"
                            value={lat}
                            onChange={(e) => {
                              gps.cancel();
                              setLat(e.target.value);
                              setSource("manual");
                              setAccuracy(null);
                            }}
                          />
                        </label>
                        <label className="geodata-field">
                          {m.longitude}
                          <input
                            aria-label={m.reportLongitude}
                            type="number"
                            min="-180"
                            max="180"
                            step="any"
                            value={lon}
                            onChange={(e) => {
                              gps.cancel();
                              setLon(e.target.value);
                              setSource("manual");
                              setAccuracy(null);
                            }}
                          />
                        </label>
                      </div>
                    </details>
                  </fieldset>
                }
              />
            </section>
            {tab === "mine" && (
              <section>
                <h1>{m.submittedObservations}</h1>
                {!own.length ? (
                  <p className="citizen-empty">
                    {m.youHaveNotSubmittedAReport}
                  </p>
                ) : (
                  <ul className="citizen-submissions">
                    {own.map((record) => {
                      const s = submissionOf(record)!,
                        o = observationOf(record),
                        open = openSubmission === record.id;
                      const code =
                        record.name.match(/[A-Z]{2}-[A-Z0-9]{4,}$/)?.[0] ?? "";
                      const status = s.review.status;
                      return (
                        <li
                          key={record.id}
                          className="citizen-submission"
                          data-open={open || undefined}
                        >
                          <button
                            type="button"
                            className="citizen-submission-head"
                            aria-expanded={open}
                            onClick={() =>
                              setOpenSubmission(open ? null : record.id)
                            }
                          >
                            {o?.photos[0] ? (
                              <img src={o.photos[0].preview} alt="" />
                            ) : (
                              <span
                                className="citizen-submission-thumb"
                                aria-hidden="true"
                              >
                                <UiIcon name="image" />
                              </span>
                            )}
                            <span className="citizen-submission-text">
                              <strong>
                                {o
                                  ? observationLabel(o.kind, locale)
                                  : record.name}
                              </strong>
                              <small>
                                {[
                                  code,
                                  new Date(s.submittedAt).toLocaleString(
                                    locale === "vi" ? "vi-VN" : "en-GB",
                                    { dateStyle: "short", timeStyle: "short" },
                                  ),
                                ]
                                  .filter(Boolean)
                                  .map((value, index) => (
                                    <span key={index}>{value}</span>
                                  ))}
                              </small>
                            </span>
                            <span className={"citizen-review is-" + status}>
                              {status === "pending"
                                ? m.awaitingReview
                                : status === "checked"
                                  ? m.reviewed
                                  : status === "needs-info"
                                    ? m.moreInformationNeeded
                                    : m.notUsed}
                            </span>
                          </button>
                          {open && (
                            <div className="citizen-submission-body">
                              {s.review.note && (
                                <p className="citizen-review-note">
                                  {s.review.note}
                                </p>
                              )}
                              {o &&
                                (canEditSubmission(identity, record) ? (
                                  <ObservationEditor
                                    record={record}
                                    key={record.id + o.updatedAt}
                                    locale={locale}
                                    compact
                                    onSave={(value) =>
                                      gis.annotate(record.id, value, {
                                        [submissionKey]: {
                                          ...s,
                                          review: {
                                            status: "pending",
                                            note: "",
                                            reviewer: "",
                                            reviewedAt: "",
                                          },
                                          previousReview: s.review,
                                        },
                                      })
                                    }
                                  />
                                ) : (
                                  <>
                                    <dl className="field-metadata citizen-report-facts">
                                      <div><dt>{t('Ghi nhận lúc', 'Observed at')}</dt><dd>{observationTimeLabel(o, locale)}</dd></div>
                                      {record.feature.geometry.type === 'Point' && <div><dt>{t('Vị trí ghi nhận', 'Reported location')}</dt><dd>{record.feature.geometry.coordinates[1].toFixed(6)}, {record.feature.geometry.coordinates[0].toFixed(6)}</dd></div>}
                                    </dl>
                                    {o.note && (
                                      <p className="field-note">{o.note}</p>
                                    )}
                                    <VoicePlayback
                                      voice={o.voice}
                                      locale={locale}
                                    />
                                    <PhotoGallery
                                      photos={o.photos}
                                      locale={locale}
                                      reported={reportPhotoContext(record)}
                                    />
                                  </>
                                ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </aside>
        <section className="map-area citizen-map" aria-label={m.communityMap}>
          {routeSimulation ? <CitizenMovementControl simulation={routeSimulation} locale={locale}/> : <div className="citizen-map-context"><UiIcon name="map" size={16}/><span>{picking || journey.picking ? t('Chọn vị trí', 'Choose a location') : roadMode === 'local' ? t('Đường trong xã', 'Local roads') : roadMode === 'village' ? t('Đường về bản', 'Village access') : t('Tìm đường', 'Directions')}</span></div>}
          <div className="map-canvas">
            <Map2D selectedDeviceId={residentLocation?residentDeviceId:null} selfDeviceId={residentLocation?residentDeviceId:null} selfHeading={selfHeading} deviceFeed={mapFeed} routeSimulation={routeSimulation}
              contextGeometry={localAreas} contextMinZoom={12} selectedContextAreaId={localAreaId ?? inspectedRoad?.landslideAreaId}
              contextAlwaysVisibleAreaIds={linkedAreaIds} roadAreaLinks={roadAreaLinks} showRoadAreaLinks={layerOptions.landslide}
              onSelectContextArea={(id) => { setMapSelection({kind: 'localArea', id: id}); }}
              showOverview={false}
              routeGuidance
              alternativeRoutes={alternativeRoutes}
              comparisonRoute={comparisonRoute}
              onInspectRoad={(id) => { setMapSelection({kind: 'road', id: id}); }}
              onChooseRoute={id => { setMapSelection(null); journey.choose(id); }}
              roadAlerts={roadAlerts}
              analysisImagery={analysisDisplay}
              userLocation={residentLocation?null:gps.location}
              userLocationRequest={locationRequest}
              onBasemapState={setBasemap}
              locale={locale}
              terrain={defaultTerrain}
              imageUrl={manifest?.terrain.image?.url}
              viewportRef={viewport}
              viewControlRef={controls}
              profileOpen={false}
              locationOpen={false}
              locationPoint={null}
              onLocation={() => {}}
              measurementOpen={false}
              onCloseMeasurement={() => {}}
              measureSession={measure}
              dispatchMeasureSession={dispatch}
              gisRecords={mapRecords}
              gisSelectedId={selectedArea?.id ?? inspectedRoad?.landslideAreaId ?? (tab === "mine" ? ownSelected : null)}
              gisRequest={ownView}
              onGisSelect={(id) => {
                if (gis.records.some(record => record.id === id && landslideAreaOf(record))) {
                  setMapSelection({kind: 'area', id: id});
                } else {setMapSelection(null);setOwnSelected(id);setTab("mine");setMapOnMobile(false);}
              }}
              pointPickActive={picking || (journey.open && !!journey.picking)}
              onPointPick={(latitude, longitude, roadId) => {
                if (journey.picking) {
                  journey.pick(latitude, longitude, roadId);
                  setMapOnMobile(false);
                } else position(latitude, longitude, "map");
              }}
              journeyEndpoints={roadView ? journeyMarkers(journey) : []}
              journeyFitRequest={journey.fitSequence}
              onSelectOverlayHit={onHit}
              scenarioProps={{
                datasetVersion: packet.datasetVersion,
                aoi: packet.aoi,
                communities: roadMode === 'local' ? localCommunities : snapshot.communities,
                responseSites: roadMode === 'local' ? localSites : snapshot.responseSites,
                hazards: roadMode === 'local' ? [] : snapshot.hazards,
                roads: displayedRoads,
                selectedRoute: displayedRoute,
                // In a search the A and B pins mark the places; a second selected pin would cover them.
                selectedCommunityId: roadView && roadMode === "village" ? community : null,
                selectedObjectId: placeHazard ? `hazard:${placeHazard.id}` : shownRoadId && roadView ? `road:${shownRoadId}` : null,
                layers: {...citizenLayers, hlz: roadMode === 'local' && layerOptions.communities},
                appearance: defaultLayerAppearance,
              }}
            />
          </div>
          <div
            className="citizen-map-tools"
            role="group"
            aria-label={locale === "vi" ? "Điều khiển bản đồ" : "Map controls"}
          >
            <button
              className="icon-button"
              onClick={() => {if(roadMode==='local'&&!displayedRoute)setFitWholeNetwork(true);controls.current?.frameProjected?.(routeFramePoints);}}
              aria-label={t('Vừa bản đồ', 'Fit map')}
              title={t('Vừa bản đồ', 'Fit map')}
            >
              <UiIcon name="fit" />
            </button>
            <button
              className="icon-button"
              disabled={!residentLocation&&gps.busy}
              aria-label={m.myLocation}
              title={m.myLocation}
              onClick={async () => {
                const current=residentLocation?.getSnapshot()[0];
                if(!displayedRoute)setFitWholeNetwork(false);
                if(current){controls.current?.frameProjected?.([{x:current.point.x-350,y:current.point.y-350},{x:current.point.x+350,y:current.point.y+350}]);return;}
                const p = await gps.request();
                if (p) setLocationRequest((v) => v + 1);
              }}
            >
              <UiIcon name="location" />
            </button>
          </div>
          <div className="citizen-map-compass"><MapCompass locale={locale} supported={heading.supported} active={heading.active} heading={heading.heading} onToggle={() => void heading.toggle()}/></div>
          {(picking || journey.picking) && (
            <div className="citizen-pick-hint" role="status">
              {picking
                ? m.chooseTheObservationLocationOnTheMap
                : journey.picking === "start"
                  ? t(
                      "Chọn nơi xuất phát trên bản đồ",
                      "Choose the starting point on the map",
                    )
                  : t(
                      "Chọn nơi đến trên bản đồ",
                      "Choose the destination on the map",
                    )}
              <button
                className="button"
                onClick={() => {
                  setPicking(false);
                  journey.setPicking(null);
                  setMapOnMobile(false);
                }}
              >
                {m.cancel}
              </button>
            </div>
          )}
          <details className="citizen-map-layers">
            <summary aria-label={t('Hiển thị bản đồ', 'Map display')}><UiIcon name="layers" size={20}/><span>{t('Hiển thị', 'Map display')}</span></summary>
            <fieldset aria-label={t('Lớp bản đồ người dân', 'Resident map layers')}>
              {([['landslide',t('Vùng và điểm sạt lở','Landslide areas and points')],['status',t('Tình trạng đường','Road status')],['communities',t('Thôn, bản','Communities')],['imagery',t('Ảnh nền','Imagery')]] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={layerOptions[key]} onChange={() => setLayerOptions(previous => ({...previous,[key]:!previous[key]}))}/>{label}</label>)}
              <p>{t('Chạm vùng sạt để xem nguồn và thông tin.', 'Tap a landslide area for its source and details.')}</p>
              <div className="citizen-map-legend" aria-label={t('Chú giải đường', 'Road legend')}>
                <span><i style={{borderColor: roadColors.selected}}/>{roadMode === 'village' || journey.advised ? t('Đường nên đi', 'Suggested route') : t('Đường bạn chọn', 'Your chosen route')}</span>
                <span><i style={{borderColor: roadColors.alternative}}/>{t('Đường khác', 'Other routes')}</span>
                {layerOptions.status && <>
                  <span><i className="is-uncertain" style={{borderColor: roadColors.uncertain}}/>{roadMode === 'local' ? difficultRoadLabel(locale) : t('Cần hỏi lại', 'Check first')}</span>
                  <span><RoadConditionSymbol condition="blocked"/>{t('Bị chặn', 'Blocked')}</span>
                  {roadAlerts.some(road => roadCondition(road) === 'risk') && <span><RoadConditionSymbol condition="risk"/>{t('Có nguy cơ sạt lở', 'Landslide risk')}</span>}
                </>}
                {layerOptions.landslide && <span><i className="is-landslide-area"/>{t('Vùng sạt lở', 'Landslide area')}</span>}
                {layerOptions.landslide && mapRecords.some(record => landslideAreaOf(record)?.state === 'potential') && <span><i className="is-landslide-area is-potential"/>{t('Vùng có nguy cơ sạt lở', 'Area at risk of landslide')}</span>}
              </div>
            </fieldset>
          </details>
          {!picking && !journey.picking && !placeHazard && !placeArea && !localArea && <CitizenMapSummary
            locale={locale} route={displayedRoute} local={roadMode === 'local'} advised={roadMode === 'village' || journey.advised}
            comparison={!!comparisonRoute || alternativeRoutes.length > 0} blocked={roadAlerts.some(road => roadCondition(road) === 'blocked')} risk={roadAlerts.some(road => roadCondition(road) === 'risk')}
            endpoints={roadMode !== 'village' && journey.start && journey.end ? {
              from: [...localCommunities, ...snapshot.communities].find(place => `community:${place.id}` === journey.start?.source)?.name ?? localSites.find(site => `site:${site.id}` === journey.start?.source)?.name[locale === 'vi' ? 0 : 1] ?? journey.start.label ?? t('Điểm A', 'Point A'),
              to: [...localCommunities, ...snapshot.communities].find(place => `community:${place.id}` === journey.end?.source)?.name ?? localSites.find(site => `site:${site.id}` === journey.end?.source)?.name[locale === 'vi' ? 0 : 1] ?? journey.end.label ?? t('Điểm B', 'Point B'),
            } : undefined}
            place={mapPlace && roadMode === 'local' ? {name: mapPlace.name, onClose: () => setMapSelection(null), onDirections: () => {
              localJourney.setOpen(true); localJourney.setPoint('end', mapPlace.projected, `${mapPlace.kind === 'village' ? 'community' : 'site'}:${mapPlace.id}`, mapPlace.name); switchTab('roads');
            }} : undefined}
            road={inspectedRoad} onCloseRoad={() => setMapSelection(null)} onDetails={() => switchTab('roads')}
            nearestTeam={nearestTeam ? {name: nearestTeam.team.name[locale === 'vi' ? 0 : 1],
              detail: t(`Gần bạn nhất, ${(nearestTeam.distanceM / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 1})} km đường chim bay, ${teamStatus(nearestTeam.team, locale).text.toLocaleLowerCase('vi')}`,
                `Nearest, ${(nearestTeam.distanceM / 1000).toLocaleString('en-GB', {maximumFractionDigits: 1})} km straight-line, ${teamStatus(nearestTeam.team, locale).text.toLocaleLowerCase('en')}`),
              onShow: () => { const me = selfPoint(); controls.current?.frameProjected?.([nearestTeam.team.point, ...(me ? [me] : [])]); setMapOnMobile(true); }} : undefined}
            onFind={() => { showRoadMode(roadMode === 'local' ? 'local' : 'journey'); switchTab('roads'); }}
            onPlaces={() => { showRoadMode(hasLocalNetwork ? 'local' : 'village'); switchTab('roads'); }} loadError={roadMode === 'local' && local.error} onRetry={local.retry}/>}
          {localArea && !placeHazard && !placeArea && !picking && !journey.picking && <CitizenPlaceCard
            key={localArea.id} localArea={{ name: t(...localArea.name).replace(/ \([^)]*\)$/, '') }} road={localAreaRoad} locale={locale} local={roadMode === 'local'}
            onReport={() => reportAt(localArea.center)} onClose={() => setMapSelection(null)}/>}
          {(placeHazard || placeArea) && !picking && !journey.picking && <CitizenPlaceCard
            key={placeHazard?.id ?? selectedAreaId ?? ""}
            hazard={placeHazard} area={placeHazard ? undefined : placeArea} road={placeRoad} local={roadMode === 'local'}
            photos={placeHazard ? fieldPhotos.get(placeHazard.id) : undefined} locale={locale}
            onReport={() => {
              if (placeHazard) reportAt(placeHazard.projected);
              else if (selectedArea) {
                const [longitude, latitude] = pointOnFeature(selectedArea.feature).geometry.coordinates;
                setMapSelection(null); setTab("report"); setMessage(""); position(latitude, longitude, "map");
              }
            }}
            onClose={() => { setMapSelection(null); }}/>}
          <MapAttribution
            showLabel
            localSource={roadMode === 'local' ? ['Bản đồ đường và địa điểm Chế Tạo. Tình trạng đường chưa được kiểm tra tại chỗ.', 'Chế Tạo roads and places. Road conditions have not been checked on site.'] : undefined}
            analysisSource={layerOptions.imagery?analysisSourceInfo(analysisImagery.layers,analysisImagery.selection,locale):undefined}
            locale={locale}
            state={basemap}
            onRetry={() => controls.current?.retryBasemap()}
          />
        </section>
      </main>
      <nav className="citizen-mobile-switch" aria-label={m.residentTasks}>
        <button
          aria-pressed={mapOnMobile}
          onClick={() => setMapOnMobile(true)}
        >
          <UiIcon name="map" size={22}/>{m.map}
        </button>
        <button aria-pressed={!mapOnMobile && tab === 'roads'} onClick={() => switchTab('roads')}>
          <UiIcon name="route" size={22}/>{m.roadInformation}
        </button>
        <button aria-pressed={!mapOnMobile && tab === 'report'} onClick={() => {switchTab('report');setMessage('');}}><UiIcon name="camera" size={22}/>{m.reportAnObservation}</button>
        <button aria-pressed={!mapOnMobile && tab === 'mine'} onClick={() => switchTab('mine')}><UiIcon name="history" size={22}/>{m.myReports}</button>
      </nav>
      {help && (
        <UserGuide
          audience="resident"
          locale={locale}
          onClose={() => setHelp(false)}
        />
      )}
    </div>
  );
}
