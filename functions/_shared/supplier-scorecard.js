export function supplierScorecard(cases,now){
 const open=cases.filter(c=>!['resolved','closed'].includes(c.status));
 const withDeadline=open.filter(c=>Number.isSafeInteger(c.resolution_due_at));
 return {totalCases:cases.length,openCases:open.length,criticalOpen:open.filter(c=>c.severity==='critical').length,overdueOpen:withDeadline.filter(c=>c.resolution_due_at<now).length,openWithoutDeadline:open.length-withDeadline.length};
}
