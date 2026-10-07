import { validateIncidentPacket, type IncidentPacket } from './incidentPacket';
import type { ScenarioAsset } from './scenarioManifest';
import { readResponse as request } from '../shared/http/readResponse';
import { workspaceConfiguration } from './workspaceConfiguration';
export { workspaceConfiguration } from './workspaceConfiguration';

export interface ScenarioRepository { load(signal?: AbortSignal): Promise<IncidentPacket> }

export async function workspaceDataSource(): Promise<'prepared' | 'api'> {
  return (await workspaceConfiguration()).dataSource;
}

export function preparedRepository(asset: ScenarioAsset): ScenarioRepository {
  return { async load(signal) {
    const bytes = await (await request(asset.url, signal)).arrayBuffer();
    if (bytes.byteLength !== asset.byteLength) throw new Error('Incident packet size mismatch');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== asset.sha256) throw new Error('Incident packet checksum mismatch');
    return validateIncidentPacket(JSON.parse(new TextDecoder().decode(bytes)));
  } };
}

/** API mode is explicit. Errors never silently substitute simulated data. */
export function apiRepository(baseUrl: string, incidentId: string): ScenarioRepository {
  return { async load(signal) {
    return validateIncidentPacket(await (await request(`${baseUrl.replace(/\/$/, '')}/api/v1/incidents/${encodeURIComponent(incidentId)}/workspace`, signal)).json());
  } };
}
