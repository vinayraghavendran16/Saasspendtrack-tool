import { requirePlatformOwner } from '../../_shared/platform-owner.js';
import { json } from '../../_shared/util.js';
const keys = new Set(['roadmap','changelog','upvotedRoadmap','crTab','onepager']);
const headers = {'Cache-Control':'private, no-store'};
export async function onRequestGet({request,env}) {
  const gate = await requirePlatformOwner(request,env);
  if (gate.response) return gate.response;
  const {results} = await env.DB.prepare('SELECT key,value_json FROM platform_settings').all();
  return json({settings:Object.fromEntries(results.filter(r=>keys.has(r.key)).map(r=>[r.key,JSON.parse(r.value_json)]))},200,headers);
}
export async function onRequestPut({request,env}) {
  const gate = await requirePlatformOwner(request,env);
  if (gate.response) return gate.response;
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'forbidden_origin'},403,headers);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')) return json({error:'invalid_content_type'},415,headers);
  let body;
  try { const raw = await request.text(); if (raw.length > 262144) return json({error:'too_large'},413,headers); body=JSON.parse(raw); } catch (_) {return json({error:'invalid_json'},400,headers);}
  if (!body || !keys.has(body.key) || !Object.hasOwn(body,'value')) return json({error:'invalid_setting'},400,headers);
  const value=body.value;
  const valid = ['roadmap','changelog'].includes(body.key) ? Array.isArray(value) :
    body.key==='crTab' ? ['roadmap','changelog'].includes(value) :
    value !== null && typeof value==='object' && !Array.isArray(value);
  if (!valid) return json({error:'invalid_value'},400,headers);
  await env.DB.prepare('INSERT INTO platform_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at').bind(body.key,JSON.stringify(value),Date.now()).run();
  return json({ok:true},200,headers);
}
