import { useRef, type Dispatch } from 'react';
import { IncidentView } from '../components/dear/IncidentView';
import { ImpactView } from '../components/dear/ImpactView';
import { CommunityListView } from '../components/dear/CommunityListView';
import { CommunityDetailView } from '../components/dear/CommunityDetailView';
import { ObjectDetailView } from '../components/dear/ObjectDetailView';
import type { IncidentPacket } from '../data/incidentPacket';
import type { IncidentWorkspaceSnapshot } from '../features/incident/deriveIncidentWorkspace';
import { usePanelScroll } from '../shared/hooks/usePanelScroll';
import type { Community, Locale, ScenarioRoutePair } from '../types/dear';
import type { ResponseWork, WorkEntry } from '../features/incident/responseWork';
import { selectedMapObject, type NavigationAction, type WorkspaceNavigation } from './workspaceNavigation';

type Props = {
  locale: Locale;
  navigation: WorkspaceNavigation;
  onNavigate: Dispatch<NavigationAction>;
  snapshot: IncidentWorkspaceSnapshot;
  aoi: IncidentPacket['aoi'];
  updated: boolean;
  workTasks:ResponseWork[];workEntries:WorkEntry[];reportPending:boolean;historical:boolean;
  onOpenWork:(id?:string)=>void;onOpenReport:()=>void;
  ready: boolean;
  unavailable: boolean;
  onRetry: () => void;
  community: Community | null;
  routePair: ScenarioRoutePair | null;
  terrainCoverage: Map<string, boolean> | null;
  hasTerrainProfile: boolean;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onChangeRoute: (type: 'candidate' | 'direct') => void;
  onSelectCommunity: (id: string) => void;
  onInspectObject: (id: string) => void;
  onRevealPanel: () => void;
  onResetTools: () => void;
  onOpenDialog: (dialog: 'data' | 'timeline') => void;
  onOpenEvidence: (hazardId: string) => void;
  onExport: () => void;
};

/** Chooses panel content and restores each screen's scroll position. No map or modal state. */
export function ResponsePanel({ locale, navigation, onNavigate, snapshot, aoi, updated,workTasks,workEntries,reportPending,historical,onOpenWork,onOpenReport,
  ready, unavailable, onRetry, community, routePair, terrainCoverage, hasTerrainProfile, profileOpen,
  onToggleProfile, onChangeRoute, onSelectCommunity, onInspectObject, onRevealPanel, onResetTools,
  onOpenDialog, onOpenEvidence, onExport }: Props): JSX.Element {
  const { view, selectedCommunityId, selectedRouteType, detailTab, roadFilter,
    communityFilter, roadQuery, impactTab, communityQuery } = navigation;
  const { roads, hazards, evidence, routes, assessments, communities, incident, responseSites } = snapshot;
  const objectId = selectedMapObject(navigation);
  const panelRef = useRef<HTMLElement>(null);
  const screenKey = view === 'priority'
    ? selectedCommunityId ? `community:${selectedCommunityId}:${detailTab}` : `priority:${communityFilter}:${communityQuery}`
    : objectId ? `object:${objectId}`
    : view === 'impact' ? `impact:${impactTab}:${roadFilter}:${roadQuery}` : 'incident';
  usePanelScroll(panelRef, screenKey);

  const openCommunities = () => {
    onNavigate({ type: 'filters', values: { communityFilter: 'all', communityQuery: '' } });
    onNavigate({ type: 'view', view: 'priority', list: true });
    onRevealPanel();
  };

  let content: JSX.Element;
  if (!ready) {
    content = <div className="sidebar-top">
      <h1>{unavailable ? (locale === 'vi' ? 'Chưa tải được dữ liệu' : 'Dataset unavailable') : (locale === 'vi' ? 'Đang tải dữ liệu' : 'Loading dataset')}</h1>
      {unavailable && <button className="button soft" onClick={onRetry}>{locale === 'vi' ? 'Thử lại' : 'Retry'}</button>}
    </div>;
  } else if (view === 'priority' && community && routePair) {
    content = <CommunityDetailView
      community={community}
      terrainCovered={terrainCoverage?.get(community.id) ?? null}
      assessment={assessments.get(community.id)!}
      hazards={hazards}
      evidence={evidence}
      locale={locale}
      detailTab={detailTab}
      onChangeDetailTab={detailTab => onNavigate({ type: 'filters', values: { detailTab } })}
      onBack={() => { onNavigate({ type: 'close-community' }); onResetTools(); }}
      candidateRoute={routePair.candidate}
      directRoute={routePair.direct}
      selectedRouteType={selectedRouteType}
      onChangeRouteType={onChangeRoute}
      hasTerrainProfile={hasTerrainProfile}
      onToggleProfile={onToggleProfile}
      onOpenSources={() => onOpenDialog('data')}
      onSelectObject={onInspectObject}
      onOpenEvidence={onOpenEvidence}
      onExport={onExport}
    />;
  } else if (view !== 'priority' && objectId) {
    content = <ObjectDetailView
      objectId={objectId}
      parentName={navigation.objectOrigins[view] === 'priority' ? community?.name : undefined}
      aoi={aoi}
      locale={locale}
      roads={roads}
      hazards={hazards}
      evidence={evidence}
      communities={communities}
      responseSites={responseSites}
      routes={routes}
      hasTerrainProfile={hasTerrainProfile}
      profileOpen={profileOpen}
      onToggleProfile={onToggleProfile}
      onBack={() => { onNavigate({ type: 'close-object' }); onResetTools(); }}
      onSelectCommunity={onSelectCommunity}
      onSelectObject={onInspectObject}
      onOpenEvidence={onOpenEvidence}
      onOpenPriority={openCommunities}
    />;
  } else if (view === 'incident') {
    content = <IncidentView
      incident={incident}
      areaName={aoi.name}
      onOpenArea={() => onInspectObject(`aoi:${aoi.id}`)}
      locale={locale}
      updated={updated}
      tasks={workTasks}
      entries={workEntries}
      reportPending={reportPending}
      historical={historical}
      onOpenWork={onOpenWork}
      onOpenReport={onOpenReport}
      communities={communities}
      routes={routes}
      assessments={assessments}
      blockedRoadCount={roads.filter(road => road.status === 'blocked').length}
      uncertainRoadCount={roads.filter(road => road.status === 'uncertain').length}
      onSelectCommunity={onSelectCommunity}
      onOpenTimeline={() => onOpenDialog('timeline')}
      onOpenData={() => onOpenDialog('data')}
      onOpenCommunities={openCommunities}
      onOpenRoads={filter => { onNavigate({ type: 'road-list', filter }); onRevealPanel(); }}
    />;
  } else if (view === 'impact') {
    content = <ImpactView
      roads={roads}
      hazards={hazards}
      locale={locale}
      roadFilter={roadFilter}
      query={roadQuery}
      onChangeQuery={roadQuery => onNavigate({ type: 'filters', values: { roadQuery } })}
      tab={impactTab}
      onChangeTab={impactTab => onNavigate({ type: 'filters', values: { impactTab } })}
      onChangeRoadFilter={roadFilter => onNavigate({ type: 'filters', values: { roadFilter } })}
      onSelectObject={onInspectObject}
    />;
  } else {
    content = <CommunityListView
      communities={communities}
      locale={locale}
      filter={communityFilter}
      query={communityQuery}
      onChangeQuery={communityQuery => onNavigate({ type: 'filters', values: { communityQuery } })}
      onChangeFilter={communityFilter => onNavigate({ type: 'filters', values: { communityFilter } })}
      onSelectCommunity={onSelectCommunity}
      selectedId={selectedCommunityId}
      routes={routes}
    />;
  }

  return <aside id="response-panel" ref={panelRef} className="sidebar" aria-label={locale === 'vi' ? 'Thông tin ứng phó' : 'Response information'}>{content}</aside>;
}
