import type { IncidentPacket } from '../../data/incidentPacket';
import type { IncidentWorkspaceSnapshot } from './deriveIncidentWorkspace';

export type WorkStatus = 'pending' | 'active' | 'blocked' | 'done';
export type ResponseWork = {
  id: string;
  signature: string;
  title: [string, string];
  reason: [string, string];
  objectId: string;
  priority: number;
  kind: 'report' | 'contact' | 'access';
};
export type WorkEntry = {
  id: string;
  taskId: string;
  signature: string;
  title: [string, string];
  objectId: string;
  status: WorkStatus;
  note: string;
  owner: string;
  at: string;
};
export const workStatusText: Record<WorkStatus, [string, string]> = {
  pending: ['Chưa xử lý', 'Pending'],
  active: ['Đang xử lý', 'In progress'],
  blocked: ['Chờ hỗ trợ', 'Waiting for support'],
  done: ['Hoàn tất', 'Completed']
};

/** Work obligations are derived from evidence. Completion never edits hazard/road truth. */
export function responseWork(
  packet: IncidentPacket,
  snapshot: IncidentWorkspaceSnapshot,
  applied: boolean
): ResponseWork[] {
  const tasks: ResponseWork[] = [];
  if (!applied)
    tasks.push({
      id: `report:${packet.report.id}`,
      signature: packet.report.evidence.id,
      title: ['Kiểm tra báo cáo mới', 'Review new report'],
      reason: packet.report.evidence.finding,
      objectId: `road:${packet.report.roadId}`,
      priority: 0,
      kind: 'report'
    });
  for (const community of snapshot.communities) {
    const assessment = snapshot.assessments.get(community.id)!;
    if (packet.signals[community.id].communication === 'lost')
      tasks.push({
        id: `contact:${community.id}`,
        signature: JSON.stringify(packet.signals[community.id]),
        title: [`Liên lạc với ${community.name}`, `Contact ${community.name}`],
        reason: [
          'Mất liên lạc. Chưa có cập nhật tình hình tại địa bàn.',
          'Contact lost. No current community update.'
        ],
        objectId: `community:${community.id}`,
        priority: community.prio,
        kind: 'contact'
      });
    if (assessment.access === 'unmapped' || assessment.access === 'blocked')
      tasks.push({
        id: `access:${community.id}`,
        signature: JSON.stringify([
          assessment.access,
          assessment.hazardIds,
          snapshot.roads
            .filter((road) => assessment.hazardIds.includes(road.hz ?? ''))
            .map((road) => [road.id, road.status, road.note])
        ]),
        title: [
          `${assessment.access === 'unmapped' ? 'Bổ sung đường vào' : 'Tìm phương án tiếp cận'} ${community.name}`,
          `${assessment.access === 'unmapped' ? 'Map access to' : 'Review access to'} ${community.name}`
        ],
        reason: assessment.reason,
        objectId: `community:${community.id}`,
        priority: community.prio,
        kind: 'access'
      });
  }
  for (const road of snapshot.roads.filter((road) => road.status === 'uncertain')) {
    const record = snapshot.evidence.find((item) => item.hazardId === road.hz);
    tasks.push({
      id: `road:${road.id}`,
      signature: JSON.stringify([
        road.status,
        road.hz,
        record?.id,
        record?.observedAt,
        record?.finding
      ]),
      title: [`Xác minh ${road.name[0]}`, `Verify ${road.name[1]}`],
      reason: record?.finding ??
        road.note ?? ['Chưa xác minh khả năng đi qua.', 'Passability not verified.'],
      objectId: `road:${road.id}`,
      priority: snapshot.communities.some(
        (community) =>
          community.prio === 1 &&
          [
            snapshot.routes.get(community.id)?.candidate,
            snapshot.routes.get(community.id)?.direct
          ].some((route) => route?.segs.some((segment) => segment.id === road.id))
      )
        ? 1
        : 2,
      kind: 'access'
    });
  }
  return tasks.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function workState(task: ResponseWork, entries: WorkEntry[]) {
  const latest = [...entries].reverse().find((entry) => entry.taskId === task.id);
  const current = latest?.signature === task.signature ? latest : undefined;
  return {
    status: current?.status ?? ('pending' as WorkStatus),
    owner: current?.owner ?? '',
    note: current?.note ?? '',
    changed: Boolean(latest && !current)
  };
}
export function workEntry(
  task: ResponseWork,
  status: WorkStatus,
  note: string,
  owner: string,
  at: string
): WorkEntry {
  if (
    !['pending', 'active', 'blocked', 'done'].includes(status) ||
    !Number.isFinite(Date.parse(at))
  )
    throw new Error('Invalid work status/date');
  if ((status === 'blocked' || status === 'done') && !note.trim())
    throw new Error('A result or reason is required');
  if (status !== 'pending' && !owner.trim()) throw new Error('An owner is required');
  return {
    id: crypto.randomUUID(),
    taskId: task.id,
    signature: task.signature,
    title: task.title,
    objectId: task.objectId,
    status,
    note: note.trim().slice(0, 1000),
    owner: owner.trim().slice(0, 100),
    at
  };
}
export function restoreWork(raw: unknown): WorkEntry[] {
  if (!Array.isArray(raw) || raw.length > 500) throw new Error('Invalid work history');
  const ids = new Set<string>();
  return raw.map((value: WorkEntry) => {
    if (
      !value ||
      ['id', 'taskId', 'signature', 'objectId', 'note', 'owner', 'at'].some(
        (key) => typeof value[key as keyof WorkEntry] !== 'string'
      ) ||
      !Array.isArray(value.title) ||
      value.title.length !== 2 ||
      value.title.some((text) => typeof text !== 'string') ||
      !['pending', 'active', 'blocked', 'done'].includes(value.status) ||
      !Number.isFinite(Date.parse(value.at)) ||
      ids.has(value.id) ||
      value.note.length > 1000 ||
      value.owner.length > 100 ||
      (value.status !== 'pending' && !value.owner.trim()) ||
      ((value.status === 'done' || value.status === 'blocked') && !value.note.trim())
    )
      throw new Error('Invalid work history');
    ids.add(value.id);
    return value;
  });
}
