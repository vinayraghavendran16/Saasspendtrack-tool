import {projectScenario} from './aop-scenario.js';
import {compareScenarios} from './aop-compare.js';
// Compare the same workforce and calendar, changing only the commitment assumptions.
export function projectDecisionImpact({workforce,baselinePools,alternativePools,budgets}){
 if(!workforce||!Array.isArray(workforce.months)||!workforce.months.length||workforce.months.length>12||!Array.isArray(baselinePools)||!Array.isArray(alternativePools)||!Array.isArray(budgets))throw Error('invalid planning inputs');
 const base=projectScenario({...workforce,pools:baselinePools,budgets});
 const alternative=projectScenario({...workforce,pools:alternativePools,budgets});
 const comparison=compareScenarios(base,alternative);
 return {baseline:base,alternative,comparison,complete:comparison.length>0&&comparison.every(r=>r.deltaMinor!==null),status:'planning_only'};
}
