import type { IncidentPacket } from '../../data/incidentPacket';
import type { IncidentWorkspaceSnapshot } from './deriveIncidentWorkspace';

export type WorkStatus = 'pending' | 'active' | 'blocked' | 'done';
export type ResponseWork = {
  id: string;
  signature: string;
  title: [string, string];
  action: [string, string];
  subject: [string, string];
  completion: [string, string];
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
      action: ['Kiểm tra báo cáo', 'Review report'],
      subject: packet.roads.find(road => road.id === packet.report.roadId)?.name ?? packet.report.evidence.source,
      completion: ['Đối chiếu báo cáo trước khi cập nhật bản đồ.', 'Review the report before updating the map.'],
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
        action: ['Xác minh liên lạc', 'Check contact'],
        subject: [community.name, community.name],
        completion: ['Tình trạng liên lạc, nhu cầu hỗ trợ và thời điểm xác nhận.', 'Contact status, support needs and confirmation time.'],
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
          `${assessment.access === 'unmapped' ? 'Rà soát dữ liệu đường vào' : 'Xác minh phương án tiếp cận'} ${community.name}`,
          `${assessment.access === 'unmapped' ? 'Map access to' : 'Review access to'} ${community.name}`
        ],
        action: assessment.access === 'unmapped' ? ['Rà soát dữ liệu đường', 'Review road data'] : ['Xác minh phương án tiếp cận', 'Verify access options'],
        subject: [community.name, community.name],
        completion: assessment.access === 'unmapped'
          ? ['Nguồn và đường tiếp cận đã kiểm tra, hoặc dữ liệu còn thiếu.', 'Sources and access roads checked, or remaining data gaps.']
          : ['Phương án thay thế, đoạn chưa rõ và nguồn xác minh.', 'Alternative access, unresolved sections and verification source.'],
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
      title: [`Xác minh ${road.name[0].replace(/^./, c => c.toLocaleLowerCase())}`, `Verify ${road.name[1]}`],
      action: ['Xác minh khả năng đi qua', 'Verify passage'],
      subject: road.name,
      completion: ['Khả năng đi qua, loại phương tiện và thời điểm kiểm tra.', 'Passability, vehicle type and inspection time.'],
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
