import {refreshFinancialNavigation,clearFinancialNavigation} from './financial-navigation.js';
function refresh(){if(document.visibilityState==='visible')refreshFinancialNavigation();else clearFinancialNavigation();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.addEventListener('pageshow',refresh);
window.addEventListener('pagehide',clearFinancialNavigation);
document.addEventListener('visibilitychange',refresh);
document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#sst-logout,[href="/api/auth/logout"]'))clearFinancialNavigation();},true);
