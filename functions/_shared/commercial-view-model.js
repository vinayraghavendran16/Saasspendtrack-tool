export function spendRows(report,dimension){
 return (report?.groups??[]).filter(r=>r.dimension===dimension).map(r=>{
  const value=BigInt(r.annualMinorScaled),scale=BigInt(r.scale);
  return {id:r.id,currency:r.currency,wholeMinorUnits:(value/scale).toString(),fractionalMinorUnits:(value%scale).toString(),scale:r.scale};
 });
}
export function caseRows(cases,now=Date.now()){
 return cases.map(c=>({id:c.id,title:c.title,status:c.status,severity:c.severity,owner:c.owner_email??null,overdue:!['resolved','closed'].includes(c.status)&&c.resolution_due_at!=null&&c.resolution_due_at<=now,version:c.version}));
}
