import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const project='saasspendtrack-checkout-sandbox';
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
for(const args of [
 ['saasspendtrack',uuid,sha],
 [project,'33e16d8e-579e-4454-959b-dbbbb368081a',sha],
 [project,'1f35200e-11ae-498d-a7a7-a0909259084c',sha],
 [project,'ccdbb7a7-9cb5-45d7-8bac-8b8024626fc8',sha],
 [project,'invalid',sha],
 [project,uuid,'0'.repeat(40)]
]){
 const r=spawnSync(process.execPath,['scripts/checkout-sandbox-preflight.mjs',...args],{encoding:'utf8'});
 assert.equal(r.status,1);
 assert.match(r.stderr,/AssertionError/);
}
console.log('PASS: unsafe preflight inputs rejected');
