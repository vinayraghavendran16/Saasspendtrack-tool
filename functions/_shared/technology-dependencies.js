// Reverse traversal: an edge dependent -> dependency means removing dependency may affect dependent.
// Caller supplies only one authorized workspace's graph. No absence-of-edge safety claim.
export function assessDependencyImpact({nodes,edges,removeIds}){
 if(!Array.isArray(nodes)||nodes.length>10000||!Array.isArray(edges)||edges.length>50000||!Array.isArray(removeIds)||!removeIds.length||removeIds.length>100)throw Error('invalid graph');
 const index=new Map(),reverse=new Map(),pairs=new Set(),rank={low:0,medium:1,high:2,critical:3};
 for(const n of nodes){if(typeof n.id!=='string'||!n.id||index.has(n.id)||!['objective','department','capability','product','contract','integration'].includes(n.kind))throw Error('invalid node');index.set(n.id,n);}
 for(const e of edges){const key=JSON.stringify([e.dependentId,e.dependencyId]);if(!index.has(e.dependentId)||!index.has(e.dependencyId)||e.dependentId===e.dependencyId||pairs.has(key)||!Object.hasOwn(rank,e.criticality)||!['verified','asserted','unknown'].includes(e.evidence))throw Error('invalid dependency');pairs.add(key);const list=reverse.get(e.dependencyId)||[];list.push(e);reverse.set(e.dependencyId,list);}
 const removed=new Set(removeIds);if(removed.size!==removeIds.length||removeIds.some(id=>!index.has(id)))throw Error('invalid removal');
 const reached=new Set(removed),queue=[...removed],impacts=new Map();
 for(let i=0;i<queue.length;i++){for(const e of reverse.get(queue[i])||[]){const id=e.dependentId;if(!removed.has(id)){const p=impacts.get(id)||{id,kind:index.get(id).kind,criticality:'low',requiresVerification:false,dependencies:[]};if(rank[e.criticality]>rank[p.criticality])p.criticality=e.criticality;p.requiresVerification||=e.evidence!=='verified';p.dependencies.push(e.dependencyId);impacts.set(id,p);}if(!reached.has(id)){reached.add(id);queue.push(id);}}}
 return {removed:[...removed],affected:[...impacts.values()].sort((a,b)=>rank[b.criticality]-rank[a.criticality]||(a.id<b.id?-1:a.id>b.id?1:0)),status:'requires_human_review',coverage:'unknown',safeToRemove:null};
}
