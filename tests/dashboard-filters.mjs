import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('/* Dashboard filters are transient');
const end=html.indexOf('function renderSubscriptions()',start);
assert.ok(start>=0&&end>start);
const vstart=html.indexOf('function renderVendorTotals()');
const vend=html.indexOf('function renderInvoices()',vstart);
assert.ok(vstart>=0&&vend>vstart);
const state={subscriptions:[
{id:'a',name:'Annual',team:'IT',category:'Security',cycle:'yearly',cost:1200},
{id:'b',name:'Monthly',department:'Sales',category:'CRM',cycle:'monthly',cost:50},
{id:'c',name:'Paused',team:'IT',category:'Security',active:false,cycle:'monthly',cost:80},
{id:'d',name:'Historical',team:'IT',category:'Security',startDate:'2000-01-01',endDate:'2000-12-31',cycle:'monthly',cost:200},
],invoices:[],settings:{}};
const now=new Date(),date=(d)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
state.invoices=[{subId:'a',amount:30,paidDate:date(now)},{subId:'b',amount:70,paidDate:date(now)},{subId:'c',amount:20,dueDate:date(now)},{subId:'d',amount:40,paidDate:date(now)},{subId:'a',amount:1000,paidDate:'2026-02-30'}];
const elements=new Map(),label={textContent:''};
function el(id){if(!elements.has(id))elements.set(id,{value:'',dataset:{},style:{},innerHTML:'',textContent:'',hidden:false,addEventListener(){},closest(){return {querySelector(){return label}}},querySelectorAll(){return []}});return elements.get(id)}
const ctx={state,document:{getElementById:el},parseDate:s=>s?new Date(s+'T00:00:00'):null,
renderDashboardEmptyState(){},activeSubs:()=>state.subscriptions.filter(s=>s.active!==false),monthlyCost:s=>s.cost/({yearly:12,monthly:1}[s.cycle]||1),
animateNumber:(e,n)=>{e.textContent=String(n)},fmtMoney:String,formatMoney:n=>n.toFixed(2),escapeHtml:String,
invoiceStatus:i=>i.paidDate?'paid':'pending',consumption:()=>null,subName:id=>id,daysUntil:()=>0,formatDate:String};
const run=s=>runInNewContext(s,ctx);
run(html.slice(start,end)+'\n'+html.slice(vstart,vend));
assert.equal(run("dashDate('2026-02-30')"),null);
assert.equal(run("dashDate('2024-02-29').getDate()"),29);
assert.equal(run("dashRangeDates('12m',new Date(2024,1,29)).start.getDate()"),28);
assert.equal(run("dashRangeDates('qtd',new Date(2026,10,27)).start.getMonth()"),9);
assert.equal(run("dashRangeDates('mtd',new Date(2026,10,27)).end.getHours()"),23);
assert.equal(run("dashDepartment({team:'IT',department:'Legacy'})"),'IT');
assert.equal(run("dashDepartment({department:'Sales'})"),'Sales');
assert.equal(run("dashCategory({})"),'Uncategorized');
assert.equal(run("subInDashRange({startDate:'2026-02-30'},dashRangeDates('mtd'))"),false);
assert.equal(run("invInDashRange({},dashRangeDates('mtd'))"),false);
assert.equal(run("invInDashRange({paidDate:'9999-01-01'},null)"),false);
const original=JSON.stringify(state);
run("renderDashboard()");
assert.equal(el('stat-monthly').textContent,'350');
assert.equal(el('stat-paid').textContent,'140');
run("setDashFilters({range:'mtd',dept:'IT',cat:'Security'})");
assert.equal(el('stat-monthly').textContent,'100');
assert.equal(el('stat-annual').textContent,'1200');
assert.equal(el('stat-paid').textContent,'70');
assert.equal(el('stat-pending').textContent,'20');
assert.match(el('vendor-tbody').innerHTML,/Historical/);
assert.doesNotMatch(el('vendor-tbody').innerHTML,/Monthly<\/span>/);
assert.match(el('category-chart').innerHTML,/100.00/);
run("setDashFilters({dept:'Sales'})");
assert.equal(el('stat-monthly').textContent,'0');
assert.equal(el('stat-paid').textContent,'0');
assert.equal(el('stat-pending').textContent,'0');
run("setDashFilters({range:'all',dept:'',cat:''})");
assert.equal(el('stat-monthly').textContent,'350');
assert.equal(JSON.stringify(state),original,'filters must not mutate workspace data');
console.log('PASS dashboard financial scope, dates, empty results, clear filters, and no workspace mutations');
