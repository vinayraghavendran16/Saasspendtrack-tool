const modes=new Set(['manual_ui','bulk_import','integration_sync','api','scheduled_job','ai_assisted','system']);
const actors=new Set(['user','service','system','ai']);
const outcomes=new Set(['committed','denied','failed','observed','proposed']);
const token=(v,max)=>typeof v==='string'&&v.length<=max&&/^[A-Za-z0-9_:.@-]+$/.test(v);
export function auditStatement(db,context,event,allowedFields=[]){
 if(!context||!event||!token(context.accountId,128)||!token(context.actorId,256)||!actors.has(context.actorType)||!modes.has(context.mode)||!token(context.correlationId,128)||!token(event.action,80)||!token(event.entityType,80)||!token(event.entityId,256)||!outcomes.has(event.outcome))throw Error('invalid audit metadata');
 if(context.initiatorId!=null&&!token(context.initiatorId,256)||context.batchId!=null&&!token(context.batchId,128))throw Error('invalid audit provenance');
 const fields=event.changedFields??[];
 if(!Array.isArray(fields)||fields.length>64||fields.some(f=>!token(f,64)||!allowedFields.includes(f)))throw Error('invalid audit fields');
 const id=crypto.randomUUID(),now=Date.now();
 return db.prepare("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,initiator_id,mode,action,entity_type,entity_id,outcome,correlation_id,batch_id,changed_fields_json,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)").bind(context.accountId,id,now,context.actorType,context.actorId,context.initiatorId??null,context.mode,event.action,event.entityType,event.entityId,event.outcome,context.correlationId,context.batchId??null,JSON.stringify([...new Set(fields)].sort()));
}
