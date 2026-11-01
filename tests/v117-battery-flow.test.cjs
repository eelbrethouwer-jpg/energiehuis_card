'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.B17={eh23BatteryDays,eh23BatteryDay,eh23BatterySelectedHour,eh23BatteryFlowChart,eh20Simulate,eh21BatteryProfile,EnergiehuisCard,EH_DEFAULTS};',ctx);
const {eh23BatteryDays,eh23BatteryDay,eh23BatterySelectedHour,eh23BatteryFlowChart,eh20Simulate,eh21BatteryProfile,EnergiehuisCard,EH_DEFAULTS}=ctx.B17;
const start=Date.parse('2026-10-20T00:00:00Z');
const hour=(n,imp,exp,price=.25)=>({t:start+n*3600000,end:start+(n+1)*3600000,import:imp,export:exp,price});
const rows=Array.from({length:72},(_,i)=>hour(i,i%24>=12?2:0,i%24<12?3:0));
const sim=(series=rows)=>eh20Simulate(series,10,.81,3,'solar',.25,.08,eh21BatteryProfile(10,{}));
test('simulatie levert aparte invoerreeksen voor zon, net en ontladen, zonder fysiek laden te suggereren',()=>{
 const s=sim();
 assert.equal(s.points.length,rows.length);
 assert.ok(s.points.some(x=>x.chargedSolar>0));
 assert.ok(s.points.some(x=>x.discharged>0));
 const html=eh23BatteryFlowChart({},s,rows);
 assert.match(html,/Gesimuleerd, niet fysiek gemeten/);
 assert.match(html,/Laden uit zon/);
 assert.match(html,/Netladen/);
 assert.match(html,/Ontladen/);
 assert.match(html,/data-eh23-hour="48"/);
 assert.doesNotMatch(html,/data-eh23-hour="12"/); // by default: most recent calendar day
});
test('dagselectie is begrensd, en uurselectie blijft binnen zichtbare dag',()=>{
 assert.equal(eh23BatteryDays(rows).length,3);
 assert.equal(eh23BatteryDay({_eh23DayIndex:-4},rows).index,0);
 assert.equal(eh23BatteryDay({_eh23DayIndex:30},rows).index,2);
 assert.equal(eh23BatterySelectedHour({_eh23DayIndex:0,_eh20Selected:50},rows),23);
 assert.equal(eh23BatterySelectedHour({_eh23DayIndex:1,_eh20Selected:35},rows),35);
 const html=eh23BatteryFlowChart({_eh23DayIndex:0,_eh20Selected:10},sim(),rows);
 assert.match(html,/data-eh23-hour="10"/);
 assert.match(html,/data-eh23-step="-1" disabled/);
 assert.doesNotMatch(html,/data-eh23-step="1" disabled/);
});
test('gaten in P1 worden expliciet grijs getoond, niet als nul of fictief laden',()=>{
 const gap=rows.map((r,i)=>i===54?{...r,import:null,export:null}:r);
 const html=eh23BatteryFlowChart({},sim(gap),gap);
 assert.match(html,/1 onvolledige meetpunten/);
 assert.match(html,/ontbrekende of onvolledige uurdata/);
 assert.match(html,/Geen data/);
});
test('grafiek kan een niet-geselecteerd uur aanklikbaar en via toetsenbord kiezen',()=>{
 const html=eh23BatteryFlowChart({},sim(),rows);
 assert.match(html,/role="button" tabindex="0"/);
 assert.match(html,/data-eh23-hour="69"/);
 assert.match(source,/e\.key!=='Enter'&&e\.key!==' '/);
 assert.match(source,/this\._eh20Selected=Number\(hour\.dataset\.eh23Hour\)/);
});
test('compacte Batterij 4.0 staat vóór oudere 10-kWh- en dagtotalen-modellen',()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card._eh17BatteryLoading=true;card._eh20Loading=true;card.isConnected=false;
 card._eh17Capacity=10;card._eh22Days=7;
 card._eh20Battery={at:Date.now(),days:7,rows,error:null};
 const html=card._batteryHtml({states:{}},EH_DEFAULTS);
 assert.match(html,/eh23-battery-page/);
 assert.match(html,/eh23-advanced/);
 assert.match(html,/Oudere 10-kWh- en dagtotalenberekeningen bekijken/);
 assert.match(html,/Vaste 10-kWh-simulatie uit Home Assistant/);
 assert.ok(html.indexOf('eh23-flow')<html.indexOf('eh23-advanced'));
 assert.equal((html.match(/<main /g)||[]).length,1);
 assert.match(html,/eh23-cap-tabs/);
 assert.match(html,/eh23-profiles/);
});
test('geen nieuwe Home Assistant schrijfacties; grafieken gebruiken bestaande simulatiepunten',()=>{
 assert.match(source,/function eh23BatteryFlowChart/);
 assert.match(source,/charge_control_enabled: false/);
 assert.doesNotMatch(source,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
});
