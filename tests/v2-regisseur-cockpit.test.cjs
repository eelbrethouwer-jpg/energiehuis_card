'use strict';
// PR4: only synthetic inputs. The cockpit reads existing states/history and issues no HA calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','src','legacy','16-regisseur-cockpit.js'),'utf8');
const escaped=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const price=(h,id)=>{const n=Number(h.states?.[id]?.state);return Number.isFinite(n)?n:null;};
const number=(h,id)=>{const raw=h.states?.[id]?.state;const n=raw===undefined||raw===''?NaN:Number(raw);return Number.isFinite(n)?n:null;};
const power=(h,id)=>{
 const n=number(h,id),unit=String(h.states?.[id]?.attributes?.unit_of_measurement||'').toLowerCase();
 return n===null?null:unit==='w'?n:unit==='kw'?n*1000:null;
};
class FakeCard{_render(){this._priorRenderCount=(this._priorRenderCount||0)+1;}}
const ctx={EnergiehuisCard:FakeCard,Date,Math,Number,String,Object,Array,
 ehW:power,ehCurrentPrice:price,ehRead:number,ehEsc:escaped,ehDayKey:d=>String(d.getDate()),
 ehPower:n=>n===null?'—':Math.abs(n)>=1000?(n/1000).toFixed(1)+' kW':n.toFixed(0)+' W',
 ehFmt:(n,d)=>Number(n).toFixed(d),ehMoney:n=>'€ '+n.toFixed(3)
};
vm.runInNewContext(source+';globalThis.TEST={eh40Fresh,eh40Cockpit,eh40History,eh40Css,eh40AgeLabel};',ctx);
const api=ctx.TEST;
const ids={net:'sensor.net',zonnepanelen:'sensor.pv',huis:'sensor.home',laden:'sensor.alfen',cupra:'sensor.cupra',prijs:'sensor.price'};
const st=(value,unit,ageMinutes=0)=>({
 state:String(value),attributes:{unit_of_measurement:unit},
 last_updated:new Date(Date.now()-ageMinutes*60000).toISOString()
});
function setup(){
 const h={states:{
  [ids.net]:st(-450,'W'),[ids.zonnepanelen]:st(2500,'W'),
  [ids.huis]:st(1600,'W'),[ids.laden]:st(450,'W'),
  [ids.cupra]:st(52,'%'),[ids.prijs]:st(.173,'€/kWh')
 }};
 const now=Date.now(),start=now-3*3600000;
 const history={start,dayEnd:now+3600000,samples:Array.from({length:9},(_,i)=>({t:start+i*3600000/2,[ids.net]:i===3?null:-450+i*100}))};
 const card=new FakeCard();
 card._view='overview';card._detail=null;card.config=ids;card._hass=h;
 card._historyKey=String(new Date().getDate())+'|net';card._history=history;
 return {h,card};
}
test('PR4: cockpit is pure read-only UI without new HA/storage handlers',()=>{
 assert.doesNotMatch(source,/\.callService\s*\(|\.callWS\s*\(|localStorage|setItem\s*\(/);
 assert.match(source,/root\.addEventListener\('click'/);
 assert.match(source,/metrics\.insertAdjacentHTML\('beforebegin'/);
 assert.match(source,/previous\.call\(this\)/);
});
test('PR4: valid synthetic readings show live cockpit, navigation and clickable chart',()=>{
 const {h,card}=setup(),before=JSON.stringify(h.states),markup=api.eh40Cockpit(card,h,ids);
 assert.match(markup,/EnergieRegisseur cockpit/);
 assert.match(markup,/Alle bronnen actueel/);
 assert.match(markup,/Netvermogen vandaag/);
 assert.match(markup,/data-eh-detail="grid"/);
 assert.match(markup,/data-eh-detail="sun"/);
 assert.match(markup,/data-eh-detail="home"/);
 assert.match(markup,/data-eh-page="cupra"/);
 assert.match(markup,/data-eh-page="charge"/);
 assert.match(markup,/data-eh-page="costs"/);
 assert.match(markup,/<svg /);
 assert.match(markup,/Teruglevering/);
 assert.equal(JSON.stringify(h.states),before);
});
test('PR4: stale, missing or unknown readings never become fabricated live numbers',()=>{
 const {h,card}=setup();
 h.states[ids.net]=st(1600,'W',30);
 delete h.states[ids.cupra];
 h.states[ids.huis]=st(90,'kWh');
 h.states[ids.prijs].last_updated='not-a-date';
 assert.equal(api.eh40Fresh(h,ids.net,'power',5,Date.now()).reason,'Verouderd');
 assert.equal(api.eh40Fresh(h,ids.cupra,'number',90,Date.now()).reason,'Niet beschikbaar');
 assert.equal(api.eh40Fresh(h,ids.huis,'power',5,Date.now()).reason,'Geen geldige waarde');
 assert.equal(api.eh40Fresh(h,ids.prijs,'price',95,Date.now()).reason,'Tijd onbekend');
 const markup=api.eh40Cockpit(card,h,ids);
 assert.match(markup,/2 van 6 bronnen actueel/);
 assert.match(markup,/Verouderd/);
 assert.match(markup,/Niet beschikbaar/);
 assert.doesNotMatch(markup,/1.6 kW/);
});
test('PR4: historical gaps and absent history are represented safely',()=>{
 const {card}=setup();
 const svg=api.eh40History(card,ids.net);
 assert.match(svg,/<svg/);
 assert.match(svg,/stroke-dasharray/);
 card._history=null;
 assert.equal(api.eh40History(card,ids.net),null);
});
test('PR4: existing render chain and non-overview pages remain untouched',()=>{
 const {h,card}=setup();
 let injected='',css='';
 const metrics={insertAdjacentHTML:(where,text)=>{assert.equal(where,'beforebegin');injected=text;}};
 const root={addEventListener:()=>{},querySelector:q=>q==='.body .metrics'?metrics:q==='style'?{get textContent(){return css;},set textContent(v){css=v;}}:null};
 card.shadowRoot=root;
 card._render();
 assert.equal(card._priorRenderCount,1);
 assert.match(injected,/Jouw energie, nu/);
 assert.match(css,/\.eh40-cockpit/);
 injected='';
 card._view='battery';
 card._render();
 assert.equal(card._priorRenderCount,2);
 assert.equal(injected,'');
});

test('PR4 B1: unchanged zero PV and idle Alfen use recent last_reported without false stale warning',()=>{
 const {h,card}=setup(),old=new Date(Date.now()-3*3600000).toISOString(),recent=new Date().toISOString();
 for(const id of [ids.zonnepanelen,ids.laden]){
  h.states[id].state='0';h.states[id].last_updated=old;h.states[id].last_reported=recent;
  const reading=api.eh40Fresh(h,id,'power',35,Date.now(),true);
  assert.equal(reading.ok,true);
  assert.equal(reading.value,0);
  assert.equal(reading.reason,'Actueel');
 }
 h.states[ids.cupra].last_updated=old;h.states[ids.cupra].last_reported=recent;
 assert.equal(api.eh40Fresh(h,ids.cupra,'number',90,Date.now(),true).ok,true);
 const html=api.eh40Cockpit(card,h,ids);
 assert.match(html,/Alle bronnen actueel/);
 assert.doesNotMatch(html,/Verouderd/);
});
test('PR4 B1: last known stable values remain visible but are never counted as current',()=>{
 const {h,card}=setup(),old=new Date(Date.now()-3*3600000).toISOString();
 for(const [id,reading,unit] of [[ids.zonnepanelen,'0','W'],[ids.laden,'0','W'],[ids.cupra,'52','%']]){
  h.states[id].state=reading;h.states[id].last_updated=old;
 }
 const html=api.eh40Cockpit(card,h,ids);
 assert.match(html,/3 van 6 bronnen actueel/);
 assert.equal((html.match(/Laatste stand · niet recent bevestigd/g)||[]).length>=3,true);
 assert.match(html,/0 W/);
 assert.match(html,/52%/);
 assert.equal(api.eh40Fresh(h,ids.zonnepanelen,'power',35,Date.now(),true).retained,true);
 h.states[ids.zonnepanelen].state='800';
 assert.equal(api.eh40Fresh(h,ids.zonnepanelen,'power',35,Date.now(),false).value,null);
 h.states[ids.cupra].last_updated='not-a-date';
 assert.equal(api.eh40Fresh(h,ids.cupra,'number',90,Date.now(),true).retained,undefined);
});
test('PR4 B2: cockpit-opened detail is moved directly below cockpit and revealed once',()=>{
 const {h,card}=setup();
 let inserted='',scrolled=0,placed=0,callback=null,css='';
 const pane={scrollIntoView:arg=>{scrolled++;assert.equal(arg.block,'start');}};
 const cockpit={insertAdjacentElement:(where,node)=>{assert.equal(where,'afterend');assert.equal(node,pane);placed++;}};
 const metrics={insertAdjacentHTML:(where,html)=>{assert.equal(where,'beforebegin');inserted=html;}};
 const root={addEventListener:(name,fn)=>{assert.equal(name,'click');callback=fn;},
  querySelector:selector=>selector==='.body .metrics'?metrics:selector==='style'?
   {get textContent(){return css;},set textContent(v){css=v;}}:
   selector==='.body > .detail-panel'?pane:selector==='.eh40-cockpit'?cockpit:null};
 card.shadowRoot=root;card._render();
 assert.match(inserted,/eh40-cockpit/);
 assert.equal(typeof callback,'function');
 card._detail='grid';
 callback({target:{closest:selector=>selector==='.eh40-cockpit [data-eh-detail]'?{dataset:{ehDetail:'grid'}}:null}});
 card._render();assert.equal(placed,1);assert.equal(scrolled,1);
 card._render();assert.equal(placed,2);assert.equal(scrolled,1);
 card._detail=null;
 callback({target:{closest:selector=>selector==='.eh40-cockpit [data-eh-detail]'?null:{dataset:{}}}});
 card._render();assert.equal(scrolled,1);
});
test('PR4 B3: cockpit footer actions meet 44px mobile touch target',()=>{
 assert.match(api.eh40Css(),/\.eh40-footer button\{[^}]*min-height:44px/);
});

test('PR4 R2: stale power bars show LAST-KNOWN and age, not an unqualified live header',()=>{
 const {h,card}=setup(),now=Date.now(),old=new Date(now-2*3600000).toISOString();
 for(const id of [ids.zonnepanelen,ids.laden]){
  h.states[id].state='0';
  h.states[id].last_updated=old;
 }
 const markup=api.eh40Cockpit(card,h,ids);
 assert.match(markup,/Vermogen en laatste standen/);
 assert.doesNotMatch(markup,/<strong>Vermogen nu<\/strong>/);
 assert.match(markup,/eh40-flow-row eh40-flow-old/);
 assert.match(markup,/0 W<small>Laatste · 2 uur geleden<\/small>/);
 assert.equal((markup.match(/Laatste · 2 uur geleden/g)||[]).length>=2,true);
 assert.match(markup,/4 van 6 bronnen actueel/);
 const allFresh=setup(),freshMarkup=api.eh40Cockpit(allFresh.card,allFresh.h,ids);
 assert.match(freshMarkup,/<strong>Vermogen nu<\/strong>/);
 assert.doesNotMatch(freshMarkup,/eh40-flow-row eh40-flow-old/);
});
test('PR4 R3: old Cupra SOC includes age but never counts as a current reading',()=>{
 const {h,card}=setup(),now=Date.now();
 h.states[ids.cupra].last_updated=new Date(now-3*86400000).toISOString();
 const reading=api.eh40Fresh(h,ids.cupra,'number',90,now,true);
 assert.equal(reading.ok,false);
 assert.equal(reading.retained,true);
 assert.match(reading.reason,/Laatste stand · niet recent bevestigd · 3 dagen geleden/);
 const markup=api.eh40Cockpit(card,h,ids);
 assert.match(markup,/52%/);
 assert.match(markup,/3 dagen geleden/);
 assert.match(markup,/5 van 6 bronnen actueel/);
 assert.equal(api.eh40AgeLabel(60*1000),'1 min geleden');
 assert.equal(api.eh40AgeLabel(86400000),'1 dag geleden');
 assert.equal(api.eh40AgeLabel(Number.NaN),'tijd onbekend');
});
