// Pure presentation model. Server remains authoritative for all actions.
export function checkoutView(c) {
 if(!c || ['expired','cancelled'].includes(c.status)) return {message:'Choose an annual plan',actions:['founding','standard']};
 if(c.status==='paid') return {message:'Payment verified. Refresh workspace access.',actions:['refresh']};
 const actions=[];
 if(c.canCreate) actions.push('create');
 if(c.canResume) actions.push('resume');
 if(c.canRecover) actions.push('recover');
 if(c.canCancel) actions.push('cancel');
 if(c.canCheckRelease) actions.push('checkRelease');
 actions.push('refresh');
 return {message:c.status==='created'?'Payment confirmation pending':'Checkout reserved',actions};
}
