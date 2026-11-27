'use strict';
// Batterij › Historie: duidelijke melding bij ontbrekende koppeling, time-out en opnieuw proberen (zonder browser).
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'energiehuis-card.js'),'utf8');
let clock=Date.parse('2026-11-20T12:30:00Z');
class FakeDate extends Date{constructor(...a){if(a.length)super(...a);else super(clock);}static now(){return clock;}}
const registry=new Map();
const ctx={console,setTimeout,clearTimeout,Promise,Date:FakeDate,Math,Map,Set,Array,Object,Number,String,JSON,Intl,
 window:{customCards:[],navigator:{onLine:true},addEventListener(){}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};return this.shadowRoot;}}};
vm.runInNewContext(source+'\n;globalThis.API={eh20BatteryView,eh20WithTimeout};',ctx);
const {eh20BatteryView,eh20WithTimeout}=ctx.API;
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
const card=extra=>({isConnected:false,_schedule(){},_eh26Tab:'history',...extra});

test('batterijhistorie: ontbrekende koppeling geeft een duidelijke melding in plaats van eeuwig laden',()=>{
 const noImp=eh20BatteryView(card({}),{states:{},callWS:async()=>({})},{});
 assert.match(text(noImp),/Koppel de tellers voor import en export/);assert.doesNotMatch(text(noImp),/ophalen uit Home Assistant Recorder/);
 const noWs=eh20BatteryView(card({}),{states:{}},{import:'sensor.a',export:'sensor.b'});
 assert.match(text(noWs),/in deze weergave niet beschikbaar/);
 const loading=eh20BatteryView(card({}),{states:{},callWS:async()=>({})},{import:'sensor.a',export:'sensor.b'});
 assert.match(text(loading),/ophalen uit Home Assistant Recorder/);
});

test('batterijhistorie: bij een fout staat er een knop om opnieuw te proberen',()=>{
 const html=eh20BatteryView(card({_eh20Battery:{at:Date.now(),rows:[],days:7,error:'Home Assistant antwoordde niet binnen een minuut.'}}),{states:{},callWS:async()=>({})},{import:'sensor.a',export:'sensor.b'});
 assert.match(html,/data-eh20-retry/);assert.match(text(html),/antwoordde niet binnen een minuut/);
});

test('timeout: een hangende aanvraag wordt afgebroken, een snelle niet',async()=>{
 await assert.rejects(eh20WithTimeout(new Promise(()=>{}),20),/eh20-timeout/);
 assert.equal(await eh20WithTimeout(Promise.resolve(5),50),5);
});
