import {describe,it,expect} from 'vitest';
import {submissionMatchesDevice} from './deviceContacts';
describe('resident device report linkage',()=>{
  it('links a report to the phone despite the local sign-in receiving a random account ID',()=>{
    expect(submissionMatchesDevice({authorId:'demo:resident:random',deviceId:'GPS-AP01'},'GPS-AP01')).toBe(true);
    expect(submissionMatchesDevice({authorId:'demo:resident:another',deviceId:'GPS-OTHER'},'GPS-AP01')).toBe(false);
    expect(submissionMatchesDevice(null,'GPS-AP01')).toBe(false);
  });
  it('retains the explicit legacy account association',()=>{
    expect(submissionMatchesDevice({authorId:'demo:resident:a phủ'},'GPS-AP01')).toBe(true);
  });
});
