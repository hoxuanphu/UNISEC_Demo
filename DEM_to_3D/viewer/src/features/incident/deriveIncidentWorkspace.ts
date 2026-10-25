import { withSurveyRoadConditions, type SurveyConditionArea } from '../routes/surveyRoadConditions';
import { applyScenarioEdits, type ScenarioEdit } from '../access/scenarioEdits';
import type { IncidentPacket } from '../../data/incidentPacket';
import { assessCommunity } from './responseAssessment';
import { buildNetworkRoutes } from '../routes/networkRouting';
import type { Community } from '../../types/dear';
import { estimateTravel } from '../routes/travelEstimate';
import { withinArea } from '../../terrain/areaGeometry';

/** Deterministic prepared-snapshot calculation, independent of React and map engines.
 * The optional report belongs to the demo packet, not a publication workflow.
 */
export function deriveIncidentWorkspace(source: IncidentPacket, updated: boolean, edits: ScenarioEdit[] = [], reportAt: string | null = null, surveyAreas: SurveyConditionArea[] = []) {
  const applied = effectiveEdits(source, updated, edits, reportAt);
  // Latest manual status per road: a road set back to "uncertain" needs a new check.
  const statusEditIds = new Map(applied.filter(edit => edit.change.kind === 'status').map(edit => [edit.target.id, edit.id]));
  const packet = applyScenarioEdits({ ...source,
    roads: source.roads.map(road => updated && road.id === source.report.roadId ? { ...road, status: 'blocked', note: source.report.evidence.finding } : road),
    hazards: source.hazards.map(h => updated && h.id === source.report.hazard.id ? source.report.hazard : h),
    evidence: source.evidence.map(e => updated && e.hazardId === source.report.evidence.hazardId ? source.report.evidence : e)
  }, applied);
  const { hazards, evidence } = packet;
  // Mapped extents touching an open road make it a section to verify, as on the commune roads.
  const surveyed = withSurveyRoadConditions(packet.roads, surveyAreas, new Set(statusEditIds.keys()));
  const roads = surveyed.roads;
  const staging = packet.responseSites.find(site => site.kind === 'staging');
  if (!staging) throw new Error('Incident workspace requires a staging site');
  const baseline: Community[] = packet.communities.filter(community => withinArea(community.projected, packet.aoi.points)).map(community => ({ ...community, prio: 2 }));
  const routes = buildNetworkRoutes(roads, baseline, staging.projected, packet.routingAssumptions);
  for (const pair of routes.values()) for (const route of [pair.candidate, pair.direct]) {
    if (route) route.eta = estimateTravel(route, packet.routingAssumptions);
  }
  const assessments = new Map(baseline.map(community => [community.id,
    assessCommunity(routes.get(community.id), hazards, packet.signals[community.id])
  ]));
  const communities = baseline.map(community => ({ ...community, prio: assessments.get(community.id)!.priority }));
  const manualUpdatedAt = edits.map(e=>e.at).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
  return { roads, hazards, evidence, routes, assessments, communities, incident: packet.incident, responseSites: packet.responseSites, manualUpdatedAt, statusEditIds, surveyLinks: surveyed.links };
}

export type IncidentWorkspaceSnapshot = ReturnType<typeof deriveIncidentWorkspace>;

/** Later evidence wins: a manual status set before the field report was applied does not
 * override the report's status for that road. Status edits made after it still apply. */
export function effectiveEdits(source: IncidentPacket, updated: boolean, edits: ScenarioEdit[], reportAt: string | null): ScenarioEdit[] {
  if (!updated || !reportAt) return edits;
  const applied = Date.parse(reportAt);
  return edits.filter(edit => !(edit.change.kind === 'status' && edit.target.type === 'road' &&
    edit.target.id === source.report.roadId && Date.parse(edit.at) < applied));
}
