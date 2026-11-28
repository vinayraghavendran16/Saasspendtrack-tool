import {json,requireAdmin} from '../../_shared/util.js';
import {trialDeliveryHealth} from '../../_shared/trial-delivery-health.js';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function onRequestGet({request,env}){
 if(env.TRIAL_DELIVERY_HEALTH_ENABLED!=='true')return json({error:'disabled'},404,headers);
 const gate=await requireAdmin(request,env);
 if(gate.response)return gate.response;
 try{return json(await trialDeliveryHealth(env.DB),200,headers);}
 catch{return json({error:'delivery_health_unavailable'},503,headers);}
}
