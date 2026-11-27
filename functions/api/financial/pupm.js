import {json,requireEntitledRole} from '../../_shared/util.js';
import {reconcilePopulation} from '../../_shared/population-reconciliation.js';
import {invoicedPupm} from '../../_shared/invoiced-pupm.js';
export async function onRequestGet({request,env}){
 if(env.PUPM_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 const a=g.membership.account_id,month=new URL(request.url).searchParams.get('month');
 if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month>=new Date().toISOString().slice(0,7))return json({error:'closed_month_required'},400);
 const {results:pop=[]}=await env.DB.prepare("SELECT p.id,p.denominator,p.population,p.active_window_days FROM pupm_population_observations p WHERE p.account_id=? AND p.scope_type='organization' AND p.scope_id=? AND p.month=? AND p.denominator='employees' AND NOT EXISTS(SELECT 1 FROM pupm_population_observations n WHERE n.account_id=p.account_id AND n.supersedes_id=p.id) LIMIT 501").bind(a,a,month).all();
 if(pop.length>500)return json({error:'too_many_observations'},422);
 let population=reconcilePopulation(pop,'employees');
 if(population.status==='source_conflict'){
 const selected=await env.DB.prepare("SELECT s.id,s.observation_id,s.selected_at FROM pupm_source_selections s JOIN pupm_population_observations p ON p.account_id=s.account_id AND p.id=s.observation_id WHERE s.account_id=? AND p.scope_type='organization' AND p.scope_id=? AND p.month=? AND p.denominator='employees' ORDER BY s.selected_at DESC,s.id DESC LIMIT 2").bind(a,a,month).all();
 const choices=selected.results??[],latest=choices[0];
 if(latest&&(!choices[1]||choices[1].selected_at!==latest.selected_at)){
 const chosen=pop.find(p=>p.id===latest.observation_id);
 if(chosen)population={...reconcilePopulation([chosen],'employees'),selectionId:latest.id,selectionStatus:'owner_selected'};
 else population={...population,selectionStatus:'stale'};
 }
 }
 const base={month,scopeType:'organization',denominator:'employees',basis:'invoiced',definitionVersion:1,completeness:'not_established',population,sourceTrust:'owner_reported'};
 if(population.status!=='available')return json({...base,metrics:[]});
 const {results:rows=[]}=await env.DB.prepare("SELECT kind,currency,CAST(amount_minor AS TEXT) AS amount_minor FROM reporting_financial_facts WHERE account_id=? AND effective_date>=? AND effective_date<=? AND kind IN ('invoice','credit') LIMIT 10001").bind(a,month+'-01',month+'-31').all();
 if(rows.length>10000)return json({error:'ledger_limit_exceeded'},422);
 let metrics;try{metrics=invoicedPupm(rows,population.count);}catch{return json({error:'ledger_sign_or_currency_requires_review'},422);}
 return json({...base,metrics,ledgerStatus:rows.length?'records_present':'missing'});
}
