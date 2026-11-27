export function reconcilePopulation(rows,denominator){
 if(!Array.isArray(rows)||!['employees','purchased_seats','assigned_users','active_users'].includes(denominator))throw Error('invalid input');
 const candidates=rows.filter(r=>r.denominator===denominator);
 if(!candidates.length)return {status:'missing',count:null};
 if(candidates.some(r=>!Number.isSafeInteger(r.population)||r.population<0))throw Error('invalid population');
 if(candidates.length!==1)return {status:'source_conflict',count:null,candidateCount:candidates.length};
 const r=candidates[0];
 return {status:r.population===0?'zero_population':'available',count:r.population,observationId:r.id,activeWindowDays:r.active_window_days??null};
}
