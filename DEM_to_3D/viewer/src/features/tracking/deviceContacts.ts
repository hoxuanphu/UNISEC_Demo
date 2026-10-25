import type {Submission} from '../access/submissions';
import { residentDeviceId } from './residentLocation';

/** How to reach the person behind a tracked phone: the number the resident app registered,
 * and the app account their reports come from. Simulated for the Chế Tạo demo. */
export type DeviceContact = { phone: string; accountId?: string };

const contacts: Record<string, DeviceContact> = {
  [residentDeviceId]: { phone: '0900 000 101', accountId: 'demo:resident:a phủ' },
};

export function deviceContact(id: string): DeviceContact | null {
  const known = contacts[id];
  if (known) return known;
  // Scripted residents ND-05, ND-06, …: a number in the same demo range.
  const resident = /^ND-(\d{2})$/.exec(id);
  return resident ? { phone: `0900 000 1${resident[1]}` } : null;
}

/** Device linkage is independent of the randomly allocated local sign-in identity. */
export function submissionMatchesDevice(submission:Pick<Submission,'authorId'|'deviceId'>|null,id:string):boolean {
  return !!submission&&(submission.deviceId===id||!!deviceContact(id)?.accountId&&submission.authorId===deviceContact(id)!.accountId);
}
