import type { IncidentPacket } from '../../data/incidentPacket';
import { localClock } from './sourceTime';
import { workStatusText, type WorkEntry } from './responseWork';
type Record = {
  id: string;
  at: string;
  kind: 'analysis' | 'report' | 'work' | 'revision';
  title: [string, string];
  description: [string, string];
  objectId?: string;
  entry?: WorkEntry;
  record?: IncidentPacket['evidence'][number];
  pending?: boolean;
};
export function journalRecords(
  packet: IncidentPacket,
  entries: WorkEntry[],
  appliedAt: string | null
): Record[] {
  const { incident } = packet;
  const offset = incident.triggeredAt.match(/(Z|[+-]\d{2}:\d{2})$/)?.[0] ?? 'Z';
  const analysis: Record[] = incident.timeline.map(
    ([time, vi, en, description, english], index) => ({
      id: `analysis:${index}`,
      at: `${incident.triggeredAt.slice(0, 10)}T${time}:00${offset}`,
      kind: 'analysis',
      title: [vi, en],
      description: [description, english]
    })
  );
  const reports: Record[] = [...packet.evidence, packet.report.evidence].map((record) => ({
    id: record.id,
    at: record.receivedAt,
    kind: 'report',
    title: record.source,
    description: record.finding,
    record,
    pending: record.id === packet.report.evidence.id,
    objectId: packet.roads.some((road) => road.hz === record.hazardId)
      ? `road:${packet.roads.find((road) => road.hz === record.hazardId)!.id}`
      : undefined
  }));
  const work: Record[] = entries.map((entry) => ({
    id: entry.id,
    at: entry.at,
    kind: 'work',
    title: entry.title,
    description: [workStatusText[entry.status][0], workStatusText[entry.status][1]],
    objectId: entry.objectId,
    entry
  }));
  const revision: Record[] = appliedAt
    ? [
        {
          id: 'revision:report',
          at: appliedAt,
          kind: 'revision',
          title: ['Cập nhật bản đồ từ báo cáo', 'Map updated from report'],
          description: [
            `Bản dữ liệu ${localClock(incident.asOfUpdated)}. Báo cáo ${packet.report.id}.`,
            `Data revision ${localClock(incident.asOfUpdated)}. Report ${packet.report.id}.`
          ]
        }
      ]
    : [];
  return [...analysis, ...reports, ...work, ...revision].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id)
  );
}
