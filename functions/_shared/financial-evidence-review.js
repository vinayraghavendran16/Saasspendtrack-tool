import {calendarDay} from './governance-deadlines.js';
import {evaluateFinancialOutcome} from './decision-financial-outcome.js';
// Only compare contract-specific, closed annual calendar periods, not arbitrary partial periods.
// A ledger record is not independently verified and does not establish causality.
export function reviewFinancialEvidence({evaluation,approval,contractId,rows,asOf}){
 if(!evaluation||typeof contractId!=='string'||!contractId||evaluation.scopeKey!==contractId||!/^\d{4}$/.test(evaluation.periodKey)||!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('invalid reconciliation scope');
 const start=evaluation.periodKey+'-01-01',end=evaluation.periodKey+'-12-31';
 const cutoff=calendarDay(asOf);
 if(cutoff===null||calendarDay(start)===null||cutoff<=calendarDay(end))throw Error('period not closed');
 const sourceKeys=new Set();
 const facts=rows.map(r=>{
  const d=calendarDay(r.effective_date),key=JSON.stringify([r.source_id,r.source_record_id]);
  if(r.contract_id!==contractId||r.currency!==evaluation.currency||d===null||d<calendarDay(start)||d>calendarDay(end)||typeof r.source_id!=='string'||!r.source_id||typeof r.source_record_id!=='string'||!r.source_record_id||sourceKeys.has(key))throw Error('invalid ledger evidence');
  sourceKeys.add(key);
  return {id:r.id,kind:r.kind,amountMinor:r.amount_minor,currency:r.currency,scopeKey:contractId,periodKey:evaluation.periodKey};
 });
 const result=evaluateFinancialOutcome({evaluation,approval,facts});
 return {...result,periodStart:start,periodEnd:end,evidenceLevel:'ledger_reconciled',learningEligible:false,completeness:'not_established'};
}
