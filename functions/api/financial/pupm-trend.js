import {json,requireEntitledRole} from '../../_shared/util.js';
import {trendMonths,changeBasisPoints} from '../../_shared/pupm-trend.js';
import {monthlyPupm} from './pupm.js';
export async function onRequestGet({request,env}){
 if(env.PUPM_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const q=new URL(request.url).searchParams,end=q.get('end'),currency=q.get('currency'),count=q.get('months')??'6';
 let months;try{
 if(!/^[A-Z]{3}$/.test(currency??'')||!/^([1-9]|1[0-2])$/.test(count)||!end||end>=new Date().toISOString().slice(0,7))throw Error();
 months=trendMonths(end,Number(count));
 }catch{return json({error:'invalid_range'},400);}
 const periods=[];let previous=null;
 for(const month of months){
 const response=await monthlyPupm(env,g.membership.account_id,month);
 const data=await response.json();
 const metric=response.ok?data.metrics.find(r=>r.currency===currency)??null:null;
 periods.push({month,metric,status:!response.ok?'unavailable':metric?'observed':data.population.status==='available'?'missing_currency_records':data.population.status,changeBasisPoints:changeBasisPoints(previous,metric)});
 previous=metric;
 }
 return json({currency,basis:'invoiced',denominator:'employees',completeness:'not_established',periods});
}
