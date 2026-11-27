import {projectWorkforce} from './aop-workforce.js';
import {projectCommitments} from './aop-commitments.js';
import {budgetVariance} from './aop-budget.js';
export function projectScenario({opening,months,pools,budgets}){
 const workforce=projectWorkforce(opening,months.map(m=>m.movements));
 const keys=months.map(m=>m.month);
 if(new Set(keys).size!==keys.length||keys.some((k,i)=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)||(i>0&&k<=keys[i-1])))throw Error('invalid months');
 const commitments=projectCommitments(pools.map(p=>{
 const i=keys.indexOf(p.month);if(i<0||!Array.isArray(p.departments)||new Set(p.departments).size!==p.departments.length)throw Error('invalid pool');
 const demand=p.departments.reduce((n,d)=>{if(!Object.hasOwn(workforce[i].closing,d))throw Error('unknown department');return n+workforce[i].closing[d];},0);
 return {...p,demand};
 }));
 const totals=new Map();
 for(const c of commitments){const k=JSON.stringify([c.month,c.currency]);totals.set(k,(totals.get(k)||0n)+BigInt(c.expenseMinor));}
 const seen=new Set();
 const variances=budgets.map(b=>{const k=JSON.stringify([b.period,b.currency]);if(seen.has(k)||!keys.includes(b.period))throw Error('invalid budget period');seen.add(k);const n=totals.get(k)||0n;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('forecast overflow');return budgetVariance({...b,forecastMinor:Number(n)});});
 return {workforce,commitments,variances,totals:[...totals].map(([k,v])=>{const [month,currency]=JSON.parse(k);return {month,currency,expenseMinor:v.toString()};})};
}
