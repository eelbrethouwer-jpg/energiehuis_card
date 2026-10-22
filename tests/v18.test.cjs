'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}}}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(src+'\n;globalThis.API18={EH18_CONTRACT_START,EH_DEFAULTS,eh18Unit,eh18Rows,eh18Health,eh18Costs,eh18Charge,eh18Graphic,eh18Insight,eh17Plan,EnergiehuisCard};',ctx);
const {EH_DEFAULTS,eh18Unit,eh18Rows,eh18Health,eh18Costs,eh18Charge,eh18Graphic,eh18Insight,EnergiehuisCard}=ctx.API18;
const sensor=(state,unit)=>({state:String(state),attributes:{unit_of_measurement:unit}});
test('v1.8.0 kaartnaam, basisconfiguratie en 6 navigatieschermen behouden',()=>{
 assert.match(src,/EH_VERSION = '1.8.0'/);
 assert.ok(registry.get('energiehuis-card'));
 for(const page of ['overview','cupra','charge','battery','costs','more']) assert.match(src,new RegExp("'"+page+"'"));
 assert.equal(EH_DEFAULTS.gas,'sensor.gas_meter_gas');
 assert.equal(EH_DEFAULTS.gas_today,'sensor.gas_vandaag_2');
 assert.equal(EH_DEFAULTS.fuse_amp,40);
 assert.equal(EH_DEFAULTS.charger_amp,32);
});
test('eenheden voor gas en elektriciteit strikt genormaliseerd',()=>{
 const h={states:{'sensor.a':sensor(20,'L'),'sensor.b':sensor(2500,'Wh'),'sensor.c':sensor(7,'kWh'),'sensor.bad':sensor(5,'W')}};
 assert.equal(eh18Unit(20,'sensor.a',h,'gas'),.02);
 assert.equal(eh18Unit(2500,'sensor.b',h,'energy'),2.5);
 assert.equal(eh18Unit(7,'sensor.c',h,'energy'),7);
 assert.equal(eh18Unit(5,'sensor.bad',h,'energy'),null);
});
test('gas Insights rekent stats in m3 zonder data te fabriceren',()=>{
 const h={states:{'sensor.gas':sensor(100,'m³')}},c={gas:'sensor.gas'};
 const bins=[{t:0,key:'2026-10-20',label:'20 okt'},{t:86400000,key:'2026-10-21',label:'21 okt'}];
 const stats={'sensor.gas':[{start:'2026-10-20T12:00:00Z',change:1.25}]};
 // Alle meettijdvakken in deze test hebben een lokale naam; 20/21 oktober zijn wintertijd-afhankelijk.
 const result=eh18Rows(stats,bins,'day',c,h,'gas');
 assert.equal(result.length,2);
 assert.equal(result[0].m3,1.25);
 assert.equal(result[1].m3,null);
});
test('solar Insights berekent direct gebruik uit energie minus export',()=>{
 const c={zonne_energie:'sensor.pv',import:'sensor.import',export:'sensor.export'};
 const h={states:{'sensor.pv':sensor(25,'kWh'),'sensor.import':sensor(9,'kWh'),'sensor.export':sensor(5,'kWh')}};
 const key='2026-10-22',bins=[{t:0,key,label:'22 okt'}];
 const data={'sensor.pv':[{start:'2026-10-22T00:00:00Z',change:10}], 'sensor.export':[{start:'2026-10-22T00:00:00Z',change:3}], 'sensor.import':[{start:'2026-10-22T00:00:00Z',change:4}]};
 const r=eh18Rows(data,bins,'day',c,h,'sun')[0];
 assert.equal(r.kwh,10); assert.equal(r.selfKwh,7);assert.equal(r.exportKwh,3);assert.equal(r.importKwh,4);
 data['sensor.export'][0].change=12;
 assert.equal(eh18Rows(data,bins,'day',c,h,'sun')[0].selfKwh,null);
});
test('watermeter is gepland en wordt niet als storing gemeld',()=>{
 const h={states:{[EH_DEFAULTS.gas_today]:sensor(1,'m³'),[EH_DEFAULTS.gas]:sensor(10,'m³'),[EH_DEFAULTS.zonne_energie]:sensor(4,'kWh'),[EH_DEFAULTS.import]:sensor(5,'kWh'),[EH_DEFAULTS.export]:sensor(2,'kWh')}};
 const issues=eh18Health(h,EH_DEFAULTS);
 assert.equal(issues.length,0);
 assert.doesNotMatch(issues.join(' '),/water/i);
});
test('kosten geven voor contractstart geen gerealiseerde Zonneplan-kosten aan',()=>{
 const h={states:{[EH_DEFAULTS.cost_zonneplan_month]:sensor(42,'€')}};
 const html=eh18Costs(h,EH_DEFAULTS);
 assert.match(html,/Zonneplan begint 1 november 2026|Zonneplan-contractperiode actief/);
 assert.match(html,/Engie/);
 assert.match(html,/Vattenfall/);
});
test('Slim laden 2.1 toont haalbaarheid en laat load balancing ongemoeid',()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card._view='charge';card._targetSoc=80;card._simNeed=30;card._simPower=3.7;
 card._departure=new Date(Date.now()+86400000).toISOString();
 const html=eh18Charge({states:{}},EH_DEFAULTS,card);
 assert.match(html,/Slim laden 2.1/);
 assert.match(html,/haalbaar|Geen volledige uren|prijsuren/i);
 assert.match(html,/Active Load Balancing/);
 assert.match(html,/laadcommando/i);
});
test('gas en zon zijn beschikbaar in Meer en bestaande reset blijft aanwezig',()=>{
 const card=Object.create(EnergiehuisCard.prototype),h={states:{}};
 card._eh17ResetKeys=new Set();card._eh17ResetOpen=false;
 const html=card._moreHtml(h,EH_DEFAULTS);
 assert.match(html,/Gas Insights/);
 assert.match(html,/Zonne-energie Insights/);
 assert.match(html,/Meterbeheer/);
 assert.match(html,/Systeemcontrole/);
 assert.match(html,/watermeter/i);
});
test('grafiek toont alleen aanwezige meetpunten, correcte ontbrekende-historie melding',()=>{
 assert.match(eh18Graphic([{label:'dag 1',m3:null}],'gas',0),/Geen betrouwbare/);
 const html=eh18Graphic([{label:'dag 1',m3:1.0},{label:'dag 2',m3:2.0}],'gas',1);
 assert.match(html,/data-eh18-point="1"/);
 assert.match(html,/2,00 m³/);
});
test('geen nieuw gevaarlijk Home Assistant schrijfgedrag geïntroduceerd',()=>{
 assert.doesNotMatch(src,/callService\s*\(\s*['"](?:alfen|cupra|switch|number|button)/);
 assert.match(src,/input_text","set_value"/);
});
