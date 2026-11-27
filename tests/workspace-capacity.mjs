import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../functions/api/data.js',import.meta.url),'utf8');
const match=source.match(/const MAX_BYTES = ([\d_]+);/);
assert.ok(match,'snapshot cap must be discoverable');
const cap=Number(match[1].replaceAll('_',''));
const subscriptions=Array.from({length:250},(_,i)=>({
 id:'s'+i,name:'Synthetic vendor '+i,currency:'USD',cost:12000,cycle:'yearly',active:true,
 licenses:100,assigned:85,utilized:75,notes:'Contract terms and renewal considerations. '.repeat(40),
 renewalDate:'2027-12-31',noticeDays:90
}));
const invoices=subscriptions.flatMap(s=>Array.from({length:12},(_,i)=>({
 id:s.id+'-i'+i,subId:s.id,currency:'USD',amount:1000,date:'2026-'+String(i+1).padStart(2,'0')+'-01',status:'paid'
})));
const employees=Array.from({length:500},(_,i)=>({id:'e'+i,name:'Synthetic employee '+i,email:'employee'+i+'@example.invalid',department:'Operations'}));
const snapshot={subscriptions,invoices,employees,settings:{currency:'USD'}};
const bytes=Buffer.byteLength(JSON.stringify(snapshot),'utf8');
assert.equal(subscriptions.length,250);
assert.ok(bytes<cap*0.8,'synthetic baseline exceeds 80% of snapshot cap');
console.log(JSON.stringify({contracts:250,invoices:invoices.length,employees:employees.length,bytes,cap,headroom:cap-bytes}));
console.log('PASS: synthetic snapshot serialization budget; not a live D1 or browser performance test');
