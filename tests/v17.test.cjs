'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}}}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(src+'\n;globalThis.TEST={eh17Plan,eh17Health,eh17Hash,eh17ResetState,eh17BatteryFromStats,eh17SessionsFromHistory,eh17N,EnergiehuisCard};',context);
const {eh17Plan,eh17ResetState,eh17Hash,EnergiehuisCard}=context.TEST;
const hour=i=>new Date(Date.UTC(2026,9,22,i)).toISOString();
const prices=[{t:hour(0),p:.29},{t:hour(1),p:.12},{t:hour(2),p:.22},{t:hour(3),p:.09}];
const now=new Date('2026-10-21T22:15:00Z'),departure='2026-10-22T05:00:00Z';
test('v1.7.0 versie en bestaande custom card behouden',()=>{
  assert.match(src,/const EH_VERSION = '1.7.0'/);
  assert.equal(typeof registry.get('energiehuis-card'),'function');
});
test('Slim selecteert goedkope volledige uren; Direct selecteert chronologisch',()=>{
  const opts={houseW:1000,efficiency:1};
  const direct=eh17Plan(prices,now,departure,6,3.7,'direct',opts);
  const slim=eh17Plan(prices,now,departure,6,3.7,'slim',opts);
  assert.equal(direct.error,null);assert.equal(slim.error,null);
  assert.equal(direct.totalKwh,6);assert.equal(slim.totalKwh,6);
  assert.ok(slim.cost<direct.cost);
  assert.equal(direct.selected[0].t,Date.parse(hour(0)));
  assert.equal(slim.selected[0].slotStart%3600000,0);
  for(const v of slim.selected)assert.equal(v.slotEnd-v.slotStart,3600000);
});
test('Geen onvolledige huidige uren of fictieve prijzen',()=>{
  const p=eh17Plan([{t:hour(0),p:.1}],new Date('2026-10-22T00:25:00Z'),departure,4,3.7,'slim');
  assert.ok(p.error);assert.equal(p.totalKwh,0);
});
test('1x40 A reserve en huislast beperken theoretisch vermogen',()=>{
  const p=eh17Plan(prices,now,departure,5,7.4,'direct',{fuseAmp:40,chargerAmp:32,reserveAmp:2,houseW:4000});
  assert.ok(p.allowedKw<5);
  assert.ok(p.allowedKw>=1.38);
});
test('Zon vereist zonneforecast met voldoende 6A vermogen',()=>{
  const without=eh17Plan(prices,now,departure,2,3.7,'sun',{houseW:800});
  assert.ok(without.error);
  const withPV=eh17Plan(prices,now,departure,2,3.7,'sun',{houseW:800,solar:[{t:Date.parse(hour(1)),pv:4}],exportCompensation:.08});
  assert.equal(withPV.error,null);
  assert.ok(withPV.totalKwh>1);
});
test('Nulmeting-helper leest leeg; ongeldig formaat blokkeert',()=>{
  const c={reset_store:'input_text.energiehuis_reset_baselines'};
  assert.equal(eh17ResetState({states:{[c.reset_store]:{state:''}}},c).error,null);
  assert.ok(eh17ResetState({states:{[c.reset_store]:{state:'kapot'}}},c).error);
  assert.ok(eh17ResetState({states:{}},c).error);
});
test('Reset zonder expliciete confirm start geen service',async()=>{
  let calls=0;const card=Object.create(EnergiehuisCard.prototype);
  card._hass={states:{'input_text.energiehuis_reset_baselines':{state:''},'sensor.p1':{state:'123.45'}},callService:async()=>{calls++;}};
  card.config={reset_store:'input_text.energiehuis_reset_baselines',import:'sensor.p1'};
  card._schedule=()=>{};
  card._eh17Confirm=null;
  await card._eh17ResetNow();
  assert.equal(calls,0);
  card._eh17Confirm=['in'];
  let payload=null;
  card._hass.callService=async(domain,service,data)=>{calls++;payload={domain,service,data};};
  await card._eh17ResetNow();
  assert.equal(calls,1);
  assert.equal(payload.domain,'input_text');assert.equal(payload.service,'set_value');
  const saved=JSON.parse(payload.data.value);
  assert.equal(saved.b.in[0],123.45);
  assert.equal(saved.b.in[2],eh17Hash('sensor.p1'));
  assert.equal(card._eh17Confirm,null);
});
test('Alleen JavaScript-frontend; geen laadservice aanroepen',()=>{
  assert.doesNotMatch(src,/callService\s*\(\s*['"](?:alfen|switch|number|button|cupra)/);
  assert.match(src,/input_text","set_value"/);
});
