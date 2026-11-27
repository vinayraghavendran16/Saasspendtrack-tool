import {comparePricing} from './pricing-scenario.js';
// Caller must load authorized canonical contract and offer records; no database access here.
export function compareContractPricing({contract,offers,quantities}={}){
 if(!contract||typeof contract.id!=='string'||!contract.id||typeof contract.account_id!=='string'||!contract.account_id||!Array.isArray(offers)||offers.some(o=>o.account_id!==contract.account_id||o.contract_id!==contract.id))throw Error('contract scope mismatch');
 return {contractId:contract.id,scenarios:comparePricing({currency:contract.currency,quantities,offers})};
}
