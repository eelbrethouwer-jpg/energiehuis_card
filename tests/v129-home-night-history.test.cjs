'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..','src','legacy');
const code=['00-foundation.js','01-history-analytics.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const C=vm.createContext({Date,Intl,Map,Set,Math,Number,Array,Object,Promise,console});
vm.runInContext(code+'\n;globalThis.api={samples:ehSamplesFromHistory,energy:ehHomeHistoryEnergy,limits:ehPeriodLimits};',C);
const {samples,energy,limits}=C.api;
const IDS=['sensor.pv','sensor.house','sensor.grid','sensor.ev','sun.sun'];
const at=(d,s,unit='W')=>({s,lu:new Date(d).toISOString(),a:{unit_of_measurement:unit}});
const fixedSamples=(history,ids,h,now,options={})=>samples(history,ids,h,now,{
 start:Date.parse('2026-11-13T00:00:00+01:00'),
 end:now.getTime(),
 dayEnd:Date.parse('2026-11-14T00:00:00+01:00'),
 ...options
});
function fixture(now='2026-11-13T09:00:00+01:00'){
 const start='2026-11-12T23:45:00+01:00';
 const h={states:Object.fromEntries(IDS.map(id=>[id,{attributes:{unit_of_measurement:'W'}}]))};
 const history=[
 [at(start,'unavailable'),at('2026-11-13T08:10:00+01:00',600)],
 [at(start,'unknown'),at('2026-11-13T08:10:00+01:00',1000)],
 [at(start,800),at('2026-11-13T02:00:00+01:00',900)],
 [at(start,0)],
 [at(start,'below_horizon'),at('2026-11-13T08:00:00+01:00','above_horizon')]
 ];
 return {history,h,now:new Date(now)};
}
test('nacht: GoodWe unavailable + huis-template unknown, maar P1/Alfen en sun.sun bewijzen een berekenbaar huisvermogen',()=>{
 const {history,h,now}=fixture(),r=fixedSamples(history,IDS,h,now);
 assert.ok(r&&r.samples.length>100);
 const atHour=hh=>r.samples.find(p=>Math.abs(p.t-new Date('2026-11-13T'+hh+':00:00+01:00').getTime())<150000);
 const night=atHour('03');assert.equal(night['sensor.house'],900);assert.equal(night.__ehNightSolar,true);
 const dusk=atHour('07');assert.equal(dusk['sensor.house'],900);
 const unproven=atHour('08');assert.equal(unproven['sensor.house'],null,'na zonsopkomst geen nul zonder PV-bewijs');
 const day=atHour('09');assert.equal(day['sensor.house'],1000);
 assert.ok(energy(r.samples.map(p=>({t:p.t,v:p['sensor.house'],derived:p.__ehHouseDerived,nightSolar:p.__ehNightSolar})),r.start,r.cutoff)?.kwh>0);
});
test('zonder sun.sun: ontbrekende PV is onbekend, nooit automatisch nul',()=>{
 const {history,h,now}=fixture();
 const ids=IDS.slice(0,4);
 const r=fixedSamples(history.slice(0,4),ids,h,now);
 assert.equal(r.samples[20]['sensor.house'],null);
});
test('een overgang naar unknown verbreekt de historische lijn en wordt niet eindeloos doorgetrokken',()=>{
 const {history,h,now}=fixture();
 history[2].push(at('2026-11-13T04:00:00+01:00','unavailable'));
 const r=fixedSamples(history,IDS,h,now);
 const p=r.samples.find(p=>p.t>=new Date('2026-11-13T05:00:00+01:00').getTime());
 assert.equal(p['sensor.grid'],null);assert.equal(p['sensor.house'],null);
});
test('afgeleid huisvermogen gebruikt P1-tekenrichting en verwerpt onmogelijke negatieve waarden',()=>{
 const {history,h,now}=fixture();
 history[2][0]=at('2026-11-12T23:45:00+01:00',-800);
 const r=fixedSamples(history,IDS,h,now,{p1Sign:'export_positive'});
 assert.ok(r.samples.some(p=>p.__ehNightSolar&&p['sensor.house']===800));
 const rBad=fixedSamples(history,IDS,h,now,{p1Sign:'import_positive'});
 assert.equal(rBad.samples[10]['sensor.house'],null);
});
test('Gisteren met lokale daggrenzen en beginstand van vóór middernacht',()=>{
 const {h}=fixture();
 const from=Date.parse('2026-11-12T00:00:00+01:00'),to=Date.parse('2026-11-13T00:00:00+01:00');
 const before='2026-11-11T23:40:00+01:00';
 const hist=[[at(before,'unavailable')],[at(before,'unknown')],[at(before,500)],[at(before,0)],[at(before,'below_horizon')]];
 const r=samples(hist,IDS,h,new Date(to),{start:from,end:to,dayEnd:to});
 assert.equal(r.start,new Date('2026-11-12T00:00:00+01:00').getTime());
 assert.equal(r.cutoff,new Date('2026-11-13T00:00:00+01:00').getTime());
 assert.equal(r.samples[0]['sensor.house'],500);
});
test('geen discontinuiteits- of onbekende-intervallen optellen: totaal wordt onvolledig',()=>{
 const t=Date.parse('2026-11-13T00:00:00+01:00'),pts=[{t,v:1000},{t:t+300000,v:1000},{t:t+600000,v:null},{t:t+900000,v:1000},{t:t+1200000,v:1000}];
 const r=energy(pts,t,t+1200000);
 assert.equal(r.complete,false);assert.equal(r.covered,600000);assert.ok(Math.abs(r.kwh-1/6)<1e-8);
});
test('DST Nederland: werkelijke dag duurt 23 of 25 uur en heeft correcte lokale grenzen',()=>{
 const old=process.env.TZ;process.env.TZ='Europe/Amsterdam';
 try{
  for(const [day,hours] of [['2026-03-29',23],['2026-10-25',25]]){
   const now=new Date(day+'T12:00:00+01:00'); // alleen datum wordt hier gebruikt
   const dayDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
   const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
   assert.equal((next-dayDate)/3600000,hours,day);
  }
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
