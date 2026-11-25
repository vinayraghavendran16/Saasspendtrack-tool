import {json,requireRole} from '../../_shared/util.js';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','Content-Disposition':'attachment; filename="sst-ai-privacy-evidence.json"'};
export async function onRequestGet({request,env}){
 const gate=await requireRole(request,env,'admin');
 if(gate.response)return gate.response;
 const id=gate.membership.account_id,generatedAt=Date.now(),since=generatedAt-90*86400000;
 try{
 const [consent,lock,counts]=await Promise.all([
 env.DB.prepare('SELECT enabled,consent_version,changed_at FROM workspace_ai_settings WHERE account_id=?').bind(id).first(),
 env.DB.prepare('SELECT locked,changed_at FROM workspace_ai_locks WHERE account_id=?').bind(id).first(),
 env.DB.prepare('SELECT operation,outcome,COUNT(*) AS count FROM ai_egress_audit WHERE account_id=? AND occurred_at>=? AND occurred_at<=? GROUP BY operation,outcome').bind(id,since,generatedAt).all()
 ]);
 return json({schemaVersion:1,generatedAt,since,provider:'Anthropic',policy:{enabled:consent?.enabled===1&&consent?.consent_version==='workspace-ai-v2'&&lock?.locked!==1&&env.AI_GLOBAL_DISABLED!=='true',locked:lock?.locked===1,consentVersion:consent?.consent_version||null,changedAt:consent?.changed_at||null},auditCounts:counts.results||[],limitations:['Counts cover recorded gateway events only.','Authorization is not proof of delivery.','Missing records do not prove absence of transmission.','Not an independent attestation.']},200,headers);
 }catch(_){return json({error:'evidence_unavailable'},503,{'Cache-Control':'no-store'});}
}
