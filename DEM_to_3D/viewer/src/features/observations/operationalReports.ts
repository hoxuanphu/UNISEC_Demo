import type { GeometryRecord } from '../../geo/vector/types';
import { submissionOf } from '../access/submissions';
import { observationOf } from './model';

/** One current request per device and type. Older submissions remain in the journal. */
export function latestOperationalReports(records: readonly GeometryRecord[]): GeometryRecord[] {
  const latest = new Map<string, GeometryRecord>();
  for (const record of records) {
    const submission = submissionOf(record), observation = observationOf(record);
    if (!submission || !observation) continue;
    const kind = observation.kind === 'help' ? 'help' : record.feature.properties.dearRouteProposal ? 'proposal' : null;
    if (!kind) continue;
    const point = record.feature.geometry.type === 'Point' ? record.feature.geometry.coordinates : [];
    const place = submission.locationSource === 'device' && submission.deviceId ? submission.deviceId : `${submission.authorId}:${point.join(',')}`;
    const key = `${kind}:${place}`, previous = latest.get(key);
    if (!previous || Date.parse(submission.submittedAt) >= Date.parse(submissionOf(previous)!.submittedAt)) latest.set(key, record);
  }
  return [...latest.values()].filter(record=>submissionOf(record)?.review.status==='pending').sort((a,b) => Date.parse(submissionOf(b)!.submittedAt) - Date.parse(submissionOf(a)!.submittedAt));
}
