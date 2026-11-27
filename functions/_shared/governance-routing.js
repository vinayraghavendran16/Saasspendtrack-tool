// Pure routing: callers must supply tenant-scoped membership and assignment rows.
export function routeGovernance({assignments=[],members=[],vendorId,kind,level=0}){
 const active=new Map(members.filter(m=>m.status==='active').map(m=>[m.email,m]));
 const roles=level>=2?['escalation']:level===1?['backup']:kind==='technical'?['technical','business']:['business','finance'];
 const recipients=new Set(),missing=[];
 for(const role of roles){
  const specific=assignments.find(a=>a.vendor_id===vendorId&&a.role===role);
  const fallback=assignments.find(a=>a.vendor_id==='@workspace'&&a.role===role);
  const chosen=[specific,fallback].find(a=>a&&a.accepted_at!=null&&active.has(a.member_email));
  if(chosen)recipients.add(chosen.member_email);else missing.push(role);
 }
 if(missing.length||!recipients.size){
  for(const m of active.values())if(m.role==='owner')recipients.add(m.email);
 }
 return {recipients:[...recipients].sort(),missing,unroutable:recipients.size===0};
}
