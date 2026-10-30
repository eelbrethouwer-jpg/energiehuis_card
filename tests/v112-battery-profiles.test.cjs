'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}};}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+
 '\n;globalThis.BAT={eh21BatteryProfile,eh20Simulate,eh20BatteryView,eh20Chart,EH_DEFAULTS,EnergiehuisCard};',context);
const {eh21BatteryProfile,eh20Simulate,eh20BatteryView,eh20Chart,EH_DEFAULTS,EnergiehuisCard}=context.BAT;
const start=Date.parse('2026-10-10T00:00:00Z');
function hour(n,imp,exp,price=.25){return {t:start+n*3600000,end:start+(n+1)*3600000,import:imp,export:exp,price};}
function sim(rows,cap,overrides={}){const p=eh21BatteryProfile(cap,{battery_sim_power_kw:3,...overrides});return eh20Simulate(rows,cap,.81,3,'solar',.25,.08,p);}
test('elk batterijprofiel krijgt eigen nominale en bruikbare kWh-grens',()=>{
 const a=[5,10,15].map(n=>eh21BatteryProfile(n,{}));
 assert.deepEqual(a.map(x=>x.capacity),[5,10,15]);
 assert.deepEqual(a.map(x=>x.usableCapacity),[5,10,15]);
 for(const p of a){assert.equal(p.chargeKw,3);assert.equal(p.dischargeKw,3);}
});
test('eigen aanpasbare limieten zonder onwaarschijnlijke standaardproductspecificaties',()=>{
 const c={battery_sim_power_kw:2,battery_5_usable_pct:80,battery_5_charge_kw:1.5,battery_5_discharge_kw:2.1,battery_10_charge_kw:4.2,battery_15_discharge_kw:6};
 const p=[5,10,15].map(n=>eh21BatteryProfile(n,c));
 assert.equal(p[0].usableCapacity,4);
 assert.equal(p[0].chargeKw,1.5);assert.equal(p[0].dischargeKw,2.1);
 assert.equal(p[1].chargeKw,4.2);assert.equal(p[2].dischargeKw,6);
 assert.equal(p[1].usableCapacity,10);
});
test('invoer buiten profielgrenzen valt terug op veilige rekenaanname',()=>{
 const p=eh21BatteryProfile(5,{battery_sim_power_kw:3,battery_5_usable_pct:-50,battery_5_charge_kw:999,battery_5_discharge_kw:-2});
 assert.equal(p.usableCapacity,5);assert.equal(p.chargeKw,3);assert.equal(p.dischargeKw,3);
});
test('5 kWh raakt eerder vol dan 15 kWh: exact apart SOC en afgewezen PV',()=>{
 const rows=[...Array.from({length:6},(_,i)=>hour(i,0,3)),hour(6,6,0),hour(7,6,0)];
 const a=[5,10,15].map(n=>sim(rows,n));
 assert.ok(a[0].peakSoc<=5+1e-8&&a[1].peakSoc<=10+1e-8&&a[2].peakSoc<=15+1e-8);
 assert.ok(a[0].pvLimitedCapacity>a[1].pvLimitedCapacity);
 assert.ok(a[1].pvLimitedCapacity>a[2].pvLimitedCapacity);
 assert.ok(a[0].served<a[1].served&&a[1].served<=a[2].served);
 assert.ok(a[0].fullHours>a[2].fullHours);
 assert.ok(a.every(x=>Math.abs(x.pvNotStored-x.pvLimitedPower-x.pvLimitedCapacity)<1e-8));
});
test('laadvermogenslimiet is andere oorzaak van ongebruikt PV dan volle accu',()=>{
 const rows=[hour(0,0,5),hour(1,0,5)];
 const a=sim(rows,15,{battery_15_charge_kw:1});
 assert.equal(a.pvCharge,2);
 assert.equal(a.pvLimitedPower,8);
 assert.equal(a.pvLimitedCapacity,0);
 assert.equal(a.fullHours,0);
});
test('bruikbaarheidspercentage verlaagt de interne SOC-begrenzing',()=>{
 const rows=[hour(0,0,5),hour(1,0,5),hour(2,0,5)];
 const p=sim(rows,5,{battery_5_usable_pct:80});
 assert.ok(p.peakSoc<=4+1e-8);
 assert.equal(p.usableCapacity,4);
 assert.ok(p.pvLimitedCapacity>0);
});
test('ontlaadsnelheid begrenst afname per uur onafhankelijk van capaciteit',()=>{
 const rows=[hour(0,0,8),hour(1,0,8),hour(2,8,0)];
 const slow=sim(rows,15,{battery_15_discharge_kw:1});
 const fast=sim(rows,15,{battery_15_discharge_kw:5});
 assert.ok(slow.served<=1+1e-8);
 assert.ok(fast.served>slow.served);
});
test('zonder voldoende zonne-overschot hoeft 15 kWh niet beter te zijn dan 5 kWh',()=>{
 const rows=[hour(0,0,1),hour(1,5,0)];
 const small=sim(rows,5),large=sim(rows,15);
 assert.ok(Math.abs(small.served-large.served)<1e-8);
});
test('geen dubbeltelling op hetzelfde uur en gaten stoppen SOC-overname',()=>{
 const r=sim([hour(0,0,3),hour(1,4,2),hour(2,null,null),hour(3,5,0)],5);
 assert.equal(r.points[1].discharged,0);
 assert.equal(r.points[2].soc,null);
 assert.equal(r.points[3].discharged,0);
 assert.ok(r.unobservedResetKwh>0);
});
test('dashboard toont drie afzonderlijke scenario’s en beperkte zonnestroom',()=>{
 const card=Object.create(EnergiehuisCard.prototype);card.isConnected=false;
 card._eh20Loading=true;card._eh17Capacity=5;card._eh20Mode='solar';
 const rows=Array.from({length:60},(_,i)=>hour(i,i%3===2?4:0,i%3===2?0:4));
 card._eh20Battery={at:Date.now(),rows,error:null};
 const html=eh20BatteryView(card,{states:{}},EH_DEFAULTS);
 assert.match(html,/eh21-scenarios/);
 assert.match(html,/Niet opgeslagen: vol/);
 assert.match(html,/data-eh17-cap="5"/);
 assert.match(html,/data-eh17-cap="10"/);
 assert.match(html,/data-eh17-cap="15"/);
 assert.match(html,/Piek:/);
 assert.match(html,/Niet opgeslagen door|niet opgeslagen/i);
});
test('bestaande 10kWh-Home Assistant-batterij blijft apart; geen scriptactivatie',()=>{
 assert.equal(EH_DEFAULTS.charge_control_enabled,false);
 assert.match(source,/function eh17BatteryHtml/);
 assert.match(source,/vaste 10-kWh-simulatie/i);
 assert.match(source,/const EH_VERSION = '1\.13\.0-rc\.2'/);
});
