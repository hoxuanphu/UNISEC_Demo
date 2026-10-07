import type { IncidentPacket } from '../../data/incidentPacket';
import { assessCommunity } from './responseAssessment';
import { buildNetworkRoutes } from '../routes/networkRouting';
import type { Community } from '../../types/dear';
import { estimateTravel } from '../routes/travelEstimate';
import { withinArea } from '../../terrain/areaGeometry';

/** Deterministic prepared-snapshot calculation, independent of React and map engines.
 * The optional report belongs to the demo packet, not a publication workflow.
 */
export function deriveIncidentWorkspace(packet: IncidentPacket, updated: boolean) {
  const roads = packet.roads.map(road => updated && road.id === packet.report.roadId ? {
    ...road, status: 'blocked' as const, note: packet.report.evidence.finding
  } : road);
  const hazards = packet.hazards.map(hazard => updated && hazard.id === packet.report.hazard.id ? packet.report.hazard : hazard);
  const evidence = packet.evidence.map(item => updated && item.hazardId === packet.report.evidence.hazardId ? packet.report.evidence : item);
  const staging = packet.responseSites.find(site => site.kind === 'staging');
  if (!staging) throw new Error('Incident workspace requires a staging site');
  const baseline: Community[] = packet.communities.filter(community => withinArea(community.projected, packet.aoi.points)).map(community => ({ ...community, prio: 2 }));
  const routes = buildNetworkRoutes(roads, baseline, staging.projected);
  for (const pair of routes.values()) for (const route of [pair.candidate, pair.direct]) {
    if (route) route.eta = estimateTravel(route, packet.routingAssumptions);
  }
  const assessments = new Map(baseline.map(community => [community.id,
    assessCommunity(routes.get(community.id), hazards, packet.signals[community.id])
  ]));
  const communities = baseline.map(community => ({ ...community, prio: assessments.get(community.id)!.priority }));
  return { roads, hazards, evidence, routes, assessments, communities, incident: packet.incident, responseSites: packet.responseSites };
}
