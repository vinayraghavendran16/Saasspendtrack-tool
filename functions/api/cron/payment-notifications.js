import {json,safeEqual} from '../../_shared/util.js';
import {processPaymentNotifications} from '../../_shared/payment-notifications.js';
export async function onRequestPost({request,env}){
 const secret=env.PAYMENT_QUEUE_SECRET;
 if(!secret||!safeEqual(request.headers.get('Authorization')||'','Bearer '+secret))return json({error:'unauthorized'},401);
 if(env.PAYMENT_QUEUE_ENABLED!=='true')return json({error:'disabled'},503);
 await processPaymentNotifications(env);
 return json({ok:true});
}
