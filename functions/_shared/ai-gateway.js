export async function hasAiConsent(env, accountId) {
  if (!accountId || env.AI_GLOBAL_DISABLED === 'true') return false;
  try {
    const row=await env.DB.prepare('SELECT s.enabled, s.consent_version, COALESCE(l.locked,0) AS locked FROM workspace_ai_settings s LEFT JOIN workspace_ai_locks l ON l.account_id=s.account_id WHERE s.account_id=?').bind(accountId).first();
    return row?.locked===0 && row?.enabled===1 && row?.consent_version==='workspace-ai-v2';
  } catch (_) { return false; }
}
const destinations=new Map([
 ['https://api.anthropic.com/v1/models?limit=100','GET'],
 ['https://api.anthropic.com/v1/messages','POST']
]);
async function audit(env,accountId,operation,outcome,requestId){
 await env.DB.prepare('INSERT INTO ai_egress_audit(id,account_id,operation,outcome,occurred_at,request_id) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),accountId,operation,outcome,Date.now(),requestId).run();
}
export async function aiFetch(env, accountId, url, options={}) {
 if (destinations.get(url)!==(options.method || 'GET').toUpperCase()) throw Error('AI destination denied');
 const requestId=crypto.randomUUID();
 const operation=url.includes('/models?')?'model_discovery':'messages';
 if (!await hasAiConsent(env,accountId)) {
   try {await audit(env,accountId,operation,'denied',requestId);}catch(_){}
   throw Error('AI processing denied');
 }
 // No outbound request without a durable authorization audit record.
 await audit(env,accountId,operation,'authorized',requestId);
 if (!await hasAiConsent(env,accountId)) {
   try {await audit(env,accountId,operation,'denied',requestId);}catch(_){}
   throw Error('AI processing denied');
 }
 let response;
 try {response=await fetch(url,{...options,redirect:'error'});}
 catch(error){try{await audit(env,accountId,operation,'network_failure',requestId);}catch(_){}throw error;}
 try{await audit(env,accountId,operation,response.ok?'http_success':'http_failure',requestId);}catch(_){console.warn('AI outcome audit unavailable');}
 return response;
}
