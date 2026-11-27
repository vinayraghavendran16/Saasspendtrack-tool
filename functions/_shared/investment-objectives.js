// Explicit targets; no inferred causal attribution or implicit currency conversion.
export function evaluateObjective({direction,baseline,target,actual=null,unit}){
 if(!['increase','decrease'].includes(direction)||typeof unit!=='string'||!unit.trim()||unit.length>80||![baseline,target].every(Number.isSafeInteger)||(actual!==null&&!Number.isSafeInteger(actual)))throw Error('invalid objective');
 if(direction==='increase'?target<=baseline:target>=baseline)throw Error('target must improve baseline');
 const sign=direction==='increase'?1n:-1n;
 return {unit,direction,baseline,target,actual,status:actual===null?'unknown':sign*(BigInt(actual)-BigInt(target))>=0n?'met':'unmet',progressBasisPoints:actual===null?null:((BigInt(actual)-BigInt(baseline))*10000n/(BigInt(target)-BigInt(baseline))).toString(),attribution:'not_established'};
}
