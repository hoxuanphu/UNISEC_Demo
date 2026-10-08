import type { IncidentPacket } from '../../data/incidentPacket';
import type { Community, Hazard, IncidentEvidence, RoadSegment, ScenarioRoute } from '../../types/dear';
import type { ResponseAssessment } from '../incident/responseAssessment';
import type { ScenarioManifest } from '../../data/scenarioManifest';
import { routingPolicy } from '../routes/networkRouting';

export type DecisionSnapshot = ReturnType<typeof createDecisionSnapshot>;

/** Capture one coherent revision, independent of subsequent workspace changes. */
export function createDecisionSnapshot(input: {
  packet: IncidentPacket; updated: boolean; community: Community; assessment: ResponseAssessment;
  route: ScenarioRoute | null; roads: RoadSegment[]; hazards: Hazard[]; evidence: IncidentEvidence[]; communities: Community[];
  terrainAssets?: ScenarioManifest['terrain'];
}) {
  const { packet, updated, community, assessment, route, roads, hazards, evidence } = input;
  return structuredClone({
    format: 'dear-decision-v1' as const,
    incidentId: packet.incident.id,
    datasetVersion: packet.datasetVersion,
    dataKind: packet.dataKind,
    reviewStatus: packet.reviewStatus,
    asOf: updated ? packet.incident.asOfUpdated : packet.incident.asOf,
    appliedReportIds: updated ? [packet.report.id] : [],
    crs: packet.crs,
    community, assessment, route, roads, hazards, evidence,
    aoi: packet.aoi,
    communities: input.communities,
    responseSites: packet.responseSites,
    routingAssumptions: packet.routingAssumptions,
    routingMethod: { ...routingPolicy, candidateCalculation: 'exclude-blocked-edges',
      inspectionGeometry: 'retain-known-routes-even-if-blocked' },
    terrainAssets: input.terrainAssets,
    sources: packet.incident.sources.map(source => ({ ...source,
      observedAt: updated && source.observedAtUpdated ? source.observedAtUpdated : source.observedAt
    }))
  });
}

export function snapshotFilename(snapshot: DecisionSnapshot): string {
  return `${snapshot.incidentId}_${snapshot.community.id}_${snapshot.route?.id ?? 'no-route'}_${snapshot.asOf.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

export { downloadBlob } from '../../shared/downloadBlob';
