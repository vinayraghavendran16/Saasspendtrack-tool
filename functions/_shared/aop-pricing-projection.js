import {projectScenario} from './aop-scenario.js';
import {compareContractPricing} from './contract-pricing-scenario.js';
export function projectCommercialOptions({scenario,contract,offers,departments}={}){
 if(!Array.isArray(departments)||!departments.length||new Set(departments).size!==departments.length)throw Error('invalid departments');
 const projection=projectScenario(scenario);
 const months=scenario.months.map((m,i)=>{
 const closing=projection.workforce[i].closing;
 const quantity=departments.reduce((sum,d)=>{if(!Object.hasOwn(closing,d))throw Error('unknown department');return sum+closing[d];},0);
 return {month:m.month,...compareContractPricing({contract,offers,quantities:[quantity]}).scenarios[0]};
 });
 return {contractId:contract.id,months,basis:'headcount_scenario_not_commitment',existingCommitments:projection.commitments};
}
