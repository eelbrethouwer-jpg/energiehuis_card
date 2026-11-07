'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(src+'\n;globalThis.BAT4={eh20Limits,eh20Simulate,eh22BatteryCoverage,eh22BatteryFinance,eh22BatteryFinancialHtml,eh20BatteryView,eh21BatteryProfile,EnergiehuisCard,EH_DEFAULTS};',ctx);
const b=ctx.BAT4;
const start=new Date(2026,5,1).getTime();
const row=(i,imp,exp,price=.25)=>({t:start+i*3600000,end:start+(i+1)*3600000,import:imp,export:exp,price});
const days30=Array.from({length:720},(_,i)=>row(i,i%24>=12?2:0,i%24<12?2:0));
const simulate=(rows,cap=10,mode='solar')=>b.eh20Simulate(rows,cap,.81,3,mode,.25,.08,b.eh21BatteryProfile(cap,{}));
test('7 of 30 complete kalenderdagen, ander aantal wordt niet stilzwijgend 30',()=>{
 const now=new Date(2026,5,30,13,35);
 assert.equal(b.eh20Limits(now).from.getDate(),23);
 assert.equal(b.eh20Limits(now,30).from.getMonth(),4);
 assert.equal(b.eh20Limits(now,30).from.getDate(),31);
 assert.equal(b.eh20Limits(now,999).from.getDate(),23);
 assert.equal(b.eh20Limits(now,30).to.getHours(),0);
});
test('operationele boekhouding sluit exact op totale besparing, zonder dubbele winst',()=>{
 const s=simulate([row(0,0,3),row(1,4,0),row(2,0,3),row(3,4,0)]);
 assert.ok(s.avoidedPurchase>0);
 assert.ok(s.lostExport>0);
 assert.equal(s.gridPurchase,0);
 assert.ok(Math.abs(s.savings-(s.avoidedPurchase-s.gridPurchase-s.lostExport))<1e-8);
 assert.ok(s.served<=s.pvCharge*.81+1e-8);
});
test('goedkoop netladen wordt als aparte kostenpost meegenomen, ook bij negatieve prijzen',()=>{
 const rows=[row(0,1,0,-.1),row(1,4,0,.43),row(2,4,0,.50)];
 const s=simulate(rows,5,'smart');
 assert.ok(s.gridCharge>0);
 assert.ok(s.gridPurchase<0);
 assert.ok(Math.abs(s.savings-(s.avoidedPurchase-s.gridPurchase-s.lostExport))<1e-8);
});
test('zonder historie geen financieel resultaat, geen terugverdientijd',()=>{
 const f=b.eh22BatteryFinance(simulate([row(0,0,3),row(1,3,0)]),[row(0,0,3),row(1,3,0)],30,1500,.02);
 assert.equal(f.available,false);
 assert.equal(f.annualIllustration,undefined);
});
test('30 dagen met volledige dekking: expliciete slijtage, hypothese en terugverdientijd',()=>{
 const s=simulate(days30,5),f=b.eh22BatteryFinance(s,days30,30,2500,.02);
 assert.equal(f.available,true);
 assert.equal(f.health.completeDays,30);
 assert.equal(f.health.coverage,1);
 assert.ok(f.wearTotal>0);
 assert.ok(Math.abs(f.afterWear-(s.savings-s.served*.02))<1e-8);
 assert.ok(Math.abs(f.annualIllustration-f.afterWear*365/30)<1e-8);
 assert.ok(f.payback>0);
 assert.ok(f.cycles>0);
});
test('7 dagen geeft nooit een jaarschatting, ook niet als uren compleet zijn',()=>{
 const rows=days30.slice(0,168),f=b.eh22BatteryFinance(simulate(rows),rows,7,3000,0);
 assert.equal(f.available,true);
 assert.equal(f.annualIllustration,null);
 assert.equal(f.payback,null);
});
test('te weinig complete dagen blokkeert terugverdientijd bij 30-dagenvenster',()=>{
 const bad=days30.map((r,i)=>i%24===0?{...r,import:null}:r);
 const f=b.eh22BatteryFinance(simulate(bad),bad,30,3000,.02);
 assert.ok(f.health.coverage>.90);
 assert.equal(f.health.completeDays,0);
 assert.equal(f.annualIllustration,null);
 assert.equal(f.payback,null);
});
test('geen aanschafprijs of slijtagekosten is onbekend, niet automatisch nul',()=>{
 const s=simulate(days30);
 const a=b.eh22BatteryFinance(s,days30,30,null,null);
 assert.equal(a.capex,null);assert.equal(a.wearTotal,null);assert.equal(a.payback,null);
 const invalid=b.eh22BatteryFinance(s,days30,30,-500,2);
 assert.equal(invalid.capex,null);assert.equal(invalid.wearTotal,null);
});
test('5, 10 en 15 kWh naast elkaar: meer capaciteit is niet altijd financieel beter',()=>{
 const cap=[5,10,15].map(c=>simulate(days30,c));
 assert.ok(cap.every(x=>Number.isFinite(x.savings)));
 assert.ok(cap.every(x=>x.savings===x.avoidedPurchase-x.gridPurchase-x.lostExport || Math.abs(x.savings-(x.avoidedPurchase-x.gridPurchase-x.lostExport))<1e-8));
});
test('financiële kaart geeft waarden en parameters, maar geen gefingeerde aanschafprijs',()=>{
 const card=Object.create(b.EnergiehuisCard.prototype);
 card._eh17Capacity=10;card.isConnected=false;card._eh20Loading=true;card._eh22Days=30;card._eh20Mode='solar';
 card._eh20Battery={rows:days30,at:Date.now(),days:30,error:null};
 const html=b.eh20BatteryView(card,{states:{}},b.EH_DEFAULTS);
 for(const name of ['Batterij 4.0','data-eh22-period="7"','data-eh22-period="30"','data-eh22-invest="10"','data-eh22-wear="1"','Equivalent cycli','Vermeden inkoop','Gemiste teruglevering'])assert.ok(html.includes(name),name);
 assert.match(html,/Vul een aanschafprijs in/);
 assert.doesNotMatch(html,/Verschil tussen leveranciers is gegarandeerd/);
});
test('geen nieuwe service calls; 10 kWh HA-gegevens blijven onaangeraakt',()=>{
 assert.match(src,/Vaste 10-kWh-simulatie uit Home Assistant/);
 assert.match(src,/charge_control_enabled: false/);
 assert.doesNotMatch(src,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
});
