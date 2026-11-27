import {json,requireEntitledRole} from '../../_shared/util.js';
export async function onRequestPost({request,env}){
 const g=await requireEntitledRole(request,env,'admin');if(g.response)return g.response;
 let b;try{b=await request.json()}catch{return json({error:'bad_json'},400)}
 const name=typeof b?.name==='string'?b.name.trim():'',roles=b?.roles;
 if(!name||name.length>240||!Array.isArray(roles)||!roles.length||roles.length>3||roles.some(r=>!['supplier','reseller','publisher'].includes(r)))return json({error:'invalid_party'},400);
 const account=g.membership.account_id,id=crypto.randomUUID();
 await env.DB.batch([env.DB.prepare('INSERT INTO commercial_parties(account_id,id,name) VALUES(?,?,?)').bind(account,id,name),...[...new Set(roles)].map(r=>env.DB.prepare('INSERT INTO commercial_party_roles(account_id,party_id,role) VALUES(?,?,?)').bind(account,id,r))]);
 return json({id,name,roles:[...new Set(roles)]},201);
}
