import {json,requireEntitledRole} from '../../_shared/util.js';
import {reconcilePopulation} from '../../_shared/population-reconciliation.js';
import {invoicedPupm} from '../../_shared/invoiced-pupm.js';
export async function onRequestGet({request,env}){
 if(env.PUPM_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const a=g.membership.account_id,month=new URL(request.url).searchParams.get('month');
 if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month>=new Date().toISOString().slice(0,7))return json({error:'closed_month_required'},400);
 const {results:pop=[]}=await env.DB.prepare("SELECT p.id,p.denominator,p.population,p.active_window_days FROM pupm_population_observations p WHERE p.account_id=? AND p.scope_type='organization' AND p.scope_id=? AND p.month=? AND p.denominator='employees' AND NOT EXISTS(SELECT 1 FROM pupm_population_observations n WHERE n.account_id=p.account_id AND n.supersedes_id=p.id) LIMIT 501").bind(a,a,month).all();
 const population=reconcilePopulation(pop,'employees');
 const base={month,scopeType:'organization',denominator:'employees',basis:'invoiced',definitionVersion:1,completeness:'not_established',population,sourceTrust:'owner_reported'};
 if(population.status!=='available')return json({...base,metrics:[]});
 const {results:rows=[]}=await env.DB.prepare("SELECT kind,currency,CAST(amount_minor AS TEXT) AS amount_minor FROM reporting_financial_facts WHERE account_id=? AND effective_date>=? AND effective_date<=? AND kind IN ('invoice','credit') LIMIT 10001").bind(a,month+'-01',month+'-31').all();
 if(rows.length>10000)return json({error:'ledger_limit_exceeded'},422);
 let metrics;try{metrics=invoicedPupm(rows,population.count);}catch{return json({error:'ledger_sign_or_currency_requires_review'},422);}
 return json({...base,metrics,ledgerStatus:rows.length?'records_present':'missing'});
}
