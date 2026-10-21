'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}}}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(js+'\n;globalThis.API={EH_DEFAULTS,eh171Sources,eh171DailyDelta,eh171Read,eh171Flow,eh171M3,eh17ResetDefs,EnergiehuisCard};',ctx);
const {EH_DEFAULTS,eh171Sources,eh171DailyDelta,eh171Read,eh171Flow,eh17ResetDefs,EnergiehuisCard}=ctx.API;
const meter=(name,state,unit)=>({state:String(state),attributes:{friendly_name:name,unit_of_measurement:unit}});
test('hotfix v1.7.1 behoudt bestaande gasmeter en koppelt gas vandaag',()=>{
 assert.equal(EH_DEFAULTS.gas,'sensor.gas_meter_gas');
 assert.equal(EH_DEFAULTS.gas_today,'sensor.gas_vandaag_2');
 const h={states:{
  'sensor.gas_meter_gas':meter('Gasmeter',7102.4,'m³'),
  'sensor.gas_vandaag_2':meter('Gas vandaag',1.16,'m³')}};
 const r=eh171Read({},h,EH_DEFAULTS);
 assert.equal(r.gas.today,'1,16 m³');
 assert.match(r.gas.meter,/7\.102,40 m³/);
 assert.equal(r.gas.source,'sensor.gas_vandaag_2');
});
test('homewizard water wordt eenduidig herkend en debiet naar L/min omgezet',()=>{
 const h={states:{
  'sensor.watermeter_total_water_usage':meter('Watermeter total water usage',24.31,'m³'),
  'sensor.watermeter_active_water_usage':meter('Watermeter active water usage',6.5,'L/min')
 }};
 const r=eh171Sources(h,EH_DEFAULTS);
 assert.equal(r.water.total,'sensor.watermeter_total_water_usage');
 assert.equal(r.water.flow,'sensor.watermeter_active_water_usage');
 const read=eh171Read({},h,EH_DEFAULTS);
 assert.equal(read.water.meter,'24,310 m³');
 assert.equal(read.water.flow,'6,5 L/min');
 assert.equal(read.water.today,'—');
 assert.equal(eh171Flow(1,'m³/h'),1000/60);
});
test('dagverbruik uit Recorder vereist beginstand en negeert teruggelopen teller',()=>{
 const id='sensor.watermeter_total_water_usage',mid=Date.parse('2026-10-21T00:00:00Z');
 const h={states:{[id]:meter('Watermeter',13.08,'m³')}};
 const history=[[{entity_id:id,state:'13.00',last_updated:'2026-10-20T23:50:00Z'},{entity_id:id,state:'13.08',last_updated:'2026-10-21T13:00:00Z'}]];
 const daily=eh171DailyDelta(history,id,h,mid);
 assert.ok(Math.abs(daily.value-.08)<1e-8);
 const card={_eh171DailyKey:'2026-10-21|'+id,_eh171Daily:{key:'2026-10-21|'+id,values:{water:daily}}};
 const c={...EH_DEFAULTS,water:id};
 assert.equal(eh171Read(card,h,c).water.today,'80 L');
 h.states[id]=meter('Watermeter',12.98,'m³');
 assert.equal(eh171DailyDelta(history,id,h,mid).value,null);
});
test('ontbrekende Recorder-beginstand produceert geen verzonnen dagwaarde',()=>{
 const id='sensor.watermeter_total_water_usage',mid=Date.parse('2026-10-21T00:00:00Z');
 const h={states:{[id]:meter('Watermeter',14,'m³')}};
 const data=[[{entity_id:id,state:'14',last_updated:'2026-10-21T07:00:00Z'}]];
 assert.equal(eh171DailyDelta(data,id,h,mid).value,null);
});
test('ambigue watermeter resulteert niet in een willekeurige keuze',()=>{
 const h={states:{
  'sensor.watermeter_a_total':meter('Watermeter A Total',10,'m³'),
  'sensor.watermeter_b_total':meter('Watermeter B Total',12,'m³')
 }};
 assert.equal(eh171Sources(h,EH_DEFAULTS).water.total,null);
});
test('handmatig gekoppelde watermeter behoudt prioriteit',()=>{
 const h={states:{
  'sensor.custom_water':meter('Mijn watermeter',40,'m³'),
  'sensor.watermeter_total_water_usage':meter('Watermeter totaal',55,'m³')
 }};
 const c={...EH_DEFAULTS,water:'sensor.custom_water'};
 assert.equal(eh171Sources(h,c).water.total,'sensor.custom_water');
 assert.equal(eh17ResetDefs(c,h).find(x=>x[0]==='water')[2],'sensor.custom_water');
});
test('Meterbeheer herkent ook automatisch de watermeter voor een veilige nulmeting',()=>{
 const id='sensor.watermeter_total_water_usage',h={states:{[id]:meter('Watermeter total water usage',9,'m³')}};
 const result=eh17ResetDefs(EH_DEFAULTS,h);
 assert.equal(result.find(x=>x[0]==='water')[2],id);
 const card=Object.create(EnergiehuisCard.prototype);
 card._eh17ResetKeys=new Set();card._eh17ResetOpen=true;
 const html=card._moreHtml(h,EH_DEFAULTS);
 assert.match(html,/Meterbeheer &amp; Reset/);
 assert.match(html,/watermeter_total_water_usage/);
 assert.match(html,/data-eh17-preview/);
});
