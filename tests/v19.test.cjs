'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','energiehuis-card.js'),'utf8');
const registry=new Map();
const stored={};
const browser={
  customCards:[],
  navigator:{onLine:true},
  localStorage:{getItem:key=>stored[key]??null,setItem:(key,value)=>{stored[key]=value;}},
};
class FakeElement {attachShadow(){return {addEventListener(){}};}}
const context={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
  window:browser,
  customElements:{get:name=>registry.get(name),define:(name,klass)=>registry.set(name,klass)},
  HTMLElement:FakeElement
};
vm.runInNewContext(source+
 '\n;globalThis.V19={EnergiehuisCard,EH_DEFAULTS,eh19Toolbar,eh19ConnectionState,eh19ReadDensity,eh19Css};',context);
const {EnergiehuisCard,EH_DEFAULTS,eh19Toolbar,eh19ConnectionState,eh19ReadDensity,eh19Css}=context.V19;
function fakeCard(connected=false) {
 const listeners={},classes={},insertions=[];
 const style={textContent:''};
 const shell={
  classList:{toggle(key,on){classes[key]=on;}},
  insertAdjacentHTML(where,html){insertions.push({where,html});}
 };
 const root={
  innerHTML:'',
  addEventListener(type,handler){(listeners[type]??=[]).push(handler);},
  querySelector(query){if(query==='style')return style;if(query==='.shell')return shell;return null;}
 };
 const card=Object.create(EnergiehuisCard.prototype);
 Object.assign(card,{shadowRoot:root,config:{...EH_DEFAULTS},_hass:{states:{}},
  _view:'overview',_historyKey:'',_detail:null,isConnected:connected,_schedule(){this.scheduled=(this.scheduled||0)+1;}});
 return {card,root,style,classes,listeners,insertions};
}
test('v1.9.1 releasekandidaat houdt de volledige HACS kaart intact',()=>{
 assert.match(source,/const EH_VERSION = '1\.13\.0-rc\.2'/);
 assert.equal(typeof registry.get('energiehuis-card'),'function');
 assert.doesNotMatch(source,/serviceWorker\.register\s*\(/);
});
test('mobiele werkbalk is alleen-lezen en compact standaard',()=>{
 const f=fakeCard();
 f.card._render();
 assert.match(f.root.innerHTML,/data-eh-page="battery"/);
 assert.match(f.root.innerHTML,/data-eh-page="costs"/);
 assert.ok(f.insertions.some(x=>x.where==='afterbegin'&&x.html.includes('data-eh19-density="toggle"')));
 assert.equal(f.classes['eh19-roomy'],false);
 assert.equal(f.classes['eh19-float-nav'],false); // safe fallback when observer unavailable
 assert.match(f.style.textContent,/\.eh19-appbar\{/);
 assert.match(f.style.textContent,/max-width:720px/);
 assert.match(f.style.textContent,/safe-area-inset-bottom/);
});
test('compact/ruim wisselt, bewaart uitsluitend UI-voorkeur en behoudt pagina',()=>{
 const f=fakeCard();
 f.card._view='battery';f.card._eh17BatteryLoading=true;
 f.card._render();
 assert.match(f.insertions[0].html,/Batterij/);
 const target={closest:selector=>selector==='[data-eh19-density]'?{dataset:{eh19Density:'toggle'}}:null};
 for(const handler of f.listeners.click||[])handler({target});
 assert.equal(f.card._eh19Density,'roomy');
 assert.equal(stored['energiehuis.ui.density'],'roomy');
 assert.equal(f.card._view,'battery');
 assert.ok(f.card.scheduled>=1);
 f.card._render();
 assert.equal(f.classes['eh19-roomy'],true);
 assert.match(f.insertions.at(-1).html,/Schakel naar compacte weergave/);
 delete stored['energiehuis.ui.density'];
});
test('offline waarschuwing is conservatief: online netwerk is geen bewijs van HA live',()=>{
 assert.equal(eh19ConnectionState({states:{}},browser),'unknown');
 assert.equal(eh19ConnectionState({connection:{connected:false}},browser),'offline');
 assert.equal(eh19ConnectionState({}, {navigator:{onLine:false}}),'offline');
 const card={_view:'overview',_eh19Density:'compact'};
 const original=browser.navigator.onLine;
 browser.navigator.onLine=false;
 assert.match(eh19Toolbar(card,{}),/Offline · mogelijk oude meetwaarden/);
 browser.navigator.onLine=original;
 assert.match(eh19Toolbar(card,{}),/Alleen uitlezen/);
});
test('navigatie blijft binnen zichtbare kaart en valt veilig terug',()=>{
 const f=fakeCard(true);
 let onEntries=null,observed=null,disconnected=false;
 browser.IntersectionObserver=class {
  constructor(cb){onEntries=cb;}
  observe(element){observed=element;}
  disconnect(){disconnected=true;}
 };
 f.card._render();
 assert.equal(observed,f.card);
 assert.equal(f.classes['eh19-float-nav'],true);
 onEntries([{isIntersecting:false}]);
 assert.equal(f.classes['eh19-outside'],true);
 onEntries([{isIntersecting:true}]);
 assert.equal(f.classes['eh19-outside'],false);
 assert.match(eh19Css(),/\.shell\.eh19-float-nav\.eh19-outside \.nav/);
 assert.match(eh19Css(),/pointer-events:none/);
 f.card._eh19Observer.disconnect();
 assert.equal(disconnected,true);
 delete browser.IntersectionObserver;
});


test('opt-out floating nav schakelt actieve observer direct weer uit',()=>{
 const f=fakeCard(true);
 let disconnected=false,observer=null;
 browser.IntersectionObserver=class {
  observe() {observer=this;}
  disconnect() {disconnected=true;}
 };
 f.card.config.mobile_fixed_navigation=true;
 f.card._render();
 assert.ok(observer);
 assert.equal(f.classes['eh19-float-nav'],true);
 f.card.config.mobile_fixed_navigation=false;
 f.card._render();
 assert.equal(disconnected,true);
 assert.equal(f.card._eh19Observer,null);
 assert.equal(f.classes['eh19-float-nav'],false);
 delete browser.IntersectionObserver;
});
