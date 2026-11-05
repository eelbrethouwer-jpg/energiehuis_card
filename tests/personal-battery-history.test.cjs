'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const registry=new Map();class Element{attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,setTimeout,
 window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:Element};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../energiehuis-card.js'),'utf8')+'\n;globalThis.B31={eh31Time,eh31ReadHomeWizard,eh31HistorySummary,eh31SimulateSolar,eh31ValidateProfile,eh31CompareHtml,eh31ComparisonResults,eh31CompareState,eh31DefaultProfiles};',ctx);
const b=ctx.B31;
const header='time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh,L1 max W';
const csv=lines=>header+'\r\n'+lines.join('\r\n')+'\r\n';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-8,`${a} != ${e}`);
const profile={name:'Eigen accu',capacity:1,chargeKw:4,dischargeKw:4,efficiency:100,standby:0,investment:1000,annualCosts:0};
const t=Date.parse('2026-06-01T00:00Z');
const row=(i,imp,exp)=>({t:t+i*900000,end:t+(i+1)*900000,import:imp,export:exp});

test('HomeWizard counters yield interval changes, never meter readings as usage',()=>{
 const d=b.eh31ReadHomeWizard('\uFEFF'+csv(['2026-06-01 00:00,100,200,30,40,','2026-06-01 00:15,100.2,200.3,30.1,40.2,','2026-06-01 00:30,100.4,200.6,30.2,40.4,']));
 assert.equal(d.resolution,'quarter');assert.equal(d.readings,3);assert.equal(d.valid,2);
 near(d.imported,1);near(d.exported,.6);near(d.intervals[0].import,.5);
 assert.equal(d.intervals[0].t,Date.parse('2026-05-31T22:00Z'));
});
test('quoted fields and semicolon decimal commas are accepted; formulas are not numbers',()=>{
 const d=b.eh31ReadHomeWizard('"time";"Import T1 kWh";"Import T2 kWh";"Export T1 kWh";"Export T2 kWh"\n2026-01-01 00:00;"1,2";0;0;0\n2026-01-01 00:15;"1,4";0;0;0');
 near(d.imported,.2);
 const bad=b.eh31ReadHomeWizard(csv(['2026-01-01 00:00,1,0,0,0,','2026-01-01 00:15,=1+1,0,0,0,']));
 assert.equal(bad.valid,0);assert.equal(bad.invalidCounters,1);assert.equal(bad.intervals[0].import,null);
});
test('spring skip and autumn repeated clock labels resolve to absolute quarter hours',()=>{
 const spring=b.eh31ReadHomeWizard(csv(['2026-03-29 01:45,0,0,0,0,','2026-03-29 03:00,1,0,0,0,','2026-03-29 03:15,2,0,0,0,']));
 assert.equal(spring.gaps,0);assert.equal(spring.intervals[0].end-spring.intervals[0].t,900000);
 const autumn=b.eh31ReadHomeWizard(csv(['2026-10-25 02:00,0,0,0,0,','2026-10-25 02:15,1,0,0,0,','2026-10-25 02:30,2,0,0,0,','2026-10-25 02:45,3,0,0,0,','2026-10-25 02:00,4,0,0,0,','2026-10-25 02:15,5,0,0,0,']));
 assert.equal(autumn.gaps,0);assert.equal(autumn.dstRepeated,2);assert.equal(autumn.valid,5);
 assert.equal(autumn.intervals[4].t-autumn.intervals[0].t,3600000);
 assert.equal(b.eh31Time('2026-03-29 02:00'),null);
 assert.equal(b.eh31Time('2026-02-30 00:00'),null);
});
test('ordinary duplicate/out-of-order timestamps and malformed CSV fail without sorting',()=>{
 assert.throws(()=>b.eh31ReadHomeWizard(csv(['2026-01-01 00:00,0,0,0,0,','2026-01-01 00:00,1,0,0,0,'])),/dubbele/);
 assert.throws(()=>b.eh31ReadHomeWizard('time,time\n1,2'),/dubbele kolom/);
 assert.throws(()=>b.eh31ReadHomeWizard('"time'),/onafgesloten/);
 assert.throws(()=>b.eh31ReadHomeWizard('time,x\n1,2'),/HomeWizard/);
});
test('gaps, missing values and counter reset invalidate whole interval, not zero fill',()=>{
 const d=b.eh31ReadHomeWizard(csv(['2026-01-01 00:00,100,0,0,0,','2026-01-01 00:15,101,0,0,0,','2026-01-01 00:30,1,0,0,0,','2026-01-01 01:00,2,0,0,0,','2026-01-01 01:15,,0,0,0,','2026-01-01 01:30,3,0,0,0,']));
 assert.equal(d.resets,1);assert.equal(d.gaps,1);assert.equal(d.valid,1);near(d.imported,1);
 assert.equal(d.intervals[1].import,null);assert.equal(d.intervals[2].import,null);
});
test('daily history preserves calendar duration through DST and cannot enter battery replay',()=>{
 const d=b.eh31ReadHomeWizard(csv(['2026-10-24 00:00,0,0,0,0,','2026-10-25 00:00,10,0,1,0,','2026-10-26 00:00,20,0,2,0,']));
 assert.equal(d.resolution,'day');assert.equal(d.gaps,0);assert.equal(d.intervals[1].end-d.intervals[1].t,25*3600000);
 assert.equal(b.eh31ComparisonResults({_eh31History:d}),null);
 assert.equal(b.eh31SimulateSolar(d.intervals,profile,.3,.1).validMs,0);
});
test('full month/year coverage counts missing boundary periods and actual month length',()=>{
 const d=b.eh31ReadHomeWizard(csv(['2026-01-10 00:00,0,0,0,0,','2026-01-11 00:00,10,0,2,0,','2026-01-12 00:00,20,0,4,0,']));
 const s=b.eh31HistorySummary(d);near(s.months[0].coverage,2/31);near(s.years[0].coverage,2/365);
 assert.equal(s.yearWindow.bounded,false);
});
test('hand calculated energy and euro balance: one kWh solar shifted with no losses',()=>{
 const s=b.eh31SimulateSolar([row(0,0,1),row(1,1,0)],profile,.3,.1);
 near(s.charge,1);near(s.discharged,1);near(s.loss,0);near(s.endingSoc,0);near(s.periodSaving,.2);
 near(s.remainingImport,0);near(s.remainingExport,0);
});
test('81% roundtrip: 1 kWh in, .81 kWh delivered, .19 kWh loss',()=>{
 const s=b.eh31SimulateSolar([row(0,0,1),row(1,1,0)],{...profile,efficiency:81},.3,.1);
 near(s.charge,1);near(s.discharged,.81);near(s.loss,.19);near(s.endingSoc,0);near(s.periodSaving,.143);
});
test('standby is an explicit additional load; zero consumption has a negative battery benefit',()=>{
 const s=b.eh31SimulateSolar([row(0,0,0),row(1,0,0)],{...profile,standby:100},.3,.1);
 near(s.standbyKwh,.05);near(s.remainingImport,.05);near(s.netImportAvoided,-.05);near(s.periodSaving,-.015);
});
test('capacity and separate charge/discharge limits apply at quarter resolution',()=>{
 const s=b.eh31SimulateSolar([row(0,0,10),row(1,10,0)],{...profile,capacity:.2,chargeKw:.4,dischargeKw:.2},.3,.1);
 near(s.charge,.1);near(s.discharged,.05);near(s.endingSoc,.05);
});
test('no invented prices, free starting SOC or carry through missing interval',()=>{
 const empty=b.eh31SimulateSolar([row(0,1,0)],profile,null,null);
 near(empty.discharged,0);assert.equal(empty.periodSaving,null);
 const gap=b.eh31SimulateSolar([row(0,0,1),row(2,1,0)],profile,.3,.1);
 near(gap.gapLoss,1);near(gap.discharged,0);near(gap.periodSaving,-.1);
});
test('negative tariffs remain negative; same-interval export and import never both charge and discharge',()=>{
 const s=b.eh31SimulateSolar([row(0,1,1),row(1,1,0)],profile,-.2,-.1);
 near(s.charge,1);near(s.discharged,1);near(s.periodSaving,-.1);
});
test('unknown standby or invalid profile blocks result; blank remains distinct from zero',()=>{
 assert.equal(b.eh31ValidateProfile({...profile,standby:''}).technical,false);
 assert.equal(b.eh31ValidateProfile({...profile,efficiency:200}).technical,false);
 assert.equal(b.eh31ValidateProfile({...profile,annualCosts:''}).annualCosts,null);
 assert.equal(b.eh31ValidateProfile(profile).annualCosts,0);
 assert.equal(b.eh31SimulateSolar([row(0,0,1)],{...profile,standby:null},.3,.1),null);
});
test('profiles escape product labels and do not claim a payback/winner',()=>{
 const card={_eh31Settings:{profiles:[{...profile,name:'<img onerror=x>'},profile,profile],buy:null,sell:null}};
 const html=b.eh31CompareHtml(card);
 assert.match(html,/&lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<img onerror/);
 assert.match(html,/Geen historische dynamische tarieven/);assert.match(html,/niet verstuurd/);
});
module.exports=b;
test('independent energy reconciliation includes losses, standby and final SOC',()=>{
 const rows=Array.from({length:96},(_,i)=>row(i,i%7===0?1.7:.1,i%5===0?.8:0));
 const s=b.eh31SimulateSolar(rows,{...profile,efficiency:87,standby:12,chargeKw:1.2,dischargeKw:.7},.32,.07);
 near(s.charge-s.discharged,s.loss+s.endingSoc+s.gapLoss);
 near((s.remainingImport-s.remainingExport)-(s.imported-s.exported),s.standbyKwh+s.charge-s.discharged);
 near(s.periodSaving,(s.imported-s.remainingImport)*.32-(s.exported-s.remainingExport)*.07);
});
test('a fully bounded leap calendar year has 100% coverage and no annualisation of a partial year',()=>{
 const lines=[];let count=0;
 const wall=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let at=Date.parse('2023-12-31T23:00Z');at<=Date.parse('2024-12-31T23:00Z');at+=3600000){lines.push(wall.format(new Date(at))+','+(count++)+',0,0,0,');}
 const d=b.eh31ReadHomeWizard(csv(lines)),s=b.eh31HistorySummary(d);
 assert.equal(s.yearWindow.bounded,true);near(s.yearWindow.coverage,1);near(s.yearWindow.imported,8784);
 d.summary=s;const card={_eh31History:d,_eh31Settings:{profiles:[profile,profile,profile],buy:.3,sell:.1}};
 assert.equal(b.eh31ComparisonResults(card).fullYear,true);
 const shorter={...d,first:d.first+3600000};shorter.summary=b.eh31HistorySummary(shorter);
 assert.equal(b.eh31ComparisonResults({...card,_eh31History:shorter,_eh31Cache:null}).fullYear,false);
});
