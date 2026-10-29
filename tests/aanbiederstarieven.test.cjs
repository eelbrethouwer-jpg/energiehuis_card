'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();class Element{attachShadow(){return {addEventListener(){}};}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,Intl,URL,window:{customCards:[]},HTMLElement:Element,customElements:{get:n=>registry.get(n),define:(n,c)=>registry.set(n,c)},AbortController,setTimeout,clearTimeout};
vm.runInNewContext(source+'\n;globalThis.T={ehTariffCatalogue,ehTariffSource,ehTariffSourceHtml,ehTariffStatus,ehTariffUrl,ehTariffFixedCost,ehCompareContract,ehCompareCalculate,ehCompareForm,EnergiehuisCard};',context);
const T=context.T;
const field=(n,unit='EUR/kWh',over={})=>({bedragInclBtw:n,eenheid:unit,laatstGecontroleerd:'2026-10-25',bronUrl:'https://example.org/tarieven',geverifieerd:true,...over});
const fixture=()=>({dynamic:{versie:1,valuta:'EUR',leveranciers:[{id:'test',naam:'Test dynamisch',producten:{stroom:true},tariefUrl:'https://example.org',tarieven:{stroomVastPerMaand:field(6,'EUR/maand'),stroomInkoopopslag:field(.02),terugleverCorrectie:field(-.03)}}]},fixed:{valuta:'EUR',inclBtw:true,contracten:[{id:'vast',leverancier:'Test',naam:'Vast',tarieven:{stroomLeveringPerKwh:field(.2),stroomVastPerMaand:field(10,'EUR/maand'),terugleververgoedingPerKwh:field(.08),terugleverkostenPerKwh:field(.01)}}]}});
const entries=()=>{const f=fixture();return T.ehTariffCatalogue(f.dynamic,f.fixed);};
const lim={from:new Date(2026,9,1),to:new Date(2026,9,2),days:1};
const rows=Array.from({length:24},(_,i)=>({t:+lim.from+i*3600000,import:2,export:.5}));
const prices={'sensor.market':new Map(rows.map(r=>[r.t,.1]))};
function draft(over={}){return {...entries()[0].draft,id:'test',tax:.12,priceEntity:'sensor.market',sourceConfirmed:true,...over};}
test('catalogus vult leveranciersdelen in, belasting en beursprijssensor blijven expliciet onbekend',()=>{
 const a=entries();assert.equal(a.length,2);assert.equal(a[0].draft.tax,null);assert.equal(a[0].draft.priceEntity,'');assert.equal(a[0].draft.markup,.02);assert.equal(a[0].draft.exportAdjustment,-.03);assert.equal(a[1].draft.delivery,.2);assert.equal(a[1].draft.buy,null);
});
test('geen verkeerde eenheid, ontbrekend bedrag of ontbrekende terugleverkosten als nul',()=>{
 const f=fixture();f.fixed.contracten[0].tarieven.terugleverkostenPerKwh=field(3,'EUR/maand');delete f.dynamic.leveranciers[0].tarieven.terugleverCorrectie;
 const a=T.ehTariffCatalogue(f.dynamic,f.fixed);assert.equal(a[0].draft.exportAdjustment,null);assert.equal(a[1].draft.exportFee,null);
 assert.throws(()=>T.ehCompareContract(draft({exportAdjustment:null})));assert.throws(()=>T.ehCompareContract({...a[1].draft,id:'f',tax:.12,sourceConfirmed:true}));
});
test('bronbevestiging, belasting en prijssensor vereist',()=>{
 for(const over of [{sourceConfirmed:false},{tax:null},{priceEntity:''},{markup:null}])assert.throws(()=>T.ehCompareContract(draft(over)));
 const c=T.ehCompareContract(draft());assert.equal(c.source.fields[2].value,-.03);assert.equal(c.source.checked,'2026-10-25');
 assert.equal(T.ehCompareContract(JSON.parse(JSON.stringify(c))).source.fields[0].url,'https://example.org/tarieven');
});
test('marktprijs plus belasting/opslag en teruglevercorrectie zonder dubbeltelling',()=>{
 const c=T.ehCompareContract(draft());const r=T.ehCompareCalculate([c],rows,prices,lim).results[0];
 assert.ok(Math.abs(r.purchase-48*.24)<1e-9);assert.ok(Math.abs(r.credit-12*.07)<1e-9);assert.ok(Math.abs(r.fixed-6/31)<1e-9);assert.equal(r.exportCost,0);
 const positive=T.ehCompareCalculate([T.ehCompareContract(draft({exportAdjustment:.02}))],rows,prices,lim).results[0];assert.ok(Math.abs(positive.credit-12*.12)<1e-9);
});
test('negatieve beursprijs en negatieve netto terugleveropbrengst blijven negatief',()=>{
 const negative={'sensor.market':new Map(rows.map(r=>[r.t,-.2]))};const r=T.ehCompareCalculate([T.ehCompareContract(draft())],rows,negative,lim).results[0];assert.ok(r.purchase<0);assert.ok(r.credit<0);assert.ok(r.total>r.purchase+r.fixed);
});
test('vaste levering en belasting worden één keer opgeteld',()=>{
 const c=T.ehCompareContract({...entries()[1].draft,id:'f',tax:.12,sourceConfirmed:true});assert.equal(c.buy,.32);const r=T.ehCompareCalculate([c],rows,{},lim).results[0];assert.ok(Math.abs(r.purchase-48*.32)<1e-9);
 assert.equal(T.ehCompareContract(JSON.parse(JSON.stringify(c))).buy,.32);
});
test('maandkosten volgen kalenderdagen, ook schrikkeljaar en wintertijd',()=>{
 for(const [year,month,days] of [[2026,9,31],[2026,1,28],[2028,1,29]]){
  const full={from:new Date(year,month,1),to:new Date(year,month+1,1),days};assert.ok(Math.abs(T.ehTariffFixedCost({fixedPeriod:'monthly',monthly:9},full)-9)<1e-9);
 }
 assert.ok(Math.abs(T.ehTariffFixedCost({fixedPeriod:'monthly',monthly:31},{from:new Date(2026,9,25),to:new Date(2026,9,26),days:1})-1)<1e-9);
});
test('één belastingbedrag wordt niet stilzwijgend over meerdere kalenderjaren toegepast',()=>{
 const limits={from:new Date(2026,11,31),to:new Date(2027,0,2),days:2},r=Array.from({length:48},(_,i)=>({t:+limits.from+i*3600000,import:0,export:0}));
 const out=T.ehCompareCalculate([T.ehCompareContract(draft())],r,{'sensor.market':new Map(r.map(x=>[x.t,.1]))},limits);assert.equal(out.results[0].total,null);assert.match(out.results[0].reason,/kalenderjaar/);
});
test('bronstatus gebruikt oudste echte controledatum, geen generatiedatum of sinds-datum',()=>{
 const now=new Date('2026-10-29T12:00:00Z');assert.equal(T.ehTariffStatus([field(1),field(2,'EUR/kWh',{laatstGecontroleerd:'2026-08-01'})],now).stale,true);
 assert.equal(T.ehTariffStatus([{sinds:'2026-10-28'}],now).checked,'');assert.equal(T.ehTariffStatus([field(1,'EUR/kWh',{laatstGecontroleerd:'2026-11-20'})],now).stale,true);
});
test('onbekend schema, ontbrekende btw-grondslag en dubbele IDs worden geweigerd',()=>{
 let f=fixture();f.dynamic.versie=9;assert.throws(()=>T.ehTariffCatalogue(f.dynamic,f.fixed));f=fixture();f.fixed.inclBtw=false;assert.throws(()=>T.ehTariffCatalogue(f.dynamic,f.fixed));f=fixture();f.dynamic.leveranciers.push(f.dynamic.leveranciers[0]);assert.throws(()=>T.ehTariffCatalogue(f.dynamic,f.fixed));
});
test('links en brontekst kunnen geen scripts injecteren',()=>{
 assert.equal(T.ehTariffUrl('javascript:alert(1)'),'');assert.equal(T.ehTariffUrl('https://user:password@example.org'),'');
 const s=T.ehTariffSource({...entries()[0].source,note:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)'});const html=T.ehTariffSourceHtml(s,true);assert.doesNotMatch(html,/<img|href="javascript:/);assert.match(html,/&lt;img/);assert.match(html,/CC BY 4.0/);
});
test('netwerkfout bewaart opgehaalde lijst en opgeslagen contracten',async()=>{
 const c=Object.create(T.EnergiehuisCard.prototype);c._schedule=()=>{};const list=entries();c._ehcatEntries=list;c._ehcmpContracts=[{id:'keep'}];context.fetch=async()=>{throw new Error('offline');};await c._ehcatLoad();assert.equal(c._ehcatEntries,list);assert.equal(c._ehcmpContracts[0].id,'keep');assert.match(c._ehcatError,/niet worden opgehaald/);assert.equal(c._ehcatLoading,false);
});
test('catalogus ophalen is alleen GET naar vaste endpoints zonder credentials of offerteverzoek',async()=>{
 const c=Object.create(T.EnergiehuisCard.prototype);c._schedule=()=>{};const f=fixture(),calls=[];context.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify(url.endsWith('leveranciers.json')?f.dynamic:f.fixed)};};await c._ehcatLoad();assert.equal(c._ehcatEntries.length,2);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.options.credentials==='omit'&&x.options.body===undefined&&x.url.startsWith('https://raw.githubusercontent.com/zhinees/energieprijzen-nl/main/data/')));
});
