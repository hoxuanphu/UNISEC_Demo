import type { ComponentProps } from 'react';
import { NotificationDialog } from '../components/dear/NotificationDialog';
import { DataDialog } from '../components/dear/DataDialog';
import { TimelineDialog } from '../components/dear/TimelineDialog';
import { EvidenceDialog } from '../components/dear/EvidenceDialog';
import type { IncidentPacket } from '../data/incidentPacket';
import type { ScenarioManifest } from '../data/scenarioManifest';
import { NotificationCenter } from '../features/incident/NotificationCenter';
import type { IncidentWorkspaceSnapshot } from '../features/incident/deriveIncidentWorkspace';
import { ImageCompareDialog } from '../features/comparison/ImageCompareDialog';
import type { ComparisonPair } from '../features/comparison/comparison';
import { DecisionExportDialog } from '../features/briefing/DecisionExportDialog';
import type { DecisionSnapshot } from '../features/briefing/decisionSnapshot';
import { TerrainUploadDialog } from '../features/terrain/TerrainUploadDialog';
import type { Locale } from '../types/dear';
import type { TerrainData, TerrainMetadata } from '../types/terrain';
import type { WorkspaceDialog } from './workspaceInteraction';

type Props = {
  dialog: WorkspaceDialog;
  locale: Locale;
  packet: IncidentPacket;
  snapshot: IncidentWorkspaceSnapshot;
  updated: boolean;
  reportApplied: boolean;
  historical: boolean;
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
export function WorkspaceDialogs({ dialog, locale, packet, snapshot, updated, reportApplied,
  historical, comparisonPair, onComparisonPair, decisionSnapshot, evidenceId, terrain,
  terrainMetadata, manifest, upload, onClose, onOpenReport, onApplyReport, onRevision,
  onInspectObject }: Props): JSX.Element | null {
  const { incident, roads, hazards, evidence } = snapshot;
  switch (dialog) {
    case null:
    case 'layers':
      return null;
    case 'comparison':
      return <ImageCompareDialog pair={comparisonPair} onPair={onComparisonPair} triggeredAt={incident.triggeredAt} locale={locale} onClose={onClose} />;
    case 'exportDecision':
      return decisionSnapshot ? <DecisionExportDialog snapshot={decisionSnapshot} terrain={terrain} imageUrl={manifest?.terrain.image?.url} locale={locale} onClose={onClose} /> : null;
    case 'alerts':
      return <NotificationDialog locale={locale} report={packet.report} road={roads.find(road => road.id === packet.report.roadId)} updated={reportApplied} historical={historical} onApplyReport={onApplyReport} onClose={onClose} onSelectRoad={onInspectObject} />;
    case 'notificationCenter':
      return <NotificationCenter packet={packet} applied={reportApplied} locale={locale} onClose={onClose} onOpenReport={onOpenReport} onInspect={onInspectObject} />;
    case 'timeline':
      return <TimelineDialog locale={locale} incident={incident} report={packet.report} updated={reportApplied} historical={historical} onRevision={onRevision} onClose={onClose} />;
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
