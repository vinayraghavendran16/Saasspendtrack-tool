import { json, requireRole } from '../../_shared/util.js';

export async function onRequestGet({request,env}) {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  const gate=await requireRole(request,env,'admin');
  if(gate.response) return gate.response;
  const days=Number(new URL(request.url).searchParams.get('days') || 30);
  if(![7,30,90].includes(days)) return json({error:'invalid_window'},400,headers);
  if(!env.USAGE_HMAC_SECRET) return json({error:'analytics_not_configured'},503,headers);
  const since=Date.now()-days*86400000;
  const where='occurred_at >= ? AND account_id = ?';
  const args=[since,gate.membership.account_id];
  try {
    const totals=await env.DB.prepare('SELECT COUNT(*) events, COUNT(DISTINCT actor_key) active_workspace_actors, COUNT(DISTINCT account_id) active_workspaces FROM usage_events WHERE '+where).bind(...args).first();
    const features=await env.DB.prepare('SELECT event_name, COUNT(*) events, COUNT(DISTINCT actor_key) actors FROM usage_events WHERE '+where+' GROUP BY event_name ORDER BY event_name').bind(...args).all();
    return json({days,since,totals,features:features.results || [],scope:'workspace'},200,headers);
  } catch (_) { return json({error:'analytics_unavailable'},503,headers); }
}
