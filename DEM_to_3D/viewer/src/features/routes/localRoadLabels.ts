import type { Locale, RoadSegment, ScenarioRoute } from '../../types/dear';
import { roadCondition, routeCondition, type RoadCondition } from './roadConditions';

/** This label belongs to the local network's difficult/passable class.
 * Unverified incident roads retain their separate "needs checking" wording. */
export const difficultRoadLabel = (locale: Locale) => locale === 'vi' ? 'Khó đi, vẫn qua được' : 'Difficult but possible';

export function roadConditionLabel(condition: RoadCondition, locale: Locale, local = false): string {
  const vi = locale === 'vi';
  return condition === 'blocked' ? vi ? 'Bị chặn' : 'Blocked'
    : condition === 'risk' ? vi ? 'Có nguy cơ sạt lở' : 'Landslide risk'
    : condition === 'uncertain' ? local ? difficultRoadLabel(locale) : vi ? 'Cần hỏi lại' : 'Check first'
    : vi ? 'Chưa ghi nhận chặn' : 'No blockage reported';
}

/** Summary, directions and inspected objects use the same condition and wording. */
export function roadConditionMessage(value: RoadSegment | ScenarioRoute, locale: Locale, local = false): string {
  const vi = locale === 'vi', route = 'segs' in value;
  const condition = route ? routeCondition(value) : roadCondition(value);
  const landslide = route ? value.segs.some(road => road.status === 'blocked' && road.hz === 'landslide') : value.hz === 'landslide';
  return condition === 'blocked' ? landslide
    ? vi ? 'Bị chặn do sạt lở. Không đi qua.' : 'Blocked by a landslide. Do not cross.'
    : vi ? 'Đường bị chặn. Không đi qua.' : 'Road blocked. Do not cross.'
    : condition === 'risk' ? vi ? 'Có nguy cơ sạt lở, cần hỏi lại trước khi đi.' : 'Landslide risk, check before travel.'
    : condition === 'uncertain' ? local ? difficultRoadLabel(locale) : vi ? 'Có đoạn cần hỏi lại trước khi đi.' : 'Check the marked sections before travel.'
    : vi ? 'Chưa ghi nhận đoạn bị chặn.' : 'No blocked sections reported.';
}
