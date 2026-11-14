'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registered=new Map();
const sandbox={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registered.get(n),define:(n,v)=>registered.set(n,v)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(source+'\n;globalThis.EH27={EH_VERSION,eh26ForecastHtml,eh23BatteryFlowChart,eh22BatteryFinancialHtml,eh20Simulate,eh21BatteryProfile,eh26BatteryCss};',sandbox);
const {EH_VERSION,eh26ForecastHtml,eh23BatteryFlowChart,eh22BatteryFinancialHtml,eh20Simulate,eh21BatteryProfile,eh26BatteryCss}=sandbox.EH27;
const start=new Date(2026,5,1).getTime();
const rows=Array.from({length:168},(_,i)=>({t:start+i*3600000,end:start+(i+1)*3600000,import:i%24>=12?2:0,export:i%24<12?2:0,price:.20+i%9*.01}));
const simulate=(cap)=>eh20Simulate(rows,cap,.88,3,'solar',.25,.08,eh21BatteryProfile(cap,{}));
const future=Array.from({length:24},(_,i)=>({start:new Date(Date.parse('2026-11-02T00:00:00Z')+i*3600000).toISOString(),price:i%6===0?.08:.21+i*.004}));
const hass={states:{'sensor.price':{state:'0.2',attributes:{unit_of_measurement:'€/kWh',forecast:future}}}};
const config={prijs:'sensor.price',battery_roundtrip_efficiency:.88};
const now=new Date('2026-11-01T21:00:00Z');

test('v1.30.0 correct geregistreerd en mobiel component-CSS aanwezig',()=>{
 assert.equal(EH_VERSION,'1.30.0');
 assert.match(eh26BatteryCss(),/eh27-finance-chart/);
 assert.match(eh26BatteryCss(),/eh27-price-detail/);
});
test('prognose toont uitsluitend beschikbare prijzen en interactieve uurdetails',()=>{
 const html=eh26ForecastHtml(hass,config,10,3,'smart',now,{_eh27ForecastIndex:2});
 assert.match(html,/eh27-price-shade/);
 assert.match(html,/data-eh27-price-hour="2"/);
 assert.match(html,/eh27-price-detail/);
 assert.match(html,/Hypothetisch netladen/);
 assert.match(html,/eh27-planned-charge/);
 assert.match(html,/geen echt uitvoerbaar laadplan/);
});
test('alleen zonneladen toont geen hypothetisch netlaadvlak of SOC',()=>{
 const html=eh26ForecastHtml(hass,config,10,3,'solar',now);
 assert.doesNotMatch(html,/class="eh27-planned-charge"/);
 assert.doesNotMatch(html,/class="eh26-projected-soc"/);
 assert.match(html,/Geen netladen/);
});
test('historie scheidt echt gemodelleerde PV- en ontlaadwaarden in balken',()=>{
 const html=eh23BatteryFlowChart({},simulate(10),rows);
 assert.match(html,/eh27-pv-bar/);
 assert.match(html,/eh27-discharge-bar/);
 assert.match(html,/eh24-soc/);
 assert.match(html,/data-eh23-hour=/);
 assert.match(html,/Grafiek en databron/);
});
test('financiële capaciteitsvergelijking gebruikt de drie gesimuleerde profielen',()=>{
 const results=[5,10,15].map(simulate);
 const html=eh22BatteryFinancialHtml({_eh22Days:7,_eh22Investments:{},_eh22Wear:null},results,rows,10);
 assert.match(html,/eh27-finance-chart/);
 assert.match(html,/Operationeel voordeel per capaciteit/);
 assert.match(html,/5 kWh/);
 assert.match(html,/10 kWh/);
 assert.match(html,/15 kWh/);
 assert.match(html,/eh27-finance-more/);
 assert.match(html,/Vul een aanschafprijs in/);
});
test('grafiekselectors mogen Home Assistant of Alfen niet rechtstreeks aansturen',()=>{
 assert.doesNotMatch(source,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
});
