'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(src+'\n;globalThis.EH28={EH_VERSION,eh28DetailEntries,EnergiehuisCard};',ctx);
const {EH_VERSION,eh28DetailEntries,EnergiehuisCard}=ctx.EH28;
const detail=(cls,label,open=false,contract=null)=>({
 className:cls,open,
 classList:{contains:n=>cls.split(' ').includes(n)},
 querySelector:s=>s===':scope > summary'?{
  textContent:label,querySelector:q=>q==='b'&&contract?{textContent:contract}:null
 }:null
});
const root=details=>({querySelectorAll:selector=>selector==='details'?details:[]});

test('v1.21.1 stabiliteitsfix is geladen zonder Cupra-state te verwijderen',()=>{
 assert.equal(EH_VERSION,'1.21.1');
 assert.match(src,/this\._cupraDetails=!this\._cupraDetails/);
 assert.match(src,/eh28PreserveExpansion/);
});
test('stabiele paneel-identiteit bij her-render en wisselende waarden',()=>{
 const before=eh28DetailEntries(root([
  detail('eh27-finance-more','Investering, slijtage en berekeningsdetails',true),
  detail('ehcmp-result','Zonneplan € 99,95',true,'Zonneplan'),
 ]),'battery');
 const after=eh28DetailEntries(root([
  detail('eh27-finance-more','Investering, slijtage en berekeningsdetails',false),
  detail('ehcmp-result','Zonneplan € 112,50',false,'Zonneplan'),
 ]),'battery');
 assert.equal(before[0][0],after[0][0]);
 assert.equal(before[1][0],after[1][0]);
 assert.equal(before[0][1].open,true);
});
test('verschillende tabbladen en herhaalde samenvattingen krijgen eigen sleutels',()=>{
 const a=eh28DetailEntries(root([
  detail('eh27-chart-info','Berekening en beperkingen'),
  detail('eh27-chart-info','Berekening en beperkingen')
 ]),'battery');
 assert.equal(a.length,2);
 assert.notEqual(a[0][0],a[1][0]);
 const c=eh28DetailEntries(root([detail('eh27-chart-info','Berekening en beperkingen')]),'cupra');
 assert.notEqual(a[0][0],c[0][0]);
});
test('kaart zonder echte browser-DOM blijft veilig voor bestaande Node-tests',()=>{
 assert.equal(eh28DetailEntries({querySelector(){}},'battery').length,0);
 assert.equal(eh28DetailEntries(null,'cupra').length,0);
 const card=Object.create(EnergiehuisCard.prototype);
 card.shadowRoot={querySelector(){return null;},addEventListener(){}};
 assert.doesNotThrow(()=>card._render());
});
