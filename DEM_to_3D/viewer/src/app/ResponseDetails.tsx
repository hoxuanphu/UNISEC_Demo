import { ResponseObservationCard } from '../features/observations/ResponseObservationCard';
import type { PreparedPhotoPoint } from '../features/fieldPhotos/preparedPhotos';
import type { ScenarioTarget } from '../features/geodata/scenarioOverlay';
import type { GeometryRecord } from '../geo/vector/types';
import { UiIcon } from '../shared/ui/UiIcon';
import { useEffect, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { CommunityDetailView } from '../components/dear/CommunityDetailView';
import { ObjectDetailView } from '../components/dear/ObjectDetailView';
import { usePanelScroll } from '../shared/hooks/usePanelScroll';
import { selectedMapObject } from './workspaceNavigation';
import { workState } from '../features/incident/responseWork';
import type { ResponsePanelProps } from './responsePanelTypes';
import type { CommunitySignal } from '../features/incident/responseAssessment';
import './response-details.css';

type Props = Pick<
  ResponsePanelProps,
  | 'locale'
  | 'navigation'
  | 'onNavigate'
  | 'snapshot'
  | 'aoi'
  | 'ready'
  | 'community'
  | 'routePair'
  | 'terrainCoverage'
  | 'hasTerrainProfile'
  | 'profileOpen'
  | 'onToggleProfile'
  | 'onChangeRoute'
  | 'onSelectRouteSection'
  | 'onSelectCommunity'
  | 'onInspectObject'
  | 'onRevealPanel'
  | 'onResetTools'
  | 'onOpenDialog'
  | 'onOpenEvidence'
  | 'onExport'
  | 'scenarioEdits'
  | 'workTasks'
  | 'workEntries'
  | 'onOpenWork'
> & { onCompareImagery?:()=>void; gisRecords?: GeometryRecord[]; gisRecord?: GeometryRecord; gisRoads: ComponentProps<typeof ResponseObservationCard>['roads']; onCloseGis: () => void; onEditGis: () => void; onBackToGisGroup?: () => void; visible: boolean; onReturnFocus: () => void; onEditScenario?: (target:ScenarioTarget)=>void; mappedAreas?: GeometryRecord[]; onOpenMappedArea?: (id: string) => void;
  onSetRoadStatus?: ComponentProps<typeof ObjectDetailView>['onSetRoadStatus']; onRevertEdit?: (editId: string) => boolean;
  signals?: Record<string, CommunitySignal>; fieldPhotos?: Map<string, PreparedPhotoPoint>;
  /** Objects the workspace details itself, such as a rescue team; null for the others. */
  renderObject?: (objectId: string, close: () => void) => JSX.Element | null;
  siteContent?: ComponentProps<typeof ObjectDetailView>['siteContent'] };

/** One detail surface: map dock on wide screens, the information pane on compact screens. */
export function ResponseDetails({
  onCompareImagery,gisRecords, gisRecord, gisRoads, onCloseGis, onEditGis, onBackToGisGroup,
  fieldPhotos,
  locale,
  navigation,
  onNavigate,
  snapshot,
  aoi,
  ready,
  community,
  routePair,
  terrainCoverage,
  hasTerrainProfile,
  profileOpen,
  onToggleProfile,
  onChangeRoute,
  onSelectRouteSection,
  onSelectCommunity,
  onInspectObject,
  onRevealPanel,
  onResetTools,
  onOpenDialog,
  onOpenEvidence,
  onExport,
  scenarioEdits,
  onSetRoadStatus,
  onRevertEdit,
  signals,
  workTasks,
  workEntries,
  onOpenWork,
  onEditScenario,
  visible,
  onReturnFocus,
  mappedAreas, onOpenMappedArea, renderObject, siteContent
}: Props): JSX.Element | null {
  const { view, selectedRouteType, detailTab } = navigation;
  const {
    roads,
    hazards,
    evidence,
    routes,
    assessments,
    communities,
    responseSites
  } = snapshot;
  const objectId = selectedMapObject(navigation);
  const panelRef = useRef<HTMLElement>(null);
  const focusedDetail = useRef('');
  const detailKey = gisRecord ? `gis:${gisRecord.id}` :
    view === 'priority' && community
      ? `community:${community.id}`
      : objectId
        ? `object:${objectId}`
        : '';
  usePanelScroll(panelRef, `${detailKey}:${detailTab}`);
  useLayoutEffect(() => {
    if (!detailKey) {
      focusedDetail.current = '';
      return;
    }
    if (!visible || focusedDetail.current === detailKey) return;
    const heading = panelRef.current?.querySelector<HTMLElement>('h1, h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      focusedDetail.current = detailKey;
    }
  }, [detailKey, visible]);

  useEffect(()=>{
    if(!visible||!objectId||!/^(device|team):/.test(objectId))return;
    const dismiss=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||event.defaultPrevented||document.querySelector('[role="dialog"],dialog[open],.tracked-device-card:not([hidden])'))return;
      event.preventDefault();onNavigate({type:'close-object'});onResetTools();onReturnFocus();
    };
    document.addEventListener('keydown',dismiss);
    return()=>document.removeEventListener('keydown',dismiss);
  },[visible,objectId,onNavigate,onResetTools,onReturnFocus]);

  const openCommunities = () => {
    onNavigate({
      type: 'filters',
      values: { communityFilter: 'all', communityQuery: '' }
    });
    onNavigate({ type: 'view', view: 'priority', list: true });
    onRevealPanel();
    onReturnFocus();
  };

  const customContent = view !== 'priority' && objectId ? renderObject?.(objectId, () => {
    onNavigate({ type: 'close-object' });
    onResetTools();
    onReturnFocus();
  }) : null;
  let content: JSX.Element;
  if (!ready) return null;
  if (gisRecord) {
    content = <ResponseObservationCard onCompare={onCompareImagery} key={gisRecord.id} docked record={gisRecord} records={gisRecords} fieldPhotos={fieldPhotos} locale={locale}
      roads={gisRoads} onRoad={id => onInspectObject('road:'+id)} onClose={onCloseGis}
      onEdit={onEditGis} onBack={onBackToGisGroup}/>;
  } else if (view === 'priority' && community && routePair) {
    content = (
      <CommunityDetailView
        community={community}
        originName={responseSites.find(site => site.kind === 'staging')?.name[locale === 'vi' ? 0 : 1]}
        terrainCovered={terrainCoverage?.get(community.id) ?? null}
        assessment={assessments.get(community.id)!}
        hazards={hazards}
        evidence={evidence}
        locale={locale}
        detailTab={detailTab}
        onChangeDetailTab={(detailTab) =>
          onNavigate({ type: 'filters', values: { detailTab } })
        }
        onClose={() => {
          onNavigate({ type: 'close-community' });
          onResetTools();
          onReturnFocus();
        }}
        candidateRoute={routePair.candidate}
        directRoute={routePair.direct}
        selectedRouteType={selectedRouteType}
        onChangeRouteType={onChangeRoute}
        sectionId={navigation.routeSectionId}
        onSelectSection={onSelectRouteSection}
        hasTerrainProfile={hasTerrainProfile}
        onToggleProfile={onToggleProfile}
        onOpenSources={() => onOpenDialog('data')}
        onOpenEvidence={onOpenEvidence}
        onExport={onExport}
        signal={signals?.[community.id]}
      />
    );
  } else if (customContent) {
    content = customContent;
  } else if (view !== 'priority' && objectId) {
    content = (
      <ObjectDetailView
        siteContent={siteContent}
        objectId={objectId}
        fieldPhotos={fieldPhotos}
        mappedAreas={mappedAreas}
        onOpenMappedArea={onOpenMappedArea}
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
        onClose={() => {
          onNavigate({ type: 'close-object' });
          onResetTools();
          onReturnFocus();
        }}
        onSelectCommunity={onSelectCommunity}
        onSelectObject={onInspectObject}
        onOpenEvidence={onOpenEvidence}
        onOpenPriority={openCommunities}
        scenarioEdits={scenarioEdits}
        onSetRoadStatus={onSetRoadStatus}
        verification={(() => {
          const task = objectId && /^(road|hazard):/.test(objectId) ? workTasks.find(item => item.id === objectId) : undefined;
          return task ? { taskId: task.id, ...workState(task, workEntries) } : undefined;
        })()}
        onOpenWork={onOpenWork}
        onRevertEdit={onRevertEdit}
      />
    );
  } else return null;

  return (
    <aside
      id="response-details"
      ref={panelRef}
      className="response-detail-dock"
      hidden={!visible}
      aria-label={locale === 'vi' ? 'Chi tiết đang chọn' : 'Selected details'}
    >
      {content}
      {!gisRecord && onEditScenario && detailKey && (() => {
        const target:ScenarioTarget|null = view==='priority'&&community ? {type:'community',id:community.id} : objectId && ['road','hazard','poi'].includes(objectId.split(':')[0]) ?
          {type:objectId.split(':')[0]==='poi'?'site':objectId.split(':')[0] as 'road'|'hazard',id:objectId.slice(objectId.indexOf(':')+1)} : null;
        return target && <div className="response-detail-edit"><button className="button" onClick={()=>onEditScenario(target)}><UiIcon name="edit" size={16}/>{locale==='vi'?'Sửa trong GIS':'Edit in GIS'}</button></div>;
      })()}
    </aside>
  );
}
