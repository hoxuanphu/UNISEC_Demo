import { useEffect, useState } from 'react';
import { verifiedAssetBytes } from '../../data/ScenarioRepository';
import type { ScenarioAsset } from '../../data/scenarioManifest';

/** People the resident app last located at one group of field huts. Simulated for the Chế Tạo demo. */
export type PresenceCluster = {
  id: string;
  name: [vi: string, en: string];
  longitude: number;
  latitude: number;
  households: number;
  people: number;
  /** Phones with the resident app that reported from the huts. */
  devices: number;
  lastSeenAt: string;
  need?: [vi: string, en: string];
  /** Slides the residents reported on their way out, with the app's location. */
  reportedCuts?: Array<{ longitude: number; latitude: number; reportedAt: string }>;
  /** Who answered when the commune called the huts, and on which phone. */
  contact?: { name: string; phone: string };
  /** A team has already brought these people out: when, and where to. */
  rescued?: { at: string; to: [vi: string, en: string] };
};
export type ResidentPresence = {
  schemaVersion: 1;
  dataKind: 'simulated';
  source: [vi: string, en: string];
  clusters: PresenceCluster[];
};

const text = (value: unknown, max = 200) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const pair = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every(item => text(item));
const count = (value: unknown, max: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

export function validateResidentPresence(value: unknown): ResidentPresence {
  const d = value as ResidentPresence;
  if (!d || d.schemaVersion !== 1 || d.dataKind !== 'simulated' || !pair(d.source) || !Array.isArray(d.clusters) || d.clusters.length > 200 ||
    new Set(d.clusters.map(cluster => cluster.id)).size !== d.clusters.length ||
    !d.clusters.every(c => text(c.id, 64) && pair(c.name) && (c.need === undefined || pair(c.need)) &&
      Number.isFinite(c.longitude) && c.longitude > 104 && c.longitude < 104.12 && Number.isFinite(c.latitude) && c.latitude > 21.65 && c.latitude < 21.79 &&
      count(c.households, 500) && count(c.people, 5000) && count(c.devices, 5000) && c.households <= c.people && Number.isFinite(Date.parse(c.lastSeenAt)) &&
      (c.rescued === undefined || Number.isFinite(Date.parse(c.rescued.at)) && pair(c.rescued.to)) &&
      (c.contact === undefined || text(c.contact.name, 80) && typeof c.contact.phone === 'string' && /^[0-9 +]{6,20}$/.test(c.contact.phone)) &&
      (c.reportedCuts === undefined || Array.isArray(c.reportedCuts) && c.reportedCuts.length <= 20 && c.reportedCuts.every(r =>
        Number.isFinite(r.longitude) && r.longitude > 104 && r.longitude < 104.12 && Number.isFinite(r.latitude) && r.latitude > 21.65 && r.latitude < 21.79 && Number.isFinite(Date.parse(r.reportedAt))))))
    throw new Error('Invalid resident presence');
  return d;
}

/** Optional: without it the workspace simply shows no household alerts. */
export function useResidentPresence(asset?: ScenarioAsset): ResidentPresence | null {
  const [presence, setPresence] = useState<ResidentPresence | null>(null);
  useEffect(() => {
    setPresence(null);
    if (!asset) return;
    const controller = new AbortController();
    void verifiedAssetBytes(asset,controller.signal)
      .then(bytes => JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))).then(value => { if(!controller.signal.aborted)setPresence(validateResidentPresence(value)); })
      .catch(() => { if (!controller.signal.aborted) setPresence(null); });
    return () => controller.abort();
  }, [asset?.url,asset?.sha256,asset?.byteLength]);
  return presence;
}
