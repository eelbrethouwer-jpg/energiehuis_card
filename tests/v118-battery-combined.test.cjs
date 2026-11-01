'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.CHART={eh24BatteryWindows,eh20Limits,eh24BatteryBuckets,eh24AreaPath,eh24SocPath,eh23BatteryFlowChart,eh20Simulate,eh21BatteryProfile};',ctx);
const {eh24BatteryWindows,eh20Limits,eh24BatteryBuckets,eh23BatteryFlowChart,eh20Simulate,eh21BatteryProfile}=ctx.CHART;
const base=Date.parse('2026-10-01T00:00:00Z');
const hour=(i,imp,exp,price=.25)=>({t:base+i*3600000,end:base+(i+1)*3600000,import:imp,export:exp,price});
const rows=Array.from({length:720},(_,i)=>hour(i,i%24>=12?2:0,i%24<12?3:0));
const sim=(data=rows)=>eh20Simulate(data,10,.81,3,'solar',.25,.08,eh21BatteryProfile(10,{}));
const fNum=(a,b)=>Math.abs(a-b)<1e-7;

test('30 kalenderdagen batterijhistorie is niet langer tot 400 uur afgekapt, inclusief DST',()=>{
 const ordinary=eh24BatteryWindows({from:new Date('2026-08-01T00:00:00Z'),to:new Date('2026-08-31T00:00:00Z')});
 assert.equal(ordinary.length,720);
 assert.equal(ordinary[0].t,Date.parse('2026-08-01T00:00:00Z'));
 assert.equal(ordinary.at(-1).end,Date.parse('2026-08-31T00:00:00Z'));
 const dst=eh24BatteryWindows(eh20Limits(new Date(2026,10,1,12),30));
 assert.ok(dst.length>=719&&dst.length<=721);
 assert.ok(dst.length>400);
});
test('HomeWizard-stijl: paars boven nul, groen onder nul en witte SOC-stippellijn in één grafiek',()=>{
 const html=eh23BatteryFlowChart({},sim(),rows);
 assert.match(html,/class="eh23-flow-svg eh24-combined-svg"/);
 assert.match(html,/class="eh24-charge"/);
 assert.match(html,/class="eh24-discharge"/);
 assert.match(html,/class="eh24-solar"/);
 assert.match(html,/stroke-dasharray="7 5"/);
 assert.match(html,/100%/);assert.match(html,/0%/);
 assert.match(html,/Laden uit zon/);
 assert.match(html,/Gesimuleerd, niet fysiek gemeten/);
 assert.match(html,/Dag = kWh per uur/);
 assert.match(html,/data-eh24-view="week"/);
 assert.match(html,/data-eh24-view="month"/);
 assert.match(html,/<button type="button" disabled title="Jaarhistorie/);
});
test('dag laat echte uurblokken zien en navigeert zonder de simulatiereeks te veranderen',()=>{
 const data=rows.slice(0,72),s=sim(data);
 const d=eh24BatteryBuckets({},s,data,'day');
 assert.equal(d.buckets.length,24);
 assert.equal(d.selected.index,2);
 assert.deepEqual(Array.from(d.buckets,x=>x.hour),Array.from({length:24},(_,i)=>48+i));
 assert.ok(d.buckets.every(x=>x.valid&&Number.isFinite(x.soc)));
});
test('week is 7 dagtotalen en maand maximaal 30 dagtotalen, nooit kunstmatige kwartieren',()=>{
 const s=sim(),day=eh24BatteryBuckets({},s,rows,'day');
 const week=eh24BatteryBuckets({},s,rows,'week');
 const month=eh24BatteryBuckets({},s,rows,'month');
 assert.equal(day.buckets.length,24);
 assert.equal(week.buckets.length,7);assert.equal(month.buckets.length,30);
 const last=month.buckets[29],lastDay=day.buckets;
 assert.ok(fNum(last.pv,lastDay.reduce((t,b)=>t+b.pv,0)));
 assert.ok(fNum(last.grid,lastDay.reduce((t,b)=>t+b.grid,0)));
 assert.ok(fNum(last.out,lastDay.reduce((t,b)=>t+b.out,0)));
 assert.ok(fNum(last.soc,lastDay.at(-1).soc));
 assert.equal(month.buckets.reduce((t,b)=>t+b.missingHours,0),0);
});
test('meetgaten: geen nulwaarde uitgevonden en SOC-lijn wordt onderbroken',()=>{
 const broken=rows.map((r,i)=>i===706?{...r,import:null,export:null}:r);
 const simulation=sim(broken),day=eh24BatteryBuckets({},simulation,broken,'day');
 assert.equal(day.buckets[10].valid,false);
 assert.equal(day.buckets[10].soc,null);
 const html=eh23BatteryFlowChart({},simulation,broken);
 assert.match(html,/onvolledige meetpunten/);
 assert.match(html,/onvolledige uurdata/);
 assert.match(html,/Geen data/);
 const month=eh24BatteryBuckets({},simulation,broken,'month');
 assert.equal(month.buckets.at(-1).missing,true);
});
test('week/maand bereikbaar; dagdrilldown gebruikt bestaande uurselectie en schrijft niets naar Home Assistant',()=>{
 const week=eh23BatteryFlowChart({_eh24GraphPeriod:'week'},sim(),rows);
 const month=eh23BatteryFlowChart({_eh24GraphPeriod:'month'},sim(),rows);
 assert.match(week,/data-eh24-day="29"/);
 assert.match(month,/data-eh24-day="0"/);
 assert.doesNotMatch(week,/data-eh23-hour="719"/);
 assert.match(source,/this\._eh24GraphPeriod='day'/);
 assert.doesNotMatch(source,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
});
