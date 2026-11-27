import {requireEntitledRole} from '../../_shared/util.js';
import {financialReport} from '../../_shared/financial-report.js';
import {reportPeriod} from '../../_shared/report-period.js';
import {reportCsv} from '../../_shared/report-csv.js';
export async function onRequestGet({request,env}){
 if(env.COMMERCIAL_REPORTS_ENABLED!=='true')return new Response(null,{status:404});
 const auth=await requireEntitledRole(request,env,'admin');
 if(auth instanceof Response)return auth;
 const q=new URL(request.url).searchParams;
 const start=q.get('start'),end=q.get('end'),grain=q.get('grain')??'month',fiscalStartMonth=Number(q.get('fiscalStartMonth')??1);
 try{reportPeriod(start,end,grain);if(!Number.isInteger(fiscalStartMonth)||fiscalStartMonth<1||fiscalStartMonth>12)throw Error();}catch{return new Response('Invalid period',{status:400});}
 const result=await env.DB.prepare('SELECT effective_date,currency,kind,amount_minor FROM reporting_financial_facts WHERE account_id=? AND effective_date BETWEEN ? AND ? LIMIT 10001').bind(auth.membership.account_id,start,end).all();
 if(result.results.length>10000)return new Response('Narrow reporting period',{status:409});
 const rows=financialReport(result.results,{start,end,grain,fiscalStartMonth});
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(q.get('format')==='csv')return new Response(reportCsv(['Period','Currency','Actual minor units','Budget minor units','Variance minor units'],rows.map(r=>[r.bucket,r.currency,r.actualMinor,r.budgetMinor,r.varianceMinor])),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="financial-report.csv"'}});
 return Response.json({rows,start,end,grain,fiscalStartMonth},{headers});
}
