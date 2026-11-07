'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
class FakeElement {attachShadow(){return {addEventListener(){}};}}
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,window:{customCards:[]},customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},HTMLElement:FakeElement};
vm.runInNewContext(source+'\n;globalThis.REVIEW={EnergiehuisCard,EH_DEFAULTS,eh17Plan};',ctx);
const {EnergiehuisCard,EH_DEFAULTS}=ctx.REVIEW;
function card(){return Object.assign(Object.create(EnergiehuisCard.prototype),{_view:'charge',_targetSoc:80,_simNeed:20.7,_simPower:3.7,_chargeMode:'slim',_departure:new Date(Date.now()+86400000).toISOString(),_eh17SessionsLoading:true});}
test('laadkostentekst toont het ingestelde effectieve rendement en rekent laadverlies mee',()=>{
 for(const [setting,effective] of [[undefined,90],[.8,80],[.2,50],[1.2,100]]){
  const config={...EH_DEFAULTS,ev_charge_efficiency:setting};
  const html=card()._cupraHtml({states:{}},config);
  assert.match(html,new RegExp('Inclusief laadverlies \\(rendement '+effective+'%\\)'));
  assert.doesNotMatch(html,/exclusief laadverlies/);
 }
});
