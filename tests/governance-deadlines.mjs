import assert from 'node:assert/strict';
import {calendarDay,deadlineMilestone,noticeDeadline} from '../functions/_shared/governance-deadlines.js';
assert.equal(noticeDeadline('2027-06-30',60),'2027-05-01');
assert.equal(calendarDay('2027-02-29'),null);
assert.notEqual(calendarDay('2028-02-29'),null);
assert.deepEqual(deadlineMilestone({today:'2027-04-17',deadline:'2027-05-01',kind:'notice'}),{milestone:14,remaining:14});
assert.deepEqual(deadlineMilestone({today:'2027-05-02',deadline:'2027-05-01',kind:'notice'}),{milestone:-1,remaining:-1});
assert.equal(deadlineMilestone({today:'2027-01-01',deadline:'2027-06-30',kind:'renewal'}),null);
console.log('6 deadline assertions passed');
