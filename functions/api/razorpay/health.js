import {requireAdmin,json} from '../../_shared/util.js';
import {checkoutHealth} from '../../_shared/checkout-health.js';
export async function onRequestGet({request,env}){
 if(env.CHECKOUT_ISOLATED_SANDBOX!=='true'||env.CHECKOUT_HEALTH_ENABLED!=='true')return json({error:'disabled'},503);
 try{
  const auth=await requireAdmin(request,env);
  if(auth.response)return auth.response;
  return new Response(JSON.stringify(await checkoutHealth(env.DB)),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return json({error:'health_unavailable'},503);}
}
