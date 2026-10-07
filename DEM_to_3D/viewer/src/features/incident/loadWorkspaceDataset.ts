import { apiRepository, preparedRepository, workspaceConfiguration } from '../../data/ScenarioRepository';
import type { IncidentPacket } from '../../data/incidentPacket';
import { loadScenarioManifest, type ScenarioManifest } from '../../data/scenarioManifest';
import { loadTerrainData } from '../../terrain/loadTerrain';

export function validateWorkspaceManifest(manifest: ScenarioManifest, packet: IncidentPacket): void {
  if (manifest.incidentId !== packet.incident.id || manifest.snapshotAt !== packet.incident.asOf ||
      manifest.crs !== packet.crs || manifest.datasetVersion !== packet.datasetVersion ||
      manifest.dataKind !== packet.dataKind || manifest.reviewStatus !== packet.reviewStatus ||
      manifest.counts.communities !== packet.communities.length || manifest.counts.roads !== packet.roads.length ||
      manifest.counts.hazards !== packet.hazards.length) {
    throw new Error('Scenario data does not match its manifest');
  }
}

/** Commit a complete, validated packet/terrain pair to the UI in one operation. */
export async function loadWorkspaceDataset(signal: AbortSignal, apiBase = '') {
  const configuration = await workspaceConfiguration(signal);
  const manifest = await loadScenarioManifest(configuration.manifestUrl, signal);
  if (!manifest.workspace) throw new Error('Incident packet is missing from the manifest');
  const repository = apiBase || configuration.dataSource === 'api'
    ? apiRepository(apiBase, manifest.incidentId)
    : preparedRepository(manifest.workspace);
  const packet = await repository.load(signal);
  validateWorkspaceManifest(manifest, packet);
  const terrain = await loadTerrainData({ metadata: manifest.terrain.metadata.url, grid: manifest.terrain.grid.url }, signal);
  if (`${terrain.metadata.crs.authority}:${terrain.metadata.crs.code}` !== manifest.crs) {
    throw new Error('Terrain CRS does not match its manifest');
  }
  signal.throwIfAborted();
  return { manifest, packet, terrain, offline: configuration.offline };
}
