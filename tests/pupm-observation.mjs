import assert from 'node:assert/strict';
import {validateObservation} from '../functions/_shared/pupm-observation.js';
const row={accountId:'a',scope:'sales',sourceId:'hr',sourceRecordId:'1',month:'2027-01',recordedAt:1,denominator:'employees',count:20};
assert.equal(validateObservation(row,'a').count,20);
assert.throws(()=>validateObservation(row,'b'));
for(const patch of [{sourceId:''},{sourceRecordId:''},{month:'2027-13'},{count:-1},{count:1.5},{recordedAt:0},{denominator:'active_users'}])assert.throws(()=>validateObservation({...row,...patch},'a'));
assert.equal(validateObservation({...row,denominator:'active_users',activeWindowDays:30},'a').activeWindowDays,30);
console.log('PUPM observation fixtures passed');
