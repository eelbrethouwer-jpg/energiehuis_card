'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class EnergiehuisCard{_render(){}}
const ctx=vm.createContext({EnergiehuisCard,Date,Math,Map,Set,URL,Promise,setTimeout,clearTimeout});
vm.runInContext(['00-foundation.js','01-history-analytics.js','16-live-cockpit.js','17-live-immersive.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src/legacy',f),'utf8')).join('\n')+';globalThis.plan=ehImmPlanningModel;globalThis.bars=ehImmQuarterBars;',ctx);
const now=new Date('2026-11-12T21:07:00+01:00'),start=Date.parse('2026-11-12T21:00:00+01:00');
const q=prices=>prices.map((p,i)=>({t:new Date(start+i*900000).toISOString(),p}));
function hass(strategy='Goedkoopste kwartieren',target=80,needed=2,threshold=.25){return {states:{
 'input_select.cupra_prijsstrategie':{state:strategy},'input_number.cupra_gewenste_soc':{state:String(target)},
 'sensor.cupra_actuele_laadgrens':{state:String(threshold)},'sensor.cupra_slim_effectieve_vertrektijd':{state:'2026-11-13T07:00:00+01:00'},
 'sensor.cupra_slim_minimaal_bekende_kwartieren_nodig':{state:String(needed)}
}};}
const planned=m=>Array.from(m.items.filter(x=>x.planned),x=>x.p);
test('HA-planning: met SOC-doel dezelfde N goedkoopste kwartieren, inclusief huidig kwartier en negatieve prijs',()=>{
 const m=ctx.plan(q([.4,.2,-.05,.3]),now,hass());assert.equal(m.available,true);assert.deepEqual(planned(m),[.2,-.05]);assert.equal(m.cur.p,.4);assert.equal(m.limit,null);assert.equal(m.selected,2);
 const svg=ctx.bars(m);assert.equal((svg.match(/class="planned/g)||[]).length,2);assert.equal((svg.match(/class="waiting/g)||[]).length,2);
});
test('HA-planning: alle drie grensstrategieën gebruiken de bestaande prijsgrens, ook exact op de grens',()=>{
 for(const strategy of ['Vast','Onder daggemiddelde','Gemiddeld - marge']){
  const m=ctx.plan(q([.25,.26,-.1,.2]),now,hass(strategy));assert.deepEqual(planned(m),[.25,-.1,.2]);assert.equal(m.limit,.25);assert.match(ctx.bars(m),/class="limit"/);
 }
});
test('HA-planning: zonder SOC-doel 25 procent per lokale dag en minstens één kwartier per dag',()=>{
 const old=process.env.TZ;process.env.TZ='Europe/Amsterdam';try{
  const points=q([.4,.3,.2,.1]);points.push({t:'2026-11-13T01:00:00+01:00',p:.5},{t:'2026-11-13T02:00:00+01:00',p:.6});
  const m=ctx.plan(points,now,hass('Goedkoopste kwartieren',0));assert.deepEqual(planned(m),[.1,.5]);assert.equal(m.departure,null);
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('HA-planning: tot vertrek en maximaal 36 uur, geen verlopen of ongeldige kwartieren',()=>{
 const h=hass('Vast',80),points=q([.2,.3]);h.states['sensor.cupra_slim_effectieve_vertrektijd'].state='2026-11-12T21:30:00+01:00';
 points.push({t:'2026-11-12T21:30:00+01:00',p:.01},{t:'2026-11-12T20:00:00+01:00',p:.01},{t:'kapot',p:.01},{t:'2026-11-12T21:10:00+01:00',p:null});
 const m=ctx.plan(points,now,h);assert.equal(m.known,2);assert.equal(m.slots,2);assert.equal(m.nowIdx,0);
 h.states['input_number.cupra_gewenste_soc'].state='0';points.push({t:new Date(+now+36*3600000).toISOString(),p:.01});assert.equal(ctx.plan(points,now,h).known,3,'vertrek geldt niet zonder SOC-doel; 36u-eindpunt blijft uitgesloten');
});
test('HA-planning: onbekende helpers zijn geen nul; geldige nul benodigde kwartieren selecteert niets',()=>{
 for(const id of ['input_select.cupra_prijsstrategie','input_number.cupra_gewenste_soc','sensor.cupra_slim_effectieve_vertrektijd','sensor.cupra_slim_minimaal_bekende_kwartieren_nodig']){
  const h=hass();h.states[id].state='unavailable';assert.equal(ctx.plan(q([.1,.2]),now,h).available,false,id);
 }
 const h=hass('Vast');delete h.states['sensor.cupra_actuele_laadgrens'];assert.equal(ctx.plan(q([.1]),now,h).available,false);
 assert.equal(ctx.plan(q([.1,.2]),now,hass('Goedkoopste kwartieren',80,0)).selected,0);
 const past=hass();past.states['sensor.cupra_slim_effectieve_vertrektijd'].state='2026-11-12T20:00:00+01:00';assert.equal(ctx.plan(q([.1]),now,past).available,false);
});
test('HA-planning: helpers veranderen selectie zonder nieuwe prijzen; gelijke prijzen behouden tijdvolgorde',()=>{
 const points=q([.2,.2,.2]),h=hass();assert.deepEqual(Array.from(ctx.plan(points,now,h).items,x=>x.planned),[true,true,false]);
 h.states['sensor.cupra_slim_minimaal_bekende_kwartieren_nodig'].state='1';assert.deepEqual(Array.from(ctx.plan(points,now,h).items,x=>x.planned),[true,false,false]);
});
