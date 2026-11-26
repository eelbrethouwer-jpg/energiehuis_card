'use strict';
// Energiehuis 3.1: vijf tabs met segmenten (indeling en routering, zonder browser).
// Geen browser nodig: de kaart wordt in een vm geladen, de statistiek-aanroep wordt gesimuleerd.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
let clock=Date.parse('2026-11-20T12:30:00Z');
class FakeDate extends Date{constructor(...a){if(a.length)super(...a);else super(clock);}static now(){return clock;}}
const registry=new Map();
const ctx={console,Date:FakeDate,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true},addEventListener(){}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};return this.shadowRoot;}}};
vm.runInNewContext(source+'\n;globalThis.API={EHNV_TABS,EHNV_SEGMENTS,EHNV_HOME_VIEWS,ehNvWhere,ehNvNavigation,ehNvSegmentBar};',ctx);
const {EHNV_TABS,EHNV_SEGMENTS,EHNV_HOME_VIEWS,ehNvWhere,ehNvNavigation,ehNvSegmentBar}=ctx.API;
const plain=x=>JSON.parse(JSON.stringify(x));

test('vijf tabs in vaste volgorde; alleen Home gebruikt de bestaande paginaroute',()=>{
 assert.deepEqual(plain(EHNV_TABS.map(t=>t.label)),['Home','Energie','Auto','Geld','Meer']);
 const html=ehNvNavigation({tab:'energy',seg:'balance'});
 assert.equal((html.match(/<button/g)||[]).length,5);
 assert.match(html,/data-eh-page="overview"/);
 assert.equal((html.match(/data-ehnv-tab="/g)||[]).length,4);
 assert.match(html,/class="navitem eh26-navitem active" data-ehnv-tab="energy"[^>]*aria-current="page"/);
 assert.doesNotMatch(html,/eh26-insight|data-eh26-insights/);
});

test('catalogus: maximaal vier segmenten per tab, unieke id\'s, elke bestaande pagina blijft bereikbaar',()=>{
 const views=new Set();
 for(const [tab,list] of Object.entries(plain(EHNV_SEGMENTS))){
  assert.ok(list.length>=1&&list.length<=4,tab+' heeft '+list.length+' segmenten');
  assert.equal(new Set(list.map(s=>s.id)).size,list.length,tab);
  for(const s of EHNV_SEGMENTS[tab])views.add(s.view);
 }
 for(const v of ['cupra','charge','battery','costs','balance','more'])assert.ok(views.has(v),v+' is bereikbaar');
 assert.deepEqual(plain(Object.keys(EHNV_SEGMENTS)).sort(),['auto','energy','money','more']);
});

test('routering: Home en de Home-detailpagina\'s blijven op de Home-tab; oude paginanamen landen op de juiste tab en het juiste segment',()=>{
 for(const v of ['overview','sun','home','grid','practice'])assert.equal(ehNvWhere({_view:v}).tab,'overview',v);
 assert.deepEqual(plain(ehNvWhere({_view:'cupra'})),{tab:'auto',seg:'status'});
 assert.deepEqual(plain(ehNvWhere({_view:'charge'})),{tab:'auto',seg:'plan'});
 assert.deepEqual(plain(ehNvWhere({_view:'battery'})),{tab:'energy',seg:'battery'});
 assert.deepEqual(plain(ehNvWhere({_view:'balance'})),{tab:'energy',seg:'balance'});
 assert.deepEqual(plain(ehNvWhere({_view:'costs'})),{tab:'money',seg:'costs'});
 assert.deepEqual(plain(ehNvWhere({_view:'more'})),{tab:'more',seg:'sources'});
 assert.equal(ehNvWhere({_view:'onbekend'}).tab,'overview');
});

test('gekozen segment blijft staan zolang de onderliggende pagina klopt; anders geldt de standaard',()=>{
 assert.deepEqual(plain(ehNvWhere({_view:'more',_ehNvCur:{tab:'energy',seg:'sun'}})),{tab:'energy',seg:'sun'});
 assert.deepEqual(plain(ehNvWhere({_view:'balance',_ehNvCur:{tab:'more',seg:'check'}})),{tab:'more',seg:'check'});
 assert.deepEqual(plain(ehNvWhere({_view:'costs',_ehNvCur:{tab:'energy',seg:'sun'}})),{tab:'money',seg:'costs'});
});

test('segmentbalk: actief segment gemarkeerd, geen balk bij één segment',()=>{
 const bar=ehNvSegmentBar('energy','sun');
 assert.match(bar,/data-ehnv-seg="energy:sun" aria-pressed="true" class="chosen"/);
 assert.equal((bar.match(/aria-pressed="true"/g)||[]).length,1);
 assert.equal((bar.match(/<button/g)||[]).length,4);
 assert.equal(ehNvSegmentBar('nergens','x'),'');
});

test('Home-lagen blijven vastgezet en de navigatie-fragmenten schrijven niet naar Home Assistant',()=>{
 const src=fs.readFileSync(path.join(root,'src','legacy','19-navigation-31.js'),'utf8');
 assert.doesNotMatch(src,/callService|callApi|callWS|fetch\(|localStorage/);
});
