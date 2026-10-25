'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}};}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(code+
 '\n;globalThis.BATTERY3={eh20Limits,eh20EnergyUnit,eh20PriceUnit,eh20HourlyPrices,eh20HourlyRows,eh20Simulate,eh20BatteryView,eh20Chart,EnergiehuisCard,EH_DEFAULTS};',context);
const {eh20Limits,eh20EnergyUnit,eh20PriceUnit,eh20HourlyPrices,eh20HourlyRows,eh20Simulate,eh20BatteryView,eh20Chart,EnergiehuisCard,EH_DEFAULTS}=context.BATTERY3;
const hour=n=>Date.parse('2026-10-19T00:00:00Z')+n*3600000;
const bin=(n,importKwh,exportKwh,price=null)=>({t:hour(n),end:hour(n+1),import:importKwh,export:exportKwh,price});
const meter={
 states:{
  'sensor.i':{attributes:{unit_of_measurement:'kWh'}},
  'sensor.e':{attributes:{unit_of_measurement:'Wh'}},
  'sensor.price':{attributes:{unit_of_measurement:'€/kWh'}},
 }
};
test('uurgrenzen: exact zeven volledige lokale dagen, zonder fictieve gedeeltelijke dag',()=>{
 const now=new Date(2026,9,25,17,38);
 const lim=eh20Limits(now);
 assert.equal(lim.from.getDate(),18);
 assert.equal(lim.to.getDate(),25);
 assert.equal(lim.to.getHours(),0);
 assert.equal(lim.step,'hour');
});
test('kWh/Wh correct, onbekende eenheid niet stilzwijgend als kWh aannemen',()=>{
 assert.equal(eh20EnergyUnit(meter,'sensor.i'),1);
 assert.equal(eh20EnergyUnit(meter,'sensor.e'),.001);
 assert.equal(eh20EnergyUnit(meter,'sensor.unknown'),null);
 assert.equal(eh20PriceUnit(meter,'sensor.price'),1);
 assert.equal(eh20PriceUnit({states:{'a':{attributes:{unit_of_measurement:'cent/kWh'}}}},'a'),.01);
});
test('uurtellers zijn per uur gekoppeld en Wh correct omgerekend',()=>{
 const lim={from:new Date(hour(0)),to:new Date(hour(2)),step:'hour'};
 const stats={
  'sensor.i':[{start:hour(0),change:2.5},{start:hour(1),change:0}],
  'sensor.e':[{start:hour(0),change:4000},{start:hour(1),change:0}]
 };
 const p=new Map([[hour(0),.25]]);
 const r=eh20HourlyRows(stats,{import:'sensor.i',export:'sensor.e'},meter,lim,p);
 assert.equal(r.error,null);
 assert.equal(r.rows.length,2);
 assert.equal(r.rows[0].import,2.5);
 assert.equal(r.rows[0].export,4);
 assert.equal(r.rows[0].price,.25);
 assert.equal(r.rows[1].price,null);
});
test('prijsdekking: alleen uurstatistiek of waarneming vlak bij uurstart',()=>{
 const bins=[bin(0,0,0),bin(1,0,0),bin(2,0,0)].map(r=>({t:r.t,end:r.end}));
 const prices=eh20HourlyPrices(
  {'sensor.price':[{start:hour(0),mean:.31}]},
  {'sensor.price':[{last_changed:new Date(hour(1)+60000).toISOString(),state:'0.12'},{last_changed:new Date(hour(2)+45*60000).toISOString(),state:'0.08'}]},
  bins,'sensor.price',meter
 );
 assert.equal(prices.get(hour(0)),.31);
 assert.equal(prices.get(hour(1)),.12);
 assert.equal(prices.has(hour(2)),false); // a late update cannot be invented as the entire hour
});
test('Home Assistant gegroepeerde history-resultaten bevatten de echte prijssensor',()=>{
 const haResult=[[{entity_id:'sensor.price',state:'0.13',last_changed:new Date(hour(0)).toISOString()},
   {entity_id:'sensor.price',state:'0.15',last_changed:new Date(hour(1)).toISOString()}]];
 const prices=eh20HourlyPrices(null,haResult,[{t:hour(0),end:hour(1)},{t:hour(1),end:hour(2)}],'sensor.price',meter);
 assert.equal(prices.get(hour(0)),.13);
 assert.equal(prices.get(hour(1)),.15);
});
test('v1.10 sessies en veilige standaard-uitgeschakelde bediening blijven aanwezig',()=>{
 assert.match(code,/function eh17SessionsFromHistory/);
 assert.match(code,/function eh20ControlStatus/);
 assert.match(code,/charge_control_enabled: false/);
 assert.match(code,/EH_VERSION = '1\.12\.0-rc\.1'/);
});
test('alleen zonneladen: energiebegrenzing, verliezen en latere ontlading',()=>{
 const data=[bin(0,0,8),bin(1,5,0),bin(2,5,0)];
 const s=eh20Simulate(data,5,.81,3,'solar',.25,.08);
 assert.equal(s.gridCharge,0);
 assert.equal(s.pvCharge,3);
 assert.ok(s.served>2&&s.served<3);
 assert.ok(s.savings>0);
 assert.equal(s.hours,3);
 assert.equal(s.endingSoc,0);
 assert.match(eh20Chart(s),/polyline/);
});
test('geen dubbele winst: export en import in hetzelfde uur worden niet tegelijk ontladen',()=>{
 const s=eh20Simulate([bin(0,0,5),bin(1,5,2),bin(2,5,0)],5,.81,3,'solar',.25,.08);
 assert.equal(s.pvCharge,5);
 assert.ok(s.served>0);
 const onlyMixed=eh20Simulate([bin(0,0,5),bin(1,5,2)],5,.81,3,'solar',.25,.08);
 assert.equal(onlyMixed.served,0);
});
test('5/10/15 kan zichtbaar verschillen bij voldoende PV en latere afname',()=>{
 const rows=[bin(0,0,15),bin(1,0,15),bin(2,0,15),bin(3,15,0),bin(4,15,0),bin(5,15,0)];
 const a=[5,10,15].map(cap=>eh20Simulate(rows,cap,.88,7.4,'solar',.25,.08));
 assert.ok(a[0].served<a[1].served&&a[1].served<a[2].served);
});
test('goedkoop netladen alleen met volledige prijzen en voldoende prijsverschil',()=>{
 const data=[bin(0,1,0,.05),bin(1,4,0,.42),bin(2,4,0,.40),bin(3,4,0,.50)];
 const s=eh20Simulate(data,5,.88,3,'smart',.25,.08);
 assert.ok(s.gridCharge>0);
 assert.ok(s.served>0);
 assert.ok(s.savings>0);
 const missing=data.map(r=>({...r,price:null}));
 assert.equal(eh20Simulate(missing,5,.88,3,'smart',.25,.08),null);
});
test('historisch gat reset SOC en verzint geen ontbrekend netverbruik',()=>{
 const s=eh20Simulate([bin(0,0,8),bin(1,null,null),bin(2,5,0)],5,.81,3,'solar',.25,.08);
 assert.equal(s.served,0);
 assert.equal(s.missingHours,1);
 assert.equal(s.points[1].soc,null);
});
test('geen geschiedenis betekent geen eurofantasie in het dashboard',()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card._eh17Capacity=10;card._eh20Mode='solar';card._eh20Loading=true;card.isConnected=false;
 const empty=eh20BatteryView(card,{states:{}},EH_DEFAULTS);
 assert.match(empty,/P1-uurstatistieken ophalen/);
 card._eh20Battery={at:Date.now(),rows:[]};
 const missing=eh20BatteryView(card,{states:{}},EH_DEFAULTS);
 assert.match(missing,/minimaal 48 uur/);
 assert.match(missing,/geen maandprognoses|scenarioresultaten/i);
});
test('geen servicecommando of softwarematige Alfen-regeling toegevoegd',()=>{
 assert.doesNotMatch(code,/callService\s*\(\s*['"](?:alfen|cupra|switch|number)/);
 assert.match(code,/1×40 A/);
});


test('uurinspectie toont gekozen uur, historische P1 en SOC in de simulator',()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card._eh20Loading=true;card._eh17Capacity=5;card._eh20Mode='solar';card.isConnected=false;
 const rows=[];
 for(let i=0;i<60;i++)rows.push(bin(i,i%2?3:0,i%2?0:6,.25));
 card._eh20Battery={rows,at:Date.now(),error:null};
 card._eh20Selected=1;
 const html=eh20BatteryView(card,meter,{...EH_DEFAULTS,battery_sim_power_kw:3});
 assert.match(html,/data-eh20-hour="1"/);
 assert.match(html,/value="1"/);
 assert.match(html,/Bekijk een uur op de grafiek/);
 assert.match(html,/Historisch uurtarief/);
 assert.match(html,/Netafname/);
 assert.match(html,/Vermeden netafname/);
 assert.match(html,/circle/);
});
