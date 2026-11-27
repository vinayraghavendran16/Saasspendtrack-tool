import assert from 'node:assert/strict';
import {processPaymentNotifications} from '../functions/_shared/payment-notifications.js';
const originalNow=Date.now,originalFetch=globalThis.fetch;
let clock=1000000;Date.now=()=>clock+=1000;
globalThis.fetch=async()=>new Response('{}',{status:200});
const updates=[],claims=[];
const rows=[{payment_id:'pay_a'},{payment_id:'pay_b'}];
const db={prepare(sql){return {bind(...args){return {all:async()=>({results:rows}),first:async()=>{if(sql.includes('RETURNING attempts')){claims.push(args);return {attempts:1};}if(sql.includes('FROM payment_ledger WHERE payment_id'))return {payment_id:args[0],customer_email:args[0]+'@example.com',amount:149900,currency:'USD',entitlement_until:2000000};return null;},run:async()=>{if(sql.includes('UPDATE payment_notification_outbox SET status=?'))updates.push(args);return {success:true};}};}};}};
try{
 await processPaymentNotifications({DB:db,ZEPTOMAIL_TOKEN:'fixture-token',FROM_EMAIL:'test@example.com'});
 assert.equal(claims.length,2);
 assert.equal(updates.length,2);
 assert.notEqual(claims[0][0],claims[1][0],'each notification must receive a fresh lease');
 assert.equal(updates[0][3],claims[0][0],'completion must be fenced by its own lease');
 assert.equal(updates[1][3],claims[1][0],'completion must be fenced by its own lease');

 assert.equal(updates[0][4],1);
 assert.equal(updates[1][4],1);
 console.log('PASS: completion includes claim attempt fencing');
 console.log('payment notification independent lease assertions passed');
}finally{Date.now=originalNow;globalThis.fetch=originalFetch;}
