'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){const listeners={};return this.shadowRoot={listeners,addEventListener(type,fn){(listeners[type]??=[]).push(fn);}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.REVIEW={EnergiehuisCard,EH_DEFAULTS,eh17Plan,eh23ChargePowerSuggestion,eh23ChargePowerHtml};',ctx);
const {EnergiehuisCard,EH_DEFAULTS}=ctx.REVIEW;
function card(){return Object.assign(Object.create(EnergiehuisCard.prototype),{_view:'charge',_targetSoc:80,_simNeed:20.7,_simPower:3.7,_chargeMode:'slim',_departure:new Date(Date.now()+86400000).toISOString(),_eh17SessionsLoading:true});}
test('laadkostentekst toont het ingestelde effectieve rendement en rekent laadverlies mee',()=>{
 for(const [setting,effective] of [[undefined,90],[.8,80],[.2,50],[1.2,100]]){
  const config={...EH_DEFAULTS,ev_charge_efficiency:setting};
  const html=card()._cupraHtml({states:{}},config);
  assert.match(html,new RegExp('Inclusief laadverlies \\(rendement '+effective+'%\\)'));
  assert.doesNotMatch(html,/exclusief laadverlies/);
 }
});

const {eh23ChargePowerSuggestion:suggest,eh23ChargePowerHtml:powerHtml}=ctx.REVIEW;
const liveW=(n)=>({state:String(n),last_updated:new Date().toISOString(),attributes:{unit_of_measurement:'W'}});
const session=(kw,hours=2,extra={})=>({start:1700000000000,end:1700000000000+hours*3600000,kwh:kw*hours,estimated:false,...extra});
test('sessiemediaan vereist standaard drie geschikte gemeten sessies',()=>{
 assert.equal(suggest([]),null);assert.equal(suggest([session(4),session(6)]),null);
 const rows=[session(4),session(6),session(8)];
 const copy=JSON.stringify(rows);const result=suggest(rows);
 assert.equal(result.kw,6);assert.equal(result.count,3);assert.equal(JSON.stringify(rows),copy);
 assert.equal(suggest(rows.slice(0,2),{minSessions:2}).kw,5);
});
test('geschatte, korte, kleine en ongeldige sessies tellen niet mee',()=>{
 const valid=[session(5),session(6)];
 for(const invalid of [session(8,2,{estimated:true}),session(8,.25),session(2,2),session(5,0),session(5,2,{end:null}),null])assert.equal(suggest([...valid,invalid]),null);
 const boundary=[session(10,.5),session(10,.5),session(10,.5)];
 assert.equal(suggest(boundary).kw,10);
 assert.equal(suggest(null),null);assert.equal(suggest(boundary,{minSessions:0}),null);
});
test('even aantal sessies gebruikt het gemiddelde van de twee middelste vermogens',()=>{
 const result=suggest([session(8),session(3),session(5),session(7)]);
 assert.equal(result.kw,6);assert.equal(result.count,4);
});
test('suggesties tonen Alfen eerst en de plannerbegrenzing, zonder automatische invoer',()=>{
 const c=card();c._eh17Sessions={at:Date.now(),sessions:[session(6),session(7),session(8)]};
 const conf={...EH_DEFAULTS},h={states:{[conf.laden]:liveW(7360)}};
 const now=new Date(),start=Math.ceil(now.getTime()/3600000)*3600000;
 const prices=Array.from({length:12},(_,i)=>({t:new Date(start+i*3600000).toISOString(),p:.2}));
 const opts={fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:4000,efficiency:.9};
 const html=powerHtml(c,h,conf,prices,20.7,opts);
 assert.ok(html.indexOf('data-eh23-power="current"')<html.indexOf('data-eh23-power="history"'));
 const plan=ctx.REVIEW.eh17Plan(prices,now,c._departure,20.7,7.36,'direct',opts);
 assert.ok(Math.abs(plan.allowedKw-4.74)<1e-10);
 assert.match(html,/Aansluitgrens: 4,74 kW/);assert.match(html,/Mediaan uit 3/);
 assert.match(powerHtml(c,h,conf,[],20.7,opts),/Aansluitgrens: 4,74 kW/);
 assert.equal((html.match(/Aansluitgrens: 4,74 kW/g)||[]).length,1,'Two capped suggestions share one limit note');
 assert.equal(c._simPower,3.7);
 h.states[conf.laden].state='0';
 assert.match(powerHtml(c,h,conf,prices,20.7,opts),/data-eh23-power="current" aria-pressed="false" disabled/);
 c._eh17Sessions.sessions=[session(6),session(7),session(8,2,{estimated:true})];
 assert.doesNotMatch(powerHtml(c,h,conf,prices,20.7,opts),/data-eh23-power="history"/);
});
test('huisbelasting 9000 W benoemt minder dan 6 A zonder een geldig plannerresultaat',()=>{
 const c=card(),conf={...EH_DEFAULTS};
 c._eh17Sessions={at:Date.now(),sessions:[session(6),session(7),session(8)]};
 const h={states:{[conf.laden]:liveW(7360)}};
 const html=powerHtml(c,h,conf,[],20.7,{fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:9000});
 assert.match(html,/Minder dan 6 A beschikbaar bij de gebruikte huisbelasting/);
 assert.equal((html.match(/Minder dan 6 A/g)||[]).length,1);
 assert.doesNotMatch(html,/Vermogensgrens zichtbaar zodra er een geldig laadplan is/);
});

test('limietmelding werkt zonder tarieven, met ongeldige prijseenheid en bij verstreken vertrektijd',()=>{
 const c=card(),conf={...EH_DEFAULTS};
 const h={states:{[conf.laden]:liveW(7360)}};
 const opts={fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:4000};
 const invalidPrices=[{t:new Date(Math.ceil(Date.now()/3600000)*3600000).toISOString(),p:41}];
 for(const prices of [[],invalidPrices]){
  const html=powerHtml(c,h,conf,prices,20.7,opts);
  assert.match(html,/Aansluitgrens: 4,74 kW/);
  assert.doesNotMatch(html,/Vermogensgrens zichtbaar zodra er een geldig laadplan is/);
 }
 c._departure=new Date(Date.now()-3600000).toISOString();
 assert.match(powerHtml(c,h,conf,[],20.7,opts),/Aansluitgrens: 4,74 kW/);
});

test('onbekende huisbelasting meldt expliciet aanname 2000 W bij 7,2 kW',()=>{
 const c=card(),conf={...EH_DEFAULTS};
 const h={states:{[conf.laden]:liveW(7200)}};
 const opts={fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:null};
 const html=powerHtml(c,h,conf,[],20.7,opts);
 assert.match(html,/Aansluitgrens: 6,74 kW/);
 assert.match(html,/aanname 2000 W/);
 assert.equal((html.match(/aanname 2000 W/g)||[]).length,1);
 assert.doesNotMatch(powerHtml(c,h,conf,[],20.7,{...opts,houseW:0}),/aanname 2000 W/);
});

test('handmatige 3,7 kW is niet begrensd ondanks hogere vermogenssuggesties',()=>{
 const c=card();c._simPower=3.7;
 const conf={...EH_DEFAULTS},h={states:{[conf.laden]:liveW(7360)}};
 const opts={fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:4000};
 const html=powerHtml(c,h,conf,[],20.7,opts);
 assert.match(html,/Aansluitgrens: 4,74 kW/);
 assert.match(html,/Hogere keuzes rekent de simulatie tot dit vermogen/);
 assert.match(html,/Simulatiegrens; Alfen Active Load Balancing bepaalt het werkelijke vermogen/);
 assert.doesNotMatch(html,/Voor dit scenario begrensd/);
 assert.equal(c._simPower,3.7);
});

test('een klik verandert uitsluitend het tijdelijke scenario en leest de actuele bron opnieuw',()=>{
 const c=new EnergiehuisCard();c.config={...EH_DEFAULTS};c._schedule=()=>{};
 let calls=0;c._hass={states:{[c.config.laden]:liveW(4200)},callService(){calls++;}};
 c._simPower=3.7;c._eh17Sessions={sessions:[session(5),session(6),session(7)]};
 const before=JSON.stringify(c.config);
 const click=kind=>{const button={disabled:false,dataset:{eh23Power:kind}};const event={target:{closest:selector=>selector==='[data-eh23-power]'?button:null}};for(const fn of c.shadowRoot.listeners.click)fn(event);};
 click('current');assert.equal(c._simPower,4.2);
 c._hass.states[c.config.laden].state='0';click('current');assert.equal(c._simPower,4.2);
 click('history');assert.equal(c._simPower,6);
 assert.equal(JSON.stringify(c.config),before);assert.equal(calls,0);
});
test('tijdvakken benoemen geen actieve laadtijd en behouden de plannerduur',()=>{
 const c=card(),conf={...EH_DEFAULTS};
 const now=new Date(),start=Math.floor(now.getTime()/3600000)*3600000;
 const forecast=Array.from({length:24},(_,i)=>({start:new Date(start+i*3600000).toISOString(),price:.25}));
 const h={states:{[conf.prijs]:{state:'.25',attributes:{unit_of_measurement:'€/kWh',forecast}}}};
 const html=c._cupraHtml(h,conf);
 assert.match(html,/tijdvakken: [0-9,]+ uur/);assert.match(html,/geen berekende actieve laadtijd/);
 assert.match(html,/PV-prognose ontbreekt/);assert.doesNotMatch(html,/uurvenster/);
});

test('kort deeluur blijft alleen een rekenvenster; geen verborgen minimumduur',()=>{
 const p=ctx.REVIEW.eh17Plan([{t:'2026-11-08T06:00:00Z',p:.25}],new Date('2026-11-08T06:57:00Z'),'2026-11-08T07:00:00Z',20.7,3.7,'slim',{houseW:0,efficiency:.9});
 assert.equal(p.error,null);assert.equal(p.selected.length,1);
 assert.equal(p.selected[0].slotEnd-p.selected[0].slotStart,3*60000);
 assert.ok(Math.abs(p.totalKwh-.05*3.7*.9)<1e-10);
});
