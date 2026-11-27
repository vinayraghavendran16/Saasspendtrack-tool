// Construct only from a successful server-side requireEntitledRole(owner) result.
export function ownerArtifactResolver(db,guard){
 if(!guard||guard.response||guard.membership?.role!=='owner'||guard.membership?.status!=='active'||!guard.membership.account_id||!guard.user?.email)throw Error('owner authorization required');
 const account=guard.membership.account_id;
 return async(accountId,id,digest)=>{
 if(accountId!==account||typeof id!=='string'||!id||id.length>256||! /^[a-f0-9]{64}$/.test(digest??''))return null;
 const row=await db.prepare("SELECT v.pages_json,v.digest FROM ai_artifact_versions v JOIN ai_artifacts a ON a.account_id=v.account_id AND a.id=v.artifact_id WHERE v.account_id=? AND v.artifact_id=? AND v.digest=? AND a.status='active'").bind(account,id,digest).first();
 if(!row)return null;
 let pages;try{pages=JSON.parse(row.pages_json);}catch{return null;}
 if(!Array.isArray(pages)||pages.some(p=>typeof p!=='string'))return null;
 return {accountId:account,id,digest:row.digest,pages};
 };
}
