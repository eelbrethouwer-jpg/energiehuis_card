'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','src','legacy','17-live-immersive.js'),'utf8');
const from=src.indexOf('function ehImmThermostat('),to=src.indexOf('/**\n * Net-pagina',from);
assert.ok(from>0&&to>from,'thermostaatfuncties zijn aanwezig');
const ctx={ehNum:v=>{if(v===null||v===undefined||v===''||['unavailable','unknown'].includes(String(v)))return null;const n=Number(v);return Number.isFinite(n)?n:null;},
 ehFmt:(n,d)=>n.toFixed(d).replace('.',','),ehEsc:v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))};
vm.runInNewContext(src.slice(from,to)+'\nglobalThis.read=ehImmThermostat;globalThis.html=ehImmThermoHtml;',ctx);
const id='climate.wgw_ot_on_off',valid={current_temperature:20,temperature:20,min_temp:7,max_temp:35,target_temp_step:.5,supported_features:1};
const card=(attrs,state='auto')=>({config:{thermostaat:id},_hass:{connected:true,states:{[id]:{state,attributes:attrs}},callService:async()=>{}}});
test('actuele temperatuur en doel zijn uitsluitend HA-waarden',()=>{const t=ctx.read(card(valid));assert.equal(t.current,20);assert.equal(t.target,20);assert.equal(t.writable,true);});
test('onbeschikbaar geeft geen fictieve cijfers of bediening',()=>{const c={config:{thermostaat:id},_hass:{connected:true,states:{}}};const t=ctx.read(c);assert.equal(t.current,null);assert.equal(t.target,null);assert.equal(t.writable,false);assert.match(ctx.html(c),/disabled/);});
test('onbekende features, limieten of stap blokkeren schrijven',()=>{for(const name of ['supported_features','min_temp','max_temp','target_temp_step']){const a={...valid};delete a[name];assert.equal(ctx.read(card(a)).writable,false,name);}});
test('modus off geeft geen bediening',()=>assert.equal(ctx.read(card(valid,'off')).writable,false));
test('zonder opt-in geen thermostaatinterface',()=>{const c={config:{thermostaat:''}};assert.equal(ctx.read(c),null);assert.equal(ctx.html(c),'');});
