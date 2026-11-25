export async function hasAiConsent(env, accountId) {
  if (!accountId || env.AI_GLOBAL_DISABLED === 'true') return false;
  try {
    const row=await env.DB.prepare('SELECT enabled, consent_version FROM workspace_ai_settings WHERE account_id=?').bind(accountId).first();
    return row?.enabled===1 && row?.consent_version==='workspace-ai-v2';
  } catch (_) { return false; }
}
const destinations=new Map([
 ['https://api.anthropic.com/v1/models?limit=100','GET'],
 ['https://api.anthropic.com/v1/messages','POST']
]);
export async function aiFetch(env, accountId, url, options={}) {
  if (destinations.get(url)!==(options.method || 'GET').toUpperCase()) throw Error('AI destination denied');
  if (!await hasAiConsent(env,accountId)) throw Error('AI processing denied');
  return fetch(url,{...options,redirect:'error'});
}
