'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(source+'\n;globalThis.OUTLOOK={eh26BatteryForecast,eh26ForecastHtml,eh26BatteryTabs,eh26BatteryCss,EH_VERSION};',ctx);
const {eh26BatteryForecast,eh26ForecastHtml,eh26BatteryTabs,eh26BatteryCss,EH_VERSION}=ctx.OUTLOOK;
const now=new Date('2026-11-01T12:01:00Z'),start=Date.parse('2026-11-01T13:00:00Z');
function hass(n=24){
 const forecast=Array.from({length:n},(_,i)=>({start:new Date(start+i*3600000).toISOString(),price:i===7?.04:.20+i*.005}));
 return {states:{'sensor.price':{state:'0.22',attributes:{unit_of_measurement:'€/kWh',forecast}}}};
}
const c={prijs:'sensor.price',kwartier_forecast:'',battery_roundtrip_efficiency:.88};
test('v1.20: 24 echte toekomstige uurprijzen en goedkoopste vensters, geen verzonnen uur',()=>{
 assert.equal(EH_VERSION,'1.21.2');
 const r=eh26BatteryForecast(hass(),c,now,10,3,'smart');
 assert.equal(r.slots.length,24);assert.equal(r.complete,true);assert.equal(r.selected.length,4);
 assert.ok(r.selected.some(s=>s.t===start+7*3600000));
 assert.equal(r.slots.filter(s=>s.eligible).length,4);
 assert.ok(r.slots.some(s=>s.gridKwh>0));
 assert.ok(r.slots.every(s=>s.projectedPct>=0&&s.projectedPct<=100));
 assert.ok(r.slots.every((s,i)=>i===0||s.t>r.slots[i-1].t));
});
test('onvolledig prijsschema blijft zichtbaar als onvolledig, nooit aangevuld met schatprijzen',()=>{
 const few=eh26BatteryForecast(hass(2),c,now,5,3,'smart');
 assert.equal(few.missing,true);assert.equal(few.slots.length,0);
 const partial=eh26BatteryForecast(hass(6),c,now,5,3,'smart');
 assert.equal(partial.complete,false);
 assert.equal(partial.slots.length,6);
 assert.match(eh26ForecastHtml(hass(6),c,5,3,'smart',now),/Slechts 6 van 24/);
});
test('alleen-zonmodus selecteert prijsuren, maar produceert geen fictieve netto lading of SOC',()=>{
 const r=eh26BatteryForecast(hass(),c,now,10,3,'solar');
 assert.equal(r.slots.reduce((sum,s)=>sum+s.gridKwh,0),0);
 assert.ok(r.slots.every(s=>s.projectedPct===null));
 const html=eh26ForecastHtml(hass(),c,10,3,'solar',now);
 assert.match(html,/Geen netladen/);
 assert.doesNotMatch(html,/class="eh26-projected-soc"/);
});
test('slimme modus toont een uitsluitend hypothetische SOC-vulling en waarschuwt expliciet',()=>{
 const html=eh26ForecastHtml(hass(),c,10,3,'smart',now);
 assert.match(html,/class="eh26-forecast-svg"/);
 assert.match(html,/class="eh26-projected-soc"/);
 assert.match(html,/vanaf 0%/);
 assert.match(html,/zonder verbruik, ontladen of zonladen/);
 assert.match(html,/Geen Home Assistant- of Alfen-commando/);
});
test('ontbrekende forecast leidt niet tot een grafiek met uitgevonden informatie',()=>{
 const html=eh26ForecastHtml({states:{}},c,10,3,'smart',now);
 assert.match(html,/Minder dan 3 toekomstige uurprijzen/);
 assert.doesNotMatch(html,/eh26-forecast-svg/);
});
test('tabs en mobiele layout houden historie/rendement bereikbaar',()=>{
 const html=eh26BatteryTabs({_eh26Tab:'today'});
 assert.match(html,/data-eh26-tab="today" aria-pressed="true"/);
 assert.match(html,/data-eh26-tab="history"/);
 assert.match(html,/data-eh26-tab="returns"/);
 assert.match(eh26BatteryCss(),/eh26-panel\[hidden\]/);
 assert.match(source,/data-eh26-tab/);
 assert.doesNotMatch(source,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
});
