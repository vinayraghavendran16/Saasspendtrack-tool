import {calendarDay,deadlineMilestone} from './governance-deadlines.js';
import {routeGovernance} from './governance-routing.js';
export function planRenewals({today,contracts,assignments,members}){
 const jobs=[],unroutable=[];
 for(const c of contracts){
  for(const [kind,deadline] of [['renewal',c.end_date],['notice',c.notice_date]]){
   const m=deadlineMilestone({today,deadline,kind});if(!m)continue;
   const route=routeGovernance({assignments,members,vendorId:c.id,kind});
   if(route.unroutable)unroutable.push({contractId:c.id,kind});
   for(const email of route.recipients)jobs.push({contractId:c.id,kind,deadlineAt:calendarDay(deadline),milestone:m.milestone,recipientEmail:email});
  }
 }
 return {jobs,unroutable};
}
