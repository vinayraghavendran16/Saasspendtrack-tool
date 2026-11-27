import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 if(env.AI_EXPLAINABILITY_ENABLED!=='true'||env.PLATFORM_AUDIT_ENABLED!=='true'||env.RENEWAL_AI_ANALYTICS_ENABLED!=='true')return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 return json({renewalAiAnalytics:true});
}
