import assert from 'node:assert/strict';
import {allocateDepartmentCost as allocate} from '../functions/_shared/department-allocation.js';
const w=[{departmentId:'a',basisPoints:3333},{departmentId:'b',basisPoints:3333}];
assert.deepEqual(allocate('100',w).map(x=>x.amountMinor),['33','33','34']);
assert.deepEqual(allocate('-100',w).map(x=>x.amountMinor),['-33','-33','-34']);
assert.deepEqual(allocate('0',w).map(x=>x.amountMinor),['0','0','0']);
assert.deepEqual(allocate('99',[]),[{departmentId:null,basisPoints:10000,amountMinor:'99'}]);
const tie=[{departmentId:'b',basisPoints:5000},{departmentId:'a',basisPoints:5000}];
assert.deepEqual(allocate('1',tie).map(x=>x.amountMinor),['0','1']);
for(const amount of ['1','2','9999999999999999999','-9999999999999999999']){
 assert.equal(allocate(amount,w).reduce((s,r)=>s+BigInt(r.amountMinor),0n),BigInt(amount));
}
for(const weights of [[...w,w[0]],[{departmentId:'a',basisPoints:10001}],[{departmentId:'a',basisPoints:6000},{departmentId:'b',basisPoints:6000}],[{departmentId:'a',basisPoints:0.5}],[{departmentId:null,basisPoints:1}]])assert.throws(()=>allocate('1',weights));
assert.throws(()=>allocate(100,w));
console.log('department allocation conservation passed');
