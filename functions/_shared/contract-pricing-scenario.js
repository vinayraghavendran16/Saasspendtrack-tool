import {comparePricing} from './pricing-scenario.js';
// Caller loads authorized canonical contract and offer records, including line currency.
export function compareContractPricing({contract,offers,quantities}={}){
 if(!contract||typeof contract.id!=='string'||!contract.id||typeof contract.account_id!=='string'||!contract.account_id||!Array.isArray(offers)||!offers.length||offers.some(o=>!o||o.account_id!==contract.account_id||o.contract_id!==contract.id))throw Error('contract scope mismatch');
 const currencies=new Set(offers.map(o=>o.currency));
 if(currencies.size!==1)throw Error('compare one currency at a time');
 return {contractId:contract.id,scenarios:comparePricing({currency:offers[0].currency,quantities,offers})};
}
