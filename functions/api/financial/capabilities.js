import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestGet({request,env}){
 const pupm=env.PUPM_ENABLED==='true',reviews=env.DECISION_INTELLIGENCE_ENABLED==='true';
 if(!pupm&&!reviews)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 return json({financialIntelligence:true,pupm,reviews});
}
