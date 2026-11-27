import {json,requireEntitledRole} from '../../_shared/util.js';
import {reviewFinancialEvidence} from '../../_shared/financial-evidence-review.js';
export async function onRequestPost({request,env}){
 if(env.DECISION_INTELLIGENCE_ENABLED!=='true')return new Response(null,{status:404});
 const g=await requireEntitledRole(request,env,'owner');if(g.response)return g.response;
 let b;try{const raw=await request.text();if(raw.length>4096)return json({error:'too_large'},413);b=JSON.parse(raw);if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1)throw Error();}catch{return json({error:'invalid_review'},400);}
 const a=g.membership.account_id;
 const saved=await env.DB.prepare('SELECT v.evaluation_json,a.selected_alternative_id FROM investment_decision_versions v JOIN investment_decision_approvals a ON a.account_id=v.account_id AND a.decision_id=v.decision_id AND a.revision=v.revision WHERE v.account_id=? AND v.decision_id=? AND v.revision=?').bind(a,b.id,b.revision).first();
 if(!saved)return json({error:'approval_required'},404);
 const evaluation=JSON.parse(saved.evaluation_json),contract=evaluation.scopeKey,year=evaluation.periodKey;
 if(!/^\d{4}$/.test(year))return json({error:'calendar_year_required'},422);
 const {results=[]}=await env.DB.prepare("SELECT id,contract_id,source_id,source_record_id,kind,effective_date,currency,amount_minor FROM reporting_financial_facts WHERE account_id=? AND contract_id=? AND effective_date BETWEEN ? AND ? AND kind IN ('invoice','credit') ORDER BY id LIMIT 10001").bind(a,contract,year+'-01-01',year+'-12-31').all();
 let result;try{result=reviewFinancialEvidence({evaluation,approval:{status:'approved',revision:b.revision,alternativeId:saved.selected_alternative_id},contractId:contract,rows:results,asOf:new Date().toISOString().slice(0,10)});}catch{return json({error:'evidence_incomplete_or_invalid'},422);}
 const row=await env.DB.prepare('INSERT INTO decision_financial_reviews(account_id,decision_id,revision,contract_id,period_start,period_end,selected_alternative_id,result_json,evidence_json,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING revision').bind(a,b.id,b.revision,contract,result.periodStart,result.periodEnd,saved.selected_alternative_id,JSON.stringify(result),JSON.stringify(results),g.user.email,Date.now()).first();
 return row?json(result,201):json({error:'review_already_exists'},409);
}
