import type { ResponseWork } from '../incident/responseWork';
import type { HouseholdAccess } from './householdIsolation';

/** Every isolated hut cluster is a relief task: reach the people, learn their needs,
 * and plan a way in or a supply drop. A stated need puts it first. */
export function householdWork(households: HouseholdAccess[]): ResponseWork[] {
  return households.filter(item => item.isolated).map(({ cluster, cutBy }) => ({
    id: `household:${cluster.id}`,
    signature: JSON.stringify([cluster.people, cluster.households, cluster.lastSeenAt, cluster.need ?? null, cutBy.map(item => item.kind === 'area' ? item.id : item.kind)]),
    title: [`Hỗ trợ ${cluster.name[0].replace(/^./, c => c.toLocaleLowerCase())}`, `Assist ${cluster.name[1].replace(/^./, c => c.toLocaleLowerCase())}`],
    action: ['Liên lạc và lên phương án tiếp cận', 'Contact and plan access'],
    subject: cluster.name,
    completion: ['Số người còn lại, nhu cầu, cách tiếp cận hoặc tiếp tế và thời điểm xác nhận.', 'People remaining, needs, access or supply plan and confirmation time.'],
    reason: [
      `${cluster.people} người, ${cluster.households} hộ còn ở lán theo app DEAR. Mọi đường ra đều bị cắt.${cluster.need ? ` ${cluster.need[0]}.` : ''}`,
      `${cluster.people} people in ${cluster.households} households at the huts per the DEAR app. Every road out is cut.${cluster.need ? ` ${cluster.need[1]}.` : ''}`
    ],
    objectId: `household:${cluster.id}`,
    priority: cluster.need ? 0 : 1,
    kind: 'contact' as const
  }));
}
