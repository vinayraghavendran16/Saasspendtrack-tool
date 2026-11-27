import assert from 'node:assert/strict';
import {validatePaidLink} from '../functions/_shared/payment-policy.js';
const catalogue=[{linkId:'plink_fixture',amount:149900,currency:'USD',tier:'founding'}];
const valid={event:'payment_link.paid',payload:{payment_link:{entity:{id:'plink_fixture',status:'paid',currency:'USD',amount:149900,amount_paid:149900}},payment:{entity:{id:'pay_fixture',status:'captured',currency:'USD',amount:149900}}}};
assert.equal(validatePaidLink(valid,catalogue)?.tier,'founding');
const mutations=[
 e=>e.event='payment.captured',
 e=>e.payload.payment_link.entity.id='plink_other',
 e=>e.payload.payment_link.entity.amount_paid=100,
 e=>e.payload.payment_link.entity.status='partially_paid',
 e=>e.payload.payment.entity.status='authorized',
 e=>e.payload.payment.entity.currency='INR',
 e=>e.payload.payment.entity.amount=100,
 e=>delete e.payload.payment.entity.id,
 e=>delete e.payload.payment,
];
for(const mutate of mutations){const event=structuredClone(valid);mutate(event);assert.equal(validatePaidLink(event,catalogue),null);}
assert.equal(validatePaidLink(valid,[]),null);
assert.equal(validatePaidLink(valid,[...catalogue,...catalogue]),null);
console.log('12 payment policy assertions passed');
