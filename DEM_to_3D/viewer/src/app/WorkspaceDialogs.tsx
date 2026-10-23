import { PreparedImageryComparison } from '../features/imagery/PreparedImageryComparison';
import type {GeometryRecord} from '../geo/vector/types';
import type { AnalysisImageryState } from '../features/imagery/useAnalysisImagery';
import type { ScenarioTarget } from '../features/geodata/scenarioOverlay';
import type { ScenarioEdits } from '../features/access/scenarioEdits';
import { ReportInbox } from '../features/access/ReportInbox';
import type { RenameScenario } from '../features/access/ScenarioLabels';
import type { DemoIdentity } from '../features/access/demoSession';
import { submissionOf,submissionKey,newSubmission } from '../features/access/submissions';
import type { ComponentProps } from 'react';
import { UserGuide } from '../features/help/UserGuide';
import { NotificationDialog } from '../components/dear/NotificationDialog';
import { DataDialog } from '../components/dear/DataDialog';
import { EvidenceDialog } from '../components/dear/EvidenceDialog';
import type { IncidentPacket } from '../data/incidentPacket';
import type { ScenarioManifest } from '../data/scenarioManifest';
import { IncidentJournal } from '../features/incident/IncidentJournal';
import { ResponseWorkDialog } from '../features/incident/ResponseWorkDialog';
import type { ResponseWork, WorkEntry, WorkStatus } from '../features/incident/responseWork';
import type { IncidentWorkspaceSnapshot } from '../features/incident/deriveIncidentWorkspace';
import { preparedComparisonPair } from '../features/imagery/preparedComparison';
import { ImageCompareDialog } from '../features/comparison/ImageCompareDialog';
import type { ComparisonPair } from '../features/comparison/comparison';
import { DecisionExportDialog } from '../features/briefing/DecisionExportDialog';
import type { DecisionSnapshot } from '../features/briefing/decisionSnapshot';
import { TerrainUploadDialog } from '../features/terrain/TerrainUploadDialog';
import type { useGeometrySession } from '../features/geodata/useGeometrySession';
import { GeometryWorkspace } from '../features/geodata/GeometryWorkspace';
import type { Locale } from '../types/dear';
import type { TerrainData, TerrainMetadata } from '../types/terrain';
import type { WorkspaceDialog } from './workspaceInteraction';

type Props = {
  analysisImagery?: AnalysisImageryState;
  comparisonRecord?:GeometryRecord;
  identity: DemoIdentity; onRename: RenameScenario; scenarioEdits?: ScenarioEdits; onEditGis: (id:string)=>void;
  scenarioRequest?: ScenarioTarget | null; onResponseScenario?: (target:ScenarioTarget)=>void;
  gisSession: ReturnType<typeof useGeometrySession>; onGisResponse:(id:string)=>void;
  dialog: WorkspaceDialog;
  locale: Locale;
  offline: boolean;
  packet: IncidentPacket;
  snapshot: IncidentWorkspaceSnapshot;
  updated: boolean;
  reportApplied: boolean;
  historical: boolean;
  workTasks:ResponseWork[];workTaskId:string | null;workEntries:WorkEntry[];workStorageError:boolean;appliedAt:string | null;
  onRecordWork:(task:ResponseWork,status:WorkStatus,note:string,owner:string)=>void;
  onVerifyRoad?:(roadId:string,status:'open'|'blocked',note:string)=>boolean;
  onVerifyHazard?:(hazardId:string,confirmed:boolean,note:string)=>boolean;
  comparisonPair: ComparisonPair | null;
  onComparisonPair: (pair: ComparisonPair | null) => void;
  decisionSnapshot: DecisionSnapshot | null;
  evidenceId: string | null;
  terrain: TerrainData | null;
  terrainMetadata?: TerrainMetadata;
  manifest: ScenarioManifest | null;
  upload: Omit<ComponentProps<typeof TerrainUploadDialog>, 'locale' | 'onClose'>;
  onClose: () => void;
  onOpenReport: () => void;
  onApplyReport: () => void;
  onRevision: (historical: boolean) => void;
  onInspectObject: (id: string) => void;
};

/** Global dialogs share the workspace's focus boundary; Layers stays attached to the map. */
export function WorkspaceDialogs({ analysisImagery,comparisonRecord, identity,onRename,scenarioEdits,scenarioRequest,onResponseScenario,onEditGis,gisSession,onGisResponse,dialog, locale, offline, packet, snapshot, updated, reportApplied,
  historical, workTasks,workTaskId,workEntries,workStorageError,onRecordWork,onVerifyRoad,onVerifyHazard,appliedAt,comparisonPair, onComparisonPair, decisionSnapshot, evidenceId, terrain,
  terrainMetadata, manifest, upload, onClose, onOpenReport, onApplyReport, onRevision,
  onInspectObject }: Props): JSX.Element | null {
  const { incident, roads, hazards, evidence } = snapshot;
  switch (dialog) {
    case null:
    case 'layers':
      return null;
    case 'fieldReports':
      return <ReportInbox locale={locale} identity={identity} session={gisSession} onClose={onClose} onShow={onGisResponse} onEdit={onEditGis}/>;
    case 'help':
      return <UserGuide locale={locale} onClose={onClose}/>;
    case 'comparison':
      if(analysisImagery && (['optical','sar'] as const).some(kind=>preparedComparisonPair(analysisImagery.layers,kind)) && !comparisonPair)return <PreparedImageryComparison layers={analysisImagery.layers} records={gisSession.records} selected={comparisonRecord} locale={locale} onClose={onClose}/>;
      return <ImageCompareDialog pair={comparisonPair} onPair={onComparisonPair} triggeredAt={incident.triggeredAt} locale={locale} onClose={onClose} />;
    case 'geodata':
      return <GeometryWorkspace analysisImagery={analysisImagery} scenarioRequest={scenarioRequest} onResponseScenario={onResponseScenario} locale={locale} offline={offline} onClose={onClose} session={gisSession} annotationProperties={(id,records)=>{const record=records.find(r=>r.id===id);return {[submissionKey]:record&&submissionOf(record) || newSubmission(identity,'manual')};}} onResponse={onGisResponse} scenario={{ datasetVersion: packet.datasetVersion, communities: snapshot.communities, responseSites: snapshot.responseSites, hazards, roads }} scenarioEdits={scenarioEdits} onRenameScenario={onRename}/>;
    case 'exportDecision':
      return decisionSnapshot ? <DecisionExportDialog snapshot={decisionSnapshot} terrain={terrain} imageUrl={manifest?.terrain.image?.url} locale={locale} onClose={onClose} /> : null;
    case 'alerts':
      return <NotificationDialog locale={locale} report={packet.report} road={roads.find(road => road.id === packet.report.roadId)} updated={reportApplied} historical={historical} onApplyReport={onApplyReport} onClose={onClose} onSelectRoad={onInspectObject} />;
    case 'notificationCenter':
    case 'timeline':
      return <IncidentJournal packet={packet} applied={reportApplied} historical={historical} appliedAt={appliedAt} entries={workEntries} edits={scenarioEdits?.edits} locale={locale} onClose={onClose} onOpenReport={onOpenReport} onInspect={onInspectObject} onRevision={onRevision} initialFilter={dialog === 'notificationCenter' ? 'report' : 'all'}/>;
    case 'responseWork':
      return <ResponseWorkDialog tasks={workTasks} initialTaskId={workTaskId} entries={workEntries} locale={locale} readOnly={historical && reportApplied} storageError={workStorageError} onRecord={onRecordWork} onVerifyRoad={onVerifyRoad} onVerifyHazard={onVerifyHazard} onInspect={id=>{onClose();onInspectObject(id);}} onReport={onOpenReport} onClose={onClose}/>;
    case 'data':
      return <DataDialog incident={incident} locale={locale} updated={updated} manifest={terrain ? manifest : null} terrainMetadata={terrainMetadata} onClose={onClose} />;
    case 'evidence':
      return evidenceId ? <EvidenceDialog evidence={evidence.find(item => item.hazardId === evidenceId)} hazard={hazards.find(item => item.id === evidenceId)} roads={roads} locale={locale} onClose={onClose} onSelectRoad={onInspectObject} /> : null;
    case 'upload':
      return <TerrainUploadDialog {...upload} locale={locale} onClose={onClose} />;
    default: {
      const unhandled: never = dialog;
      throw new Error(`Unknown workspace dialog: ${unhandled}`);
    }
  }
}
