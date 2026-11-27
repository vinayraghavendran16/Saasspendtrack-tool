import {calendarDay} from './governance-deadlines.js';
// Deterministic review queue. Never approves or executes actions.
export function prioritizeActions(actions,today){
 const now=calendarDay(today);if(now===null||!Array.isArray(actions)||actions.length>10000)throw Error('invalid queue');
 const ids=new Set();
 return actions.map(a=>{
 if(typeof a.id!=='string'||!a.id||ids.has(a.id)||!['critical','high','medium','low'].includes(a.risk)||!['verified','quoted','assumed','unknown'].includes(a.evidence)||!['finance','it','procurement','revops','leadership'].includes(a.ownerRole))throw Error('invalid action');ids.add(a.id);
 const deadline=a.deadline==null?null:calendarDay(a.deadline);if(a.deadline!=null&&deadline===null)throw Error('invalid deadline');
 const days=deadline===null?null:(deadline-now)/86400000;
 const priority=a.risk==='critical'||(days!==null&&days<=7)?0:a.risk==='high'||(days!==null&&days<=30)?1:2;
 return {...a,daysRemaining:days,priority,requiresEvidence:a.evidence==='assumed'||a.evidence==='unknown',status:'requires_review'};
 }).sort((a,b)=>a.priority-b.priority||(a.daysRemaining??Infinity)-(b.daysRemaining??Infinity)|| (a.id<b.id?-1:a.id>b.id?1:0));
}
