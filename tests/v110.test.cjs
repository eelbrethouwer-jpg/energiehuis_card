'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,k)=>registry.set(n,k)},HTMLElement:FakeElement};
vm.runInNewContext(src+'\n;globalThis.TEST20={eh17SessionsFromHistory,eh17SessionsHtml,eh20ControlStatus,eh20ControlHtml,EnergiehuisCard,EH_DEFAULTS};',ctx);
const {eh17SessionsFromHistory,eh17SessionsHtml,eh20ControlStatus,eh20ControlHtml,EnergiehuisCard,EH_DEFAULTS}=ctx.TEST20;
const base=Date.parse('2026-10-22T10:00:00Z');
const id='sensor.test_alfen',priceId='sensor.test_price';
const h={states:{[id]:{state:'100',attributes:{unit_of_measurement:'kWh'}},[priceId]:{state:'.12',attributes:{unit_of_measurement:'€/kWh'}}}};
const c={laad_energie:id,prijs:priceId,charge_history_days:30};
const values=(samples)=>[samples.map(([mins,kwh])=>({
 entity_id:id,state:String(kwh),last_updated:new Date(base+mins*60000).toISOString()
}))];
test('tien echte stappen van 0,03 kWh blijven samen één sessie van 0,3 kWh',()=>{
 const history=values(Array.from({length:11},(_,i)=>[i*5,100+i*.03]));
 const sessions=eh17SessionsFromHistory(history,c,h);
 assert.equal(sessions.length,1);
 assert.ok(Math.abs(sessions[0].kwh-.3)<.00001);
 assert.ok(sessions.meta.small>=10);
 assert.equal(sessions[0].estimated,false);
});
test('twee laadbeurten worden gesplitst na een lange inactieve periode',()=>{
 const history=values([[0,10],[10,11],[20,11],[130,11],[140,12]]);
 const sessions=eh17SessionsFromHistory(history,c,h);
 assert.equal(sessions.length,2);
});
test('lange maar plausibele tellerinterval is zichtbaar als geschat, niet weggegooid',()=>{
 const sessions=eh17SessionsFromHistory(values([[0,50],[240,57]]),c,h);
 assert.equal(sessions.length,1);
 assert.equal(sessions[0].estimated,true);
 assert.ok(sessions[0].kwh>6.9);
});
test('reset, onrealistische sprong en ontbrekende prijs vormen geen fictieve prijs',()=>{
 const history=values([[0,100],[10,100.8],[15,2],[20,20],[25,20.3]]);
 const sessions=eh17SessionsFromHistory(history,c,{states:{[id]:h.states[id]}});
 assert.ok(sessions.meta.skipped>=2);
 assert.ok(sessions.every(s=>s.missing>=s.kwh-.001));
});
test('sessiediagnose toont tellermetingen, meetgaten en recorderdekking',()=>{
 const sessions=eh17SessionsFromHistory(values([[0,50],[240,57]]),c,h);
 const card={_eh17Sessions:{at:Date.now(),sessions,meta:sessions.meta},_eh17SessionsLoading:false};
 const html=eh17SessionsHtml(card,h,c);
 assert.match(html,/7,00 kWh/);
 assert.match(html,/Geschat/);
 assert.match(html,/detailmetingen/);
 assert.match(html,/maximaal 30 dagen/);
});
test('laadbediening staat standaard volledig uit, ook bij bestaande scripts',()=>{
 assert.equal(EH_DEFAULTS.charge_control_enabled,false);
 assert.equal(eh20ControlStatus({},EH_DEFAULTS,'start').ready,false);
});
test('beide scripts en verse P1/Alfen-data vereist; pauze toegestaan bij stale sensoren',()=>{
 const now=Date.now(),configured={...EH_DEFAULTS,charge_control_enabled:true,charge_start_script:'script.energiehuis_start',charge_pause_script:'script.energiehuis_pause'};
 const states={
  [configured.charge_start_script]:{state:'off'},[configured.charge_pause_script]:{state:'off'},
  [configured.net]:{state:'1000',last_updated:new Date(now).toISOString()},
  [configured.laden]:{state:'0',last_updated:new Date(now).toISOString()}
 };
 const fake={states,connection:{connected:true},callService:async()=>{}};
 assert.equal(eh20ControlStatus(fake,configured,'start',now).ready,true);
 assert.equal(eh20ControlStatus(fake,configured,'pause',now).ready,true);
 states[configured.net].last_updated=new Date(now-90000).toISOString();
 assert.equal(eh20ControlStatus(fake,configured,'start',now).ready,false);
 assert.equal(eh20ControlStatus(fake,configured,'pause',now).ready,true);
 states[configured.net].last_updated=new Date(now).toISOString();
 states[configured.laden].last_updated=new Date(now-90000).toISOString();
 assert.equal(eh20ControlStatus(fake,configured,'start',now).ready,false);
});
test('twee afzonderlijke bevestigingsstappen: zonder pending geen laadcommando',async()=>{
 const now=Date.now(),configured={...EH_DEFAULTS,charge_control_enabled:true,charge_start_script:'script.energiehuis_start',charge_pause_script:'script.energiehuis_pause'};
 const states={
  'script.energiehuis_start':{state:'off'},'script.energiehuis_pause':{state:'off'},
  [configured.net]:{state:'1000',last_updated:new Date(now).toISOString()},
  [configured.laden]:{state:'0',last_updated:new Date(now).toISOString()}
 };
 const calls=[],card=Object.create(EnergiehuisCard.prototype);
 card.config=configured;card._hass={states,connection:{connected:true},callService:async(...args)=>{calls.push(args);}};
 card._schedule=()=>{};
 await card._eh20Send('start');
 assert.equal(calls.length,0);
 card._eh20Pending='start';
 await card._eh20Send('start');
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'script');
 assert.equal(calls[0][1],'turn_on');
 assert.equal(calls[0][2].entity_id,'script.energiehuis_start');
 assert.match(card._eh20Message,/Opdracht aan Home Assistant verzonden/);
});
test('start- en pauzeknoppen in UI geblokkeerd zolang sturing niet is geconfigureerd',()=>{
 const card={_view:'charge',_eh20Pending:null,_eh20Message:''};
 const html=eh20ControlHtml(card,{states:{}},EH_DEFAULTS);
 assert.match(html,/Nog niet geactiveerd/);
 assert.match(html,/data-eh20-action="start" disabled/);
 assert.match(html,/data-eh20-action="pause" disabled/);
 assert.match(html,/laadplan worden niet automatisch uitgevoerd/);
});


test('bekendste batteryfix v1.9.1 blijft onderdeel van de code na integratie',()=>{
 assert.match(src,/function eh191BatteryScenario/);
 assert.match(src,/Vaste 10-kWh-simulatie uit Home Assistant/);
 assert.match(src,/EH_VERSION = '1\.11\.0'/);
});
test('voordat scripts zijn gekoppeld worden geen echte servicecalls aangeboden',()=>{
 assert.equal(EH_DEFAULTS.charge_control_enabled,false);
 assert.equal(EH_DEFAULTS.charge_start_script,'');
 assert.equal(EH_DEFAULTS.charge_pause_script,'');
 const fake={states:{},connection:{connected:true},callService:()=>{}};
 assert.equal(eh20ControlStatus(fake,EH_DEFAULTS,'start').ready,false);
});
