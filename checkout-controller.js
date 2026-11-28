// Standalone browser module; not loaded by production UI.
export function checkoutController(transport=fetch) {
 let busy=false;
 async function call(path,body) {
  const r=await transport('/api/razorpay/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await r.json();
  if(!r.ok) throw new Error(data.error||'checkout_unavailable');
  return data;
 }
 async function exclusive(fn) {
  if(busy) throw new Error('checkout_busy');
  busy=true;try{return await fn();}finally{busy=false;}
 }
 function safeLink(raw) {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='rzp.io'||u.username||u.password||u.port) throw new Error('invalid_checkout_url');
  return u.href;
 }
 return {
  status:()=>call('checkout-status'),
  reserve:tier=>exclusive(()=>call('reserve',{tier})),
  create:checkoutId=>exclusive(async()=>safeLink((await call('create-link',{checkoutId})).url)),
  recover:checkoutId=>exclusive(async()=>{const r=await call('recover-link',{checkoutId});return {...r,...(r.url?{url:safeLink(r.url)}:{})};}),
  cancel:checkoutId=>exclusive(()=>call('cancel-reservation',{checkoutId})),
  release:checkoutId=>exclusive(()=>call('release-expired',{checkoutId}))
 };
}
