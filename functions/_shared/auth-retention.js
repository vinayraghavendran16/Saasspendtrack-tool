// Proposed retention policy; not wired into cron until reviewed and approved.
const DAY=86400000;
const targets=[
 {table:'login_tokens',key:'token_hash',column:'expires_at',age:DAY},
 {table:'sessions',key:'id',column:'expires_at',age:DAY},
 {table:'rate_limits',key:'rl_key',column:'window_start',age:2*DAY},
];
export async function authRetention(env,{now=Date.now()}={}){
 const mode=env.AUTH_RETENTION_MODE;
 if(mode!=='dry-run' && mode!=='enabled') return {mode:'disabled'};
 if(!Number.isSafeInteger(now)||now<0) throw new Error('invalid retention clock');
 const counts={};
 for(const {table,key,column,age} of targets){
  const cutoff=now-age;
  const selection=`SELECT ${key} FROM ${table} WHERE ${column} < ? ORDER BY ${column}, ${key} LIMIT 500`;
  if(mode==='dry-run'){
   const row=await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${selection})`).bind(cutoff).first();
   counts[table]=row.n;
  }else{
   const result=await env.DB.prepare(`DELETE FROM ${table} WHERE ${key} IN (${selection}) AND ${column} < ?`).bind(cutoff,cutoff).run();
   counts[table]=result.meta?.changes ?? null;
  }
 }
 return {mode,counts};
}
