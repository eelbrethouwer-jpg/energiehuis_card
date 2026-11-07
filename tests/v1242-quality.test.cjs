'use strict';
// Alleen lees-/simulatiepaden: geen echte HA-verbinding of laadserviceaanroepen.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{
 attachShadow(){const listeners={};return this.shadowRoot={listeners,addEventListener(type,fn){(listeners[type]??=[]).push(fn);}};}
}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.REVIEW24={eh24ChargeReading,eh24ChargeLimit,eh23ChargePowerHtml,eh17Plan,EnergiehuisCard,EH_DEFAULTS};',ctx);
const {eh24ChargeReading:read,eh24ChargeLimit:limit,eh23ChargePowerHtml:html,eh17Plan:planner,EnergiehuisCard,EH_DEFAULTS}=ctx.REVIEW24;
const id=EH_DEFAULTS.huis;
const sensor=(v,stamp=new Date().toISOString(),unit='W')=>({state:String(v),last_updated:stamp,attributes:{unit_of_measurement:unit}});
const hass=s=>({states:{[id]:s}});
const card=()=>Object.assign(Object.create(EnergiehuisCard.prototype),{_view:'charge',_targetSoc:80,_simNeed:20.7,_simPower:3.7,_chargeMode:'slim',_departure:new Date(Date.now()+86400000).toISOString(),_eh17SessionsLoading:true});

test('kwaliteitscontrole waarde, echte nul, kW-conversie en ouderdom',()=>{
 const now=Date.parse('2026-11-07T12:00:00Z');
 assert.equal(read(hass(sensor(4000,'2026-11-07T11:59:00Z')),id,{now}).watts,4000);
 assert.equal(read(hass(sensor(0,'2026-11-07T11:59:00Z')),id,{now}).watts,0);
 assert.equal(read(hass(sensor(3,'2026-11-07T11:59:00Z','kW')),id,{now}).watts,3000);
 assert.equal(read(hass(sensor(4000,'2026-11-07T11:50:00Z')),id,{now}).quality,'measured');
 assert.equal(read(hass(sensor(4000,'2026-11-07T11:49:59Z')),id,{now}).quality,'stale');
 assert.equal(read(hass(sensor(4000,'2026-11-07T12:01:01Z')),id,{now}).quality,'future');
 assert.equal(read(hass(sensor(4000,'2026-11-07T12:00:30Z')),id,{now}).quality,'measured');
});
test('ontbrekende, negatieve, ongedateerde en ongeldige huiswaarden leiden tot aanname',()=>{
 assert.equal(read({states:{}},id).quality,'missing');
 assert.equal(read(hass(sensor(-500)),id).quality,'negative');
 assert.equal(read(hass({state:'4000',attributes:{unit_of_measurement:'W'}}),id).quality,'undated');
 assert.equal(read(hass(sensor('unavailable')),id).quality,'invalid');
 assert.equal(read(hass(sensor(4000,undefined,'A')),id).quality,'invalid');
 for(const value of [null,undefined,'unknown','unavailable'])if(value!==null){
  assert.equal(read(hass(sensor(value)),id).watts,null);
 }
});
test('laadscherm toont meetstatus, fallback en Alfenveiligheid zonder laden te starten',()=>{
 const c=card(),conf={...EH_DEFAULTS};
 const h={states:{[conf.huis]:sensor(-500),[conf.laden]:sensor(7200)}};
 let view=c._cupraHtml(h,conf);
 assert.match(view,/Huisbelasting negatief; niet gebruikt \(aanname 2000 W\)/);
 assert.match(view,/Aansluitgrens: 6,74 kW/);
 assert.match(view,/Alfen Active Load Balancing bepaalt het werkelijke vermogen/);
 assert.match(view,/aria-pressed="false"/);
 h.states[conf.huis]=sensor(4000,new Date(Date.now()-11*60000).toISOString());
 view=c._cupraHtml(h,conf);
 assert.match(view,/Huisbelasting verouderd \(aanname 2000 W\)/);
 h.states[conf.huis]=sensor(0);
 view=c._cupraHtml(h,conf);
 assert.doesNotMatch(view,/aanname 2000 W/);
 assert.match(view,/Aansluitgrens: 7,36 kW/);
 h.states[conf.laden]=sensor(7200,new Date(Date.now()-3*60000).toISOString());
 view=c._cupraHtml(h,conf);
 assert.match(view,/Alfen-meting is verouderd/);
 assert.match(view,/data-eh23-power="current" aria-pressed="false" disabled/);
});
test('geklikte Alfenkeuze controleert sensorversheid opnieuw; handmatige invoer blijft leidend',()=>{
 const c=new EnergiehuisCard(),conf={...EH_DEFAULTS};c.config=conf;c._schedule=()=>{};
 let calls=0;
 c._hass={states:{[conf.laden]:sensor(4200)},callService(){calls++;}};
 c._simPower=3.7;
 const click=kind=>{
  const el={disabled:false,dataset:{eh23Power:kind}};
  for(const cb of c.shadowRoot.listeners.click)cb({target:{closest:selector=>selector==='[data-eh23-power]'?el:null}});
 };
 click('current');
 assert.equal(c._simPower,4.2);assert.equal(c._eh24PowerChoice,'current');
 c._hass.states[conf.laden].last_updated=new Date(Date.now()-3*60000).toISOString();
 c._hass.states[conf.laden].state='6800';
 click('current');assert.equal(c._simPower,4.2,'Verouderde sensor mag gekozen vermogen niet overschrijven');
 const inp={value:'5.5',matches:selector=>selector==='[data-eh-kw]'};
 for(const cb of c.shadowRoot.listeners.change)cb({target:inp});
 assert.equal(c._simPower,5.5);assert.equal(c._eh24PowerChoice,null);
 assert.equal(calls,0);
});
test('pariteit UI-limiet en eh17Plan over 20.160 grensgevallen',()=>{
 const now=new Date('2030-01-01T00:00:00Z'),departure='2030-01-01T01:00:00Z';
 const prices=[{t:'2030-01-01T00:00:00Z',p:.2}];
 const fuses=[10,16,25,32,40,50,63],chargers=[5,6,10,16,20,25,32,40];
 const reserves=[-1,0,1,2,4,8],houses=[null,-500,0,500,1000,2000,4000,6000,9000,12000];
 const requested=[1.4,2.3,3.7,5.5,6.6,7.4];
 let count=0,divergence=0;
 for(const fuseAmp of fuses)for(const chargerAmp of chargers)for(const reserveAmp of reserves)
 for(const houseW of houses)for(const power of requested){
  const opts={fuseAmp,chargerAmp,reserveAmp,houseW,efficiency:.9};
  const ui=limit(opts),actual=planner(prices,now,departure,1,power,'direct',opts);
  if(!ui.valid){
   if(!/veiligheidsgrenzen/i.test(actual.error||''))divergence++;
  }else if(ui.maxKw<1.38){
   if(!/Minder dan 6 A/.test(actual.error||''))divergence++;
  }else if(actual.error||Math.abs(actual.allowedKw-Math.min(power,ui.maxKw))>1e-9){
   divergence++;
  }
  count++;
 }
 assert.equal(count,20160);assert.equal(divergence,0,'UI-limiet wijkt af van eh17Plan');
});
