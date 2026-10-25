import { describe, expect, it } from 'vitest';
import { latestOperationalReports } from './operationalReports';
import { annotateRecord } from './model';
import type { GeometryRecord } from '../../geo/vector/types';
const report=(id:string,deviceId:string,at:string,source='device'):GeometryRecord=>annotateRecord({id,name:id,visible:true,role:'reference',source:{name:'Report',format:'coordinate',importedAt:at},feature:{type:'Feature',geometry:{type:'Point',coordinates:[104,21]},properties:{dearSubmission:{schema:'field-submission/v1',authorId:deviceId,authorName:'Resident',role:'resident',homeCommunityId:null,deviceId,submittedAt:at,locationSource:source,review:{status:'pending',note:'',reviewer:'',reviewedAt:''}}}}},{schema:'field-observation/v1',kind:'help',note:'',observer:'Resident',observedAt:at,photos:[],accuracyM:null,status:'unreviewed',updatedAt:at});
describe('operational request queue',()=>{
 it('shows the latest request per device without removing journal entries',()=>{
  const records=[report('old','GPS-01','2026-10-26T00:00:00Z'),report('other','GPS-02','2026-10-26T00:01:00Z'),report('new','GPS-01','2026-10-26T00:02:00Z')];
  expect(latestOperationalReports(records).map(r=>r.id)).toEqual(['new','other']);expect(records).toHaveLength(3);
 });
 it('does not revive an older pending request after the latest is resolved',()=>{
  const old=report('old','GPS-01','2026-10-26T00:00:00Z'),latest=report('latest','GPS-01','2026-10-26T00:02:00Z');
  (latest.feature.properties.dearSubmission as {review:{status:string}}).review.status='checked';
  expect(latestOperationalReports([old,latest])).toEqual([]);
 });
 it('keeps distinct manually reported locations and excludes resolved requests',()=>{
  const a=report('a','GPS-01','2026-10-26T00:00:00Z','map'),b=report('b','GPS-01','2026-10-26T00:01:00Z','map');
  b.feature.geometry={type:'Point',coordinates:[104.01,21]};
  expect(latestOperationalReports([a,b])).toHaveLength(2);
  (a.feature.properties.dearSubmission as {review:{status:string}}).review.status='checked';expect(latestOperationalReports([a,b]).map(r=>r.id)).toEqual(['b']);
 });
});
