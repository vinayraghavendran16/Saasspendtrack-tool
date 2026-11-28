import assert from 'node:assert/strict';
import {createProviderLink} from '../functions/_shared/razorpay-checkout.js';
import {inspectProviderLink} from '../functions/_shared/razorpay-recovery.js';
import {discoverLostLink} from '../functions/_shared/razorpay-lost-link.js';
import {requestPaymentLinks} from '../functions/_shared/razorpay-provider.js';
import {checkoutFailure} from '../functions/_shared/checkout-diagnostics.js';
const env={CHECKOUT_PROVIDER_ENABLED:'true',CHECKOUT_ISOLATED_SANDBOX:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'fixture'};
const c={id:'a'.repeat(32),tier:'founding',amount:149900,currency:'USD',status:'reserved',owner_email:'owner@example.invalid',expires_at:Date.now()+1800000,link_id:'plink_fixture'};
const link={id:c.link_id,reference_id:c.id,amount:c.amount,currency:c.currency,status:'created',short_url:'https://rzp.io/i/fixture',customer:{email:c.owner_email},amount_paid:0,payments:[]};
const mock=(patch={})=>async()=>Response.json({...link,...patch});
assert.equal((await createProviderLink(env,c,mock())).linkId,c.link_id);
for(const patch of [{amount:1},{currency:'INR'},{reference_id:'wrong'},{short_url:'https://evil.invalid'},{status:'paid'}]) await assert.rejects(()=>createProviderLink(env,c,mock(patch)));
assert.equal((await inspectProviderLink(env,c,mock({status:'expired'}))).terminalUnpaid,true);
assert.equal((await inspectProviderLink(env,c,mock({status:'expired',payments:null}))).terminalUnpaid,true);
assert.equal((await inspectProviderLink(env,c,mock({status:'cancelled',payments:null}))).terminalUnpaid,true);
assert.equal((await inspectProviderLink(env,c,mock({status:'expired',payments:[]}))).terminalUnpaid,true);
assert.equal((await inspectProviderLink(env,c,mock({status:'expired',payments:[{payment_id:'pay_fixture'}]}))).terminalUnpaid,false);
assert.equal((await inspectProviderLink(env,c,mock({status:'expired',amount_paid:1,payments:null}))).terminalUnpaid,false);
assert.equal((await inspectProviderLink(env,c,mock({status:'cancelled',amount_paid:1}))).terminalUnpaid,false);
await assert.rejects(()=>inspectProviderLink(env,c,mock({customer:{email:'other@example.invalid'}})));
console.log('PASS: synthetic provider response validation');

let outbound=0;
const forbidden=async()=>{outbound++;throw Error('unexpected network call');};
for(const overrides of [{CHECKOUT_ISOLATED_SANDBOX:'false'},{RAZORPAY_KEY_ID:'rzp_live_fixture'},{CHECKOUT_PROVIDER_ENABLED:'false'}]){
 await assert.rejects(()=>createProviderLink({...env,...overrides},c,forbidden));
 await assert.rejects(()=>inspectProviderLink({...env,...overrides},c,forbidden));
}
assert.equal(outbound,0);
console.log('PASS: disabled or live provider configuration cannot initiate network requests');

const lostCheckout={...c,link_id:null};
const found={id:'plink_found',reference_id:lostCheckout.id,amount:lostCheckout.amount,currency:lostCheckout.currency,status:'created',short_url:'https://rzp.io/i/found',customer:{email:lostCheckout.owner_email}};
const listMock=(payload,status=200)=>async()=>Response.json(payload,{status});
assert.equal((await discoverLostLink(env,lostCheckout,listMock({payment_links:[found]}))).linkId,found.id);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({payment_links:[]})),/provider_link_not_found_manual_review/);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({payment_links:[found,{...found,id:'plink_second'}]})),/multiple_provider_links_manual_review/);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({payment_links:[{...found,amount:1}]})),/provider_amount_currency_mismatch/);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({payment_links:[{...found,short_url:'https://evil.invalid'}]})),/provider_url_invalid_manual_review/);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({error:'unavailable'},503)),/provider_lookup_unavailable/);
await assert.rejects(()=>discoverLostLink(env,lostCheckout,listMock({unexpected:[]})),/provider_response_invalid/);
console.log('PASS: lost-link recovery distinguishes missing, duplicate, invalid and unavailable provider results');

for (const [transport, code] of [
  [async () => { throw new TypeError('opaque network error'); }, 'provider_network_failure'],
  [async (_, {signal}) => { await new Promise(resolve => signal.addEventListener('abort', resolve, {once:true})); throw signal.reason; }, 'provider_timeout'],
  [async () => new Response('<html>unexpected</html>'), 'provider_invalid_json'],
  [listMock({error:{description:'The api key provided is invalid'}}, 400), 'invalid_test_credentials'],
  [listMock({}, 401), 'provider_authentication_failed'],
  [listMock({error:{description:'Customer email is required'}}, 400), 'provider_validation_failed'],
  [listMock({error:{description:'Currency not supported'}}, 400), 'provider_unsupported_currency'],
  [listMock({payment_links:[{...found,reference_id:'wrong'}]}), 'provider_reference_mismatch'],
  [listMock({payment_links:[{...found,customer:[] }]}), 'provider_customer_mismatch'],
  [listMock({payment_links:[null]}), 'provider_response_invalid']
]) {
  if (code === 'provider_timeout') {
    const signal = AbortSignal.timeout(5);
    const keepAlive = setTimeout(() => {}, 100);
    try {
      await assert.rejects(requestPaymentLinks(env, transport, {signal}), {message:code});
    } finally {
      clearTimeout(keepAlive);
    }
  } else {
    await assert.rejects(discoverLostLink(env,lostCheckout,transport), {message:code});
  }
}
await assert.rejects(discoverLostLink({...env,RAZORPAY_KEY_SECRET:''},lostCheckout,forbidden), {message:'provider_configuration_missing'});
assert.equal(outbound,0);
console.log('PASS: sanitized provider diagnostics for transport, authentication, validation and identity failures');

for (const body of [undefined, {amount: c.amount}]) {
  await assert.rejects(requestPaymentLinks(env, async (url, options) => {
    assert.equal(new URL(url).origin, 'https://api.razorpay.com');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.method, body ? 'POST' : 'GET');
    assert.equal(atob(options.headers.Authorization.slice(6)), 'rzp_test_fixture:fixture');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.redirect('https://redirect.example.invalid', 307);
  }, {body}), {
    message: 'provider_network_failure',
    details: {phase: 'redirect_blocked', exception: null}
  });
}

await assert.rejects(requestPaymentLinks({...env, RAZORPAY_KEY_SECRET: '🔒'}, forbidden), {
  message: 'invalid_test_credentials',
  details: {phase: 'basic_auth_encoding', exception: 'InvalidCharacterError'}
});
assert.equal(outbound, 0);

const originalConsoleError = console.error;
try {
  const logs = [];
  console.error = message => logs.push(JSON.parse(message));
  await assert.rejects(requestPaymentLinks(env, async () => {
    throw new TypeError('sensitive fixture that must never be logged');
  }), error => {
    const response = checkoutFailure('recover', 'provider_discovery', 'correlation-fixture', error);
    assert.equal(response.status, 503);
    return true;
  });
  assert.deepEqual(logs, [{
    event: 'checkout_failure', operation: 'recover', stage: 'provider_discovery',
    correlationId: 'correlation-fixture', code: 'provider_network_failure',
    providerDetails: {phase: 'fetch', exception: 'TypeError'}
  }]);
} finally {
  console.error = originalConsoleError;
}
console.log('PASS: manual redirects, basic authentication, and allowlisted runtime diagnostics');
