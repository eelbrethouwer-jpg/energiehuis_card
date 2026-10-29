'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}};}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,window:{customCards:[]},customElements:{get:k=>registry.get(k),define:(k,v)=>registry.set(k,v)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.C={ehCompareContract,ehCompareList,ehCompareDates,ehCompareRows,ehCompareCalculate,ehCompareHtml,EnergiehuisCard,EH_DEFAULTS};',context);
const C=context.C;
const from=new Date(2026,9,1),to=new Date(2026,9,2),limits={from,to,days:1};
const rows=Array.from({length:24},(_,i)=>({t:+from+i*3600000,import:2,export:.5}));
const fixed=over=>C.ehCompareContract({id:'fixed',name:'Test vast',type:'fixed',settlement:'separate',buy:.3,sell:.08,daily:.2,exportFee:.01,...over});
const dynamic=over=>fixed({id:'zp',name:'Zonneplan',type:'dynamic',priceEntity:'sensor.price',reference:true,...over});
const prices={'sensor.price':new Map(rows.map((r,i)=>[r.t,i<12?.1:.4]))};
const calc=contracts=>C.ehCompareCalculate(contracts,rows,prices,limits);
test('vaste contracten gebruiken bruto afname, vergoeding, terugleverkosten en dagkosten apart',()=>{
 const r=calc([fixed()]).results[0];assert.ok(Math.abs(r.total-13.76)<1e-10);
 assert.ok(Math.abs(r.purchase-14.4)<1e-10);assert.equal(r.credit,.96);assert.equal(r.fixed,.2);assert.equal(r.exportCost,.12);
});
test('dynamisch gebruikt verbruik per uur, referentie en sortering',()=>{
 const out=calc([fixed(),dynamic()]);assert.equal(out.results[0].contract.id,'zp');assert.ok(Math.abs(out.reference.total-11.36)<1e-9);
 const shifted=rows.map((r,i)=>({...r,import:i<12?4:0}));
 const cheaper=C.ehCompareCalculate([dynamic()],shifted,prices,limits);assert.ok(cheaper.reference.total<out.reference.total);
});
test('negatieve dynamische prijzen blijven negatief, geen nul-afkapping',()=>{
 const p={'sensor.price':new Map(rows.map(r=>[r.t,-.1]))};
 assert.ok(C.ehCompareCalculate([dynamic()],rows,p,limits).reference.total<0);
});
test('ontbrekende P1 data blokkeert alle totalen, ook als nul een geldig meetpunt is',()=>{
 const bad=rows.map((r,i)=>i===3?{...r,export:null}:r);
 assert.ok(C.ehCompareCalculate([fixed(),dynamic()],bad,prices,limits).results.every(r=>r.total===null));
 const zero=rows.map(r=>({...r,import:0,export:0}));assert.equal(C.ehCompareCalculate([fixed()],zero,{},limits).results[0].total,.2);
});
test('ontbrekende prijs blokkeert dynamisch, niet de vaste berekening',()=>{
 const p={'sensor.price':new Map(prices['sensor.price'])};p['sensor.price'].delete(rows[3].t);
 const out=C.ehCompareCalculate([fixed(),dynamic()],rows,p,limits);assert.equal(out.reference.total,null);assert.equal(out.results[0].contract.id,'fixed');
});
test('geen totaal bij dubbeltelling, uren buiten periode of te weinig uren',()=>{
 for(const bad of [rows.slice(1),[rows[1],...rows.slice(1)],rows.map(r=>({...r,t:r.t+3600000}))])assert.equal(C.ehCompareCalculate([fixed()],bad,{},limits).results[0].total,null);
});
test('saldo-scenario en contractgeldigheid',()=>{
 assert.ok(Math.abs(calc([fixed({settlement:'net'})]).results[0].total-11.12)<1e-9);
 assert.equal(calc([fixed({from:'2026-10-02'})]).results[0].total,null);
 assert.equal(calc([fixed({to:'2026-09-30'})]).results[0].total,null);
 assert.notEqual(calc([fixed({from:'2026-10-01',to:'2026-10-01'})]).results[0].total,null);
});
test('invoer valideert kosten, ongeldige datums, namen, dynamische sensor en salderen',()=>{
 for(const over of [{sell:null},{daily:null},{exportFee:-1},{buy:NaN},{name:' '},{from:'2026-02-30'},{from:'2026-12-01',to:'2026-01-01'}])assert.throws(()=>fixed(over));
 assert.throws(()=>dynamic({settlement:'net'}));assert.throws(()=>dynamic({priceEntity:'<script>'}));
 assert.throws(()=>C.ehCompareList([fixed(),fixed()]));assert.throws(()=>C.ehCompareList([dynamic(),dynamic({id:'other'})]));
});
test('jaarhistorie heeft meer dan 400 uren; Wh wordt omgezet en sum-gaten worden niet ingevuld',()=>{
 const lim={from,to:new Date(+from+1000*3600000),days:1000/24};
 const h={states:{'sensor.in':{attributes:{unit_of_measurement:'Wh'}},'sensor.out':{attributes:{unit_of_measurement:'kWh'}}}};
 const stats={'sensor.in':[{start:+from-3600000,sum:1000},{start:+from,sum:3000},{start:+from+7200000,sum:9000}],'sensor.out':[{start:+from,change:.5}]};
 const out=C.ehCompareRows(stats,{import:'sensor.in',export:'sensor.out'},h,lim);
 assert.equal(out.length,1000);assert.equal(out[0].import,2);assert.equal(out[0].export,.5);assert.equal(out[2].import,null);
});
test('periode is afgerond, begrensd en inclusieve einddatum',()=>{
 const now=new Date(2026,9,29,15);const lim=C.ehCompareDates('month',null,null,now);assert.equal(lim.days,28);
 const custom=C.ehCompareDates('custom','2026-10-01','2026-10-02',now);assert.equal(custom.days,2);
 assert.throws(()=>C.ehCompareDates('custom','2026-10-01','2026-10-29',now));
 assert.throws(()=>C.ehCompareDates('custom','2026-02-30','2026-03-01',now));
 assert.throws(()=>C.ehCompareDates('custom','2024-01-01','2026-01-01',now));
});
test('kostenpagina behoudt Vattenfall HTML en krijgt alleen een extra ingang',()=>{
 const card=Object.create(C.EnergiehuisCard.prototype);card._costComparePeriod='month';card._ehcmpContracts=[];
 const old=card._costsHtml({states:{}},C.EH_DEFAULTS);assert.match(old,/Vattenfall 1 jaar/);assert.match(old,/Vattenfall 3 jaar/);assert.match(old,/data-ehcmp-action="open"/);
 card._ehcmpOpen=true;const separate=card._costsHtml({states:{}},C.EH_DEFAULTS);assert.match(separate,/<h2>Stroomvergelijker/);assert.doesNotMatch(separate,/data-eh-cost-period/);
 card._ehcmpOpen=false;assert.equal(card._costsHtml({states:{}},C.EH_DEFAULTS),old);
});
test('contractnamen worden als tekst weergegeven en geen volledige winnaar bij ontbrekende data',()=>{
 const card={_ehcmpContracts:[fixed({name:'<img src=x onerror=alert(1)>'}),dynamic()],_ehcmpPeriod:'custom',_ehcmpStart:'2026-10-01',_ehcmpEnd:'2026-10-01',_ehcmpData:{key:`${+from}|${+to}`,rows,prices:{}}};
 const html=C.ehCompareHtml(card);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.match(html,/Geen volledige ranglijst/);
});
test('opslagfout meldt geen succes en verandert contracten niet',()=>{
 const card=Object.create(C.EnergiehuisCard.prototype);card._ehcmpContracts=[];context.window.localStorage={setItem(){throw new Error('quota');}};
 assert.throws(()=>card._ehcmpSave([fixed()]),/quota/);assert.equal(card._ehcmpContracts.length,0);
});
test('late Recorder-respons overschrijft een nieuwere periode niet',async()=>{
 const card=Object.create(C.EnergiehuisCard.prototype);card.config={import:'sensor.in',export:'sensor.out'};card._ehcmpContracts=[];card._schedule=()=>{};
 const pending=[];card._hass={states:{},callWS:()=>new Promise(resolve=>pending.push(resolve))};
 card._ehcmpPeriod='custom';card._ehcmpStart='2026-10-01';card._ehcmpEnd='2026-10-01';const first=card._ehcmpLoad();
 card._ehcmpStart='2026-10-02';card._ehcmpEnd='2026-10-02';const second=card._ehcmpLoad();
 pending[1]({});await second;const key=card._ehcmpData.key;pending[0]({});await first;assert.equal(card._ehcmpData.key,key);
});
test('zomer-/wintertijd verandert meeturen maar niet het aantal vaste-kostendagen',()=>{
 const lim=C.ehCompareDates('custom','2026-10-25','2026-10-25',new Date(2026,9,29));
 const data=C.ehCompareRows({}, {import:'sensor.in',export:'sensor.out'},{states:{}},lim);
 assert.equal(data.length,(lim.to-lim.from)/3600000);assert.equal(lim.days,1);
 const clean=data.map(r=>({...r,import:0,export:0}));
 assert.equal(C.ehCompareCalculate([fixed()],clean,{},lim).results[0].fixed,.2);
});
