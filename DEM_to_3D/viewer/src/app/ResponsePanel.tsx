import { useRef } from 'react';
import { IncidentView } from '../components/dear/IncidentView';
import { ImpactView } from '../components/dear/ImpactView';
import { CommunityListView } from '../components/dear/CommunityListView';
import { usePanelScroll } from '../shared/hooks/usePanelScroll';
import type { ResponsePanelProps } from './responsePanelTypes';
import type { PreparedPhotoPoint } from '../features/fieldPhotos/preparedPhotos';
import type { HouseholdAccess } from '../features/presence/householdIsolation';

type Props = Pick<
  ResponsePanelProps,
  | 'locale'
  | 'navigation'
  | 'onNavigate'
  | 'snapshot'
  | 'aoi'
  | 'updated'
  | 'workTasks'
  | 'workEntries'
  | 'reportPending'
  | 'pendingReport'
  | 'onApplyReport'
  | 'historical'
  | 'onOpenWork'
  | 'onOpenReport'
  | 'ready'
  | 'unavailable'
  | 'onRetry'
  | 'onSelectCommunity'
  | 'onInspectObject'
  | 'onRevealPanel'
  | 'onOpenDialog'
> & {
  /** Prepared survey photos by hazard ID. */
  fieldPhotos?: Map<string, PreparedPhotoPoint>;
  /** @deprecated The overview no longer lists reference datasets; GIS owns them. */
  survey?: {areas:number;points:number}; onShowSurvey?:()=>void; onShowCorridor?:()=>void;
  households?: HouseholdAccess[]; onSelectHousehold?: (id: string) => void; onShowHouseholds?: () => void;
  rescueTeams?: import('react').ReactNode;
};

/** Lists retain their context and scroll while a selected item opens in the detail surface. */
export function ResponsePanel({
  locale,
  navigation,
  onNavigate,
  snapshot,
  aoi,
  workTasks,
  workEntries,
  reportPending,
  pendingReport,
  historical,
  onOpenWork,
  onOpenReport,
  ready,
  unavailable,
  onRetry,
  onSelectCommunity,
  onInspectObject,
  onRevealPanel,
  onOpenDialog, fieldPhotos, households, onSelectHousehold, onShowHouseholds, rescueTeams
}: Props): JSX.Element {
  const {
    view,
    selectedCommunityId,
    roadFilter,
    communityFilter,
    roadQuery,
    impactTab,
    communityQuery
  } = navigation;
  const { roads, hazards, routes, assessments, communities, incident } =
    snapshot;
  const panelRef = useRef<HTMLElement>(null);
  const screenKey =
    view === 'priority'
      ? `priority:${communityFilter}:${communityQuery}`
      : view === 'impact'
        ? `impact:${impactTab}:${roadFilter}:${roadQuery}`
        : 'incident';
  usePanelScroll(panelRef, screenKey);

  const openCommunities = () => {
    onNavigate({
      type: 'filters',
      values: { communityFilter: 'priority', communityQuery: '' }
    });
    onNavigate({ type: 'view', view: 'priority', list: true });
    onRevealPanel();
  };

  let content: JSX.Element;
  if (!ready) {
    content = (
      <div className="sidebar-top">
        <h1>
          {unavailable
            ? locale === 'vi'
              ? 'Chưa tải được dữ liệu'
              : 'Dataset unavailable'
            : locale === 'vi'
              ? 'Đang tải dữ liệu'
              : 'Loading dataset'}
        </h1>
        {unavailable && (
          <button className="button soft" onClick={onRetry}>
            {locale === 'vi' ? 'Thử lại' : 'Retry'}
          </button>
        )}
      </div>
    );
  } else if (view === 'incident') {
    content = (
      <IncidentView
        incident={incident}
        hazards={hazards}
        roads={roads}
        fieldPhotos={fieldPhotos}
        onInspectObject={onInspectObject}
        areaName={aoi.name}
        onOpenArea={() => onInspectObject(`aoi:${aoi.id}`)}
        locale={locale}
        tasks={workTasks}
        entries={workEntries}
        reportPending={reportPending}
        pendingReport={pendingReport}
        historical={historical}
        onOpenWork={onOpenWork}
        onOpenReport={onOpenReport}
        communities={communities}
        routes={routes}
        assessments={assessments}
        onSelectCommunity={onSelectCommunity}
        onOpenCommunities={openCommunities}
        households={households}
        onSelectHousehold={onSelectHousehold}
        onShowHouseholds={onShowHouseholds}
        rescueTeams={rescueTeams}
        onOpenRoads={(filter) => {
          onNavigate({ type: 'road-list', filter });
          onRevealPanel();
        }}
      />
    );
  } else if (view === 'impact') {
    content = (
      <ImpactView
        roads={roads}
        hazards={hazards}
        locale={locale}
        roadFilter={roadFilter}
        query={roadQuery}
        onChangeQuery={(roadQuery) =>
          onNavigate({ type: 'filters', values: { roadQuery } })
        }
        tab={impactTab}
        onChangeTab={(impactTab) =>
          onNavigate({ type: 'filters', values: { impactTab } })
        }
        onChangeRoadFilter={(roadFilter) =>
          onNavigate({ type: 'filters', values: { roadFilter } })
        }
        onSelectObject={onInspectObject}
        selectedId={navigation.objectIds.impact}
      />
    );
  } else {
    content = (
      <CommunityListView
        communities={communities}
        locale={locale}
        filter={communityFilter}
        query={communityQuery}
        onChangeQuery={(communityQuery) =>
          onNavigate({ type: 'filters', values: { communityQuery } })
        }
        onChangeFilter={(communityFilter) =>
          onNavigate({ type: 'filters', values: { communityFilter } })
        }
        onSelectCommunity={onSelectCommunity}
        selectedId={selectedCommunityId}
        routes={routes}
      />
    );
  }

  return (
    <aside
      id="response-panel"
      ref={panelRef}
      className="sidebar"
      aria-label={
        locale === 'vi' ? 'Thông tin ứng phó' : 'Response information'
      }
    >
      {content}
    </aside>
  );
}
