import {checkoutController} from './checkout-controller.js';
const api=checkoutController();
export function mountCheckout(root) {
 let busy=false;
 const status=document.createElement('p');status.setAttribute('role','status');
 const actions=document.createElement('div');
 root.replaceChildren(status,actions);
 function button(label,fn){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy;
  b.addEventListener('click',async()=>{if(busy)return;busy=true;for(const x of actions.querySelectorAll('button'))x.disabled=true;
   try{await fn();await refresh();}catch{status.textContent='Checkout unavailable or pending reconciliation. Refresh before retrying.';}
   finally{busy=false;for(const x of actions.querySelectorAll('button'))x.disabled=false;}
  });actions.append(b);
 }
 async function refresh(){
  const {checkout:c}=await api.status();actions.replaceChildren();
  if(!c||['expired','cancelled'].includes(c.status)){
   status.textContent='Choose an annual plan (USD). Sandbox only.';
   button('Founding — $1,499/year',()=>api.reserve('founding'));
   button('Growth — $2,000/year',()=>api.reserve('standard'));
  }else{
   status.textContent=c.status==='paid'?'Payment verified. Reload workspace to refresh access.':'Checkout status: '+c.status;
   if(c.canCreate||c.canResume)button('Continue to payment',async()=>{location.assign(await api.create(c.id));});
   if(c.canRecover)button('Recover checkout',async()=>{await api.recover(c.id);});
   if(c.canCancel)button('Cancel reservation',()=>api.cancel(c.id));
   if(c.canCheckRelease)button('Check expired payment',()=>api.release(c.id));
  }
  button('Refresh status',async()=>{});
 }
 refresh().catch(()=>{status.textContent='Sandbox checkout unavailable.';button('Retry status',async()=>{});});
}
