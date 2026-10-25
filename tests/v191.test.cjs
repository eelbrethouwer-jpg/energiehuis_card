'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const customElementsRegistry=new Map();
class FakeElement{attachShadow(){return {addEventListener(){}};}}
const context={
 console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[]},
 customElements:{get:k=>customElementsRegistry.get(k),define:(k,v)=>customElementsRegistry.set(k,v)},
 HTMLElement:FakeElement,
};
vm.runInNewContext(src+'\n;globalThis.TEST={eh191BatteryScenario,eh17BatteryHtml,EnergiehuisCard,EH_DEFAULTS};',context);
const {eh191BatteryScenario,eh17BatteryHtml,EnergiehuisCard,EH_DEFAULTS}=context.TEST;
function cardWithRows(rows){
 const card=Object.create(EnergiehuisCard.prototype);
 card._eh17BatteryLoading=true;
 card._eh17Capacity=10;
 card._eh17Battery={at:Date.now(),rows};
 return card;
}
test('model verschilt bij voldoende dagafname en teruglevering: 5 < 10 < 15',()=>{
 const days=[{import:40,export:23},{import:30,export:17},{import:42,export:24}];
 const a=[5,10,15].map(cap=>eh191BatteryScenario(days,cap,.88,.25,.08));
 assert.ok(a[0].monthKwh<a[1].monthKwh&&a[1].monthKwh<a[2].monthKwh);
 assert.ok(a[0].monthEuro<a[1].monthEuro&&a[1].monthEuro<a[2].monthEuro);
 assert.ok(Math.abs(a[0].monthKwh-5*.88*30.44)<.0001);
});
test('identiek resultaat bij lage teruglevering is expliciet vermeld',()=>{
 const card=cardWithRows([{import:12,export:3},{import:18,export:2}]);
 for(const capacity of [5,10,15]){
  card._eh17Capacity=capacity;
  const html=eh17BatteryHtml(card,{states:{}},EH_DEFAULTS);
  assert.match(html,/Alle capaciteiten leveren volgens deze dagtotalen ongeveer dezelfde uitkomst/);
  assert.match(html,new RegExp('Gekozen batterij: <strong>'+capacity+' kWh</strong>'));
  assert.match(html,/Verschil met 5 kWh/);
  assert.match(html,/€ 0,00/);
  assert.match(html,/aria-pressed="true"/);
 }
});
test('scenario in vergelijking wijzigt waar data dat ondersteunt',()=>{
 const card=cardWithRows([{import:40,export:20},{import:28,export:18}]);
 card._eh17Capacity=5;
 const small=eh17BatteryHtml(card,{states:{}},EH_DEFAULTS);
 card._eh17Capacity=15;
 const large=eh17BatteryHtml(card,{states:{}},EH_DEFAULTS);
 assert.notEqual(small,large);
 assert.match(small,/data-eh17-cap="5" class="active"/);
 assert.match(large,/data-eh17-cap="15" class="active"/);
 assert.match(large,/Grotere capaciteit kan extra energie verschuiven/);
 const value=eh191BatteryScenario(card._eh17Battery.rows,15,.88,.25,.08);
 assert.match(large,new RegExp(value.monthKwh.toFixed(1).replace('.',',')+' kWh'));
});
test('ontbrekende geschiedenis resulteert niet in verzonnen bedragen',()=>{
 const card=cardWithRows([{import:25,export:10}]);
 let html=eh17BatteryHtml(card,{states:{}},EH_DEFAULTS);
 assert.match(html,/minimaal twee dagen/);
 assert.match(html,/Hergebruik\/maand/);
 assert.match(html,/—/);
 card._eh17Battery={at:Date.now(),rows:[],error:'Recorder niet beschikbaar'};
 html=eh17BatteryHtml(card,{states:{}},EH_DEFAULTS);
 assert.match(html,/Recorder niet beschikbaar/);
 assert.equal(eh191BatteryScenario([],15,.88,.25,.08).monthEuro,null);
});
test('bovenste 10kWh-tab blijft duidelijk gescheiden van vergelijkingsmodel',()=>{
 const card=cardWithRows([{import:40,export:20},{import:28,export:18}]);
 card._eh17Capacity=15;
 const html=card._batteryHtml({states:{}},EH_DEFAULTS);
 assert.match(html,/Vaste 10-kWh-simulatie uit Home Assistant/);
 assert.match(html,/vergelijking van 5, 10 en 15 kWh/);
 assert.match(html,/Gekozen batterij: <strong>15 kWh<\/strong>/);
 assert.match(html,/dagelijkse P1-netafname en -teruglevering/);
});
test('bestaande laadsturing niet aangepast',()=>{
 assert.doesNotMatch(src,/callService\s*\(\s*['"](?:alfen|cupra|switch)/);
});
