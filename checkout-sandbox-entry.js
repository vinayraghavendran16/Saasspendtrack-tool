import {mountCheckout} from './checkout-sandbox.js';
const root=document.getElementById('checkout-root');
if(root) {
 try {
  const r=await fetch('/api/razorpay/checkout-status',{credentials:'same-origin',cache:'no-store',redirect:'error'});
  if(!r.ok) throw new Error('disabled');
  mountCheckout(root);
 } catch {root.textContent='Sandbox checkout is unavailable. Sign in as a workspace owner in the isolated test environment.';}
}
