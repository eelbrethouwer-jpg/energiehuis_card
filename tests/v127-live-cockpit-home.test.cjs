'use strict';
// v1.27 Live Cockpit als Home: fragment, schakelaar, datacontract, veiligheid en buildvolgorde (zonder browser).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fragment=read('src/legacy/16-live-cockpit.js');
const bundle=read('energiehuis-card.js');

/** Laadt het fragment geïsoleerd met een minimale kaartklasse; geeft de exports en de globale context terug. */
function load(){
 class EnergiehuisCard{_render(){this.rendered=(this.rendered||0)+1;}}
 const ctx=vm.createContext({EnergiehuisCard,URL,Promise,setTimeout,clearTimeout,Date,JSON,Object,Math,Number,String,Array,Set,Map,Error});
 const before=new Set(Object.getOwnPropertyNames(ctx));
 vm.runInContext(fragment+'\n;globalThis.__api=EhLiveCockpit;',ctx,{filename:'16-live-cockpit.js'});
 const added=Object.getOwnPropertyNames(ctx).filter(n=>!before.has(n)&&n!=='__api');
 return {api:ctx.__api,ctx,added,EnergiehuisCard};
}

test('v1.27 build: Live Cockpit-fragment staat vóór de EnergieRegisseur, die het laatste fragment blijft',()=>{
 const build=read('scripts/build.cjs');
 const a=build.indexOf("'16-live-cockpit.js'"),b=build.indexOf("'16-regisseur-cockpit.js'");
 assert.ok(a>0&&b>a);
 assert.ok(bundle.includes(fragment),'fragment ongewijzigd in de bundel');
 assert.ok(bundle.endsWith(read('src/legacy/16-regisseur-cockpit.js')));
 assert.ok(bundle.indexOf(fragment)<bundle.indexOf('function eh40Cockpit('));
});

test('v1.27 fragment: geen nieuwe globals behalve EhLiveCockpit; modules in een lokale scope',()=>{
 const {api,added}=load();
 assert.deepEqual(added,[],'geen eigenschappen op globalThis');
 assert.ok(api&&api.scope.EhPve04Model&&api.scope.EhPve04Master&&api.scope.EhHaContract&&api.scope.EhHaAdapter&&api.scope.EhPve04MasterScene);
 assert.doesNotMatch(fragment.replace(/\/\*[\s\S]*?\*\//g,''),/typeof globalThis !== 'undefined' \? globalThis : this/);
 assert.match(fragment,/sha256 aabf9c06ea7130727a30d04ac8349a41fb9f9db68d87c8016f7eb4f9cfc25565/,'herkomst model.js @ be0b299');
 assert.match(fragment,/be0b2999571c479ebf8bde3180c675319e609eea/);
});

test('v1.27 schakelaar: standaard UIT; alleen exact live_cockpit: true activeert de nieuwe Home',()=>{
 const {api}=load();
 assert.equal(api.enabled({}),false);
 for(const v of [undefined,false,'true',1,'ja',null])assert.equal(api.enabled({live_cockpit:v}),false,String(v));
 assert.equal(api.enabled({live_cockpit:true}),true);
 assert.doesNotMatch(read('src/legacy/00-foundation.js'),/live_cockpit/,'EH_DEFAULTS ongewijzigd: geen standaardactivering');
});

test('v1.27 configuratie: zelfde entiteitssleutels als de productiekaart; eigen sleutels met prefix live_cockpit_',()=>{
 const {api}=load();
 const c={net:'sensor.p',zonnepanelen:'sensor.z',huis:'sensor.h',laden:'sensor.l',cupra:'sensor.c',batterij:'sensor.b',prijs:'sensor.x',image:'genegeerd',
  live_cockpit:true,live_cockpit_image:'media-source://media_source/local/energiehuis/master.webp',live_cockpit_p1_sign:'export_positive',
  live_cockpit_route_ttl_s:{zonnepanelen:45},live_cockpit_balance_max_skew_s:20};
 assert.deepEqual(JSON.parse(JSON.stringify(api.liveConfig(c))),{net:'sensor.p',zonnepanelen:'sensor.z',huis:'sensor.h',laden:'sensor.l',cupra:'sensor.c',batterij:'sensor.b',
  p1_sign:'export_positive',image:'media-source://media_source/local/energiehuis/master.webp',route_ttl_s:{zonnepanelen:45},balance_max_skew_s:20});
 const C=api.scope.EhHaContract;
 assert.equal(C.normalizeConfig(api.liveConfig(c)).errors.length,0);
 // standaard-entiteiten van het contract = EH_DEFAULTS van de productiekaart
 const src=read('src/legacy/00-foundation.js');
 const block=src.slice(src.indexOf('const EH_DEFAULTS'),src.indexOf('};',src.indexOf('const EH_DEFAULTS')));
 for(const [k,s] of Object.entries(C.SOURCES)){
  if(k==='practice')continue;
  assert.equal(new RegExp('\\n\\s*'+s.config+":\\s*'([^']*)'").exec(block)[1],s.default,k);
 }
 // onveilige beeldbron wordt geweigerd (geen /local/, geen extern)
 for(const img of ['/local/master.webp','https://x.example/m.webp','media-source://media_source/local/../x.webp'])
  assert.ok(C.normalizeConfig(api.liveConfig({live_cockpit_image:img})).errors.length,img);
 assert.equal(api.safeResolvedUrl('/local/x.webp','http://ha.local'),null);
 assert.equal(api.safeResolvedUrl('https://evil.example/media/x','http://ha.local'),null);
 assert.equal(api.safeResolvedUrl('/media/local/x.webp?authSig=a.b','http://ha.local'),'/media/local/x.webp?authSig=a.b');
});

test('v1.27 datalogica (PVE-04 RC2) ongewijzigd beschikbaar: route-TTL, asynchrone keten, netpresentatie, voorlopig beleid',()=>{
 const {api}=load(),{EhPve04Model:M,EhHaAdapter:A,EhHaContract:C}=api.scope;
 const NOW=Date.parse('2026-11-10T12:00:00Z');
 const st=(id,v,unit,age)=>({entity_id:id,state:String(v),attributes:{unit_of_measurement:unit},last_updated:new Date(NOW-age*1000).toISOString(),last_changed:new Date(NOW-age*1000).toISOString()});
 const a=A.createAdapter({});
 const run=(v,ages={})=>M.computeModel(a.input({connected:true,states:{
  'sensor.p1_meter_vermogen':st('sensor.p1_meter_vermogen',v.net,'W',ages.net??2),
  'sensor.goodwe_pv_power':st('sensor.goodwe_pv_power',v.pv,'W',ages.pv??2),
  'sensor.energiehuis_huisverbruik_exclusief_auto':st('sensor.energiehuis_huisverbruik_exclusief_auto',v.house,'W',ages.house??2),
  'sensor.alfen_actief_vermogen_totaal':st('sensor.alfen_actief_vermogen_totaal',v.ev,'W',ages.ev??2)}},NOW));
 const ok=run({net:-380,pv:4820,house:1460,ev:2980});
 assert.deepEqual(Object.keys(ok.routes).filter(k=>ok.routes[k].active).sort(),['home-ev','home-grid','sun-home']);
 const late=run({net:-380,pv:4820,house:1460,ev:2980},{pv:600});
 assert.equal(late.routes['sun-home'].active,false);assert.equal(late.critical,false);
 const contra={net:-1880,pv:3340,house:3900,ev:0};
 assert.equal(run(contra).critical,true);
 const async=run(contra,{pv:30});
 assert.equal(async.critical,false);assert.ok(async.hold);
 assert.equal(M.netPresentation(async).value,'1,88 kW');assert.equal(M.netPresentation(async).direction,'unconfirmed');
 assert.deepEqual({...C.PROVISIONAL},{routeTtlS:true,balanceMaxSkewS:true,timestampsAreHaReports:true});
 const off=M.computeModel(a.input({connected:false,states:{}},NOW));
 assert.equal(off.status.text,'Offline');
});

test('v1.27 veiligheid: geen servicecalls, opslag, netwerk of apparaatbediening in de Live Cockpit; callWS alleen resolve_media',()=>{
 const code=fragment.replace(/const LIVE_CSS=.*\n/,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
 assert.doesNotMatch(code,/callService|callApi|\bfetch\s*\(|XMLHttpRequest|WebSocket\(|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|access_token|Authorization|auth\/sign_path|subscribeEvents|customCards|customElements\.define/);
 assert.doesNotMatch(code,/charge_control|turn_on|turn_off|set_value|\bpress\b|['"](switch|number|script|button|select|input_number|input_boolean|input_select)\.[a-z0-9_]+['"]/,'geen bediening van Alfen of andere apparatuur');
 const calls=code.match(/callWS\(\{[^}]*\}/g)||[];
 assert.equal(calls.length,1);assert.match(calls[0],/type: 'media_source\/resolve_media'/);
 assert.doesNotMatch(code,/\/local\//,'geen vaste publieke /local/-route');
 // DEMO-fixtures worden in de integratie nooit gebruikt: altijd LIVE-modus
 const integ=code.slice(code.indexOf('const C = scope.EhHaContract'));
 assert.match(integ,/mode: 'live'/);
 assert.doesNotMatch(integ,/scenarioInput|SCENARIOS|setScenario/);
});

test('v1.27 koppelingen: EnergieRegisseur overgeslagen bij actieve Live Cockpit; ontkoppelhaak in disconnectedCallback',()=>{
 assert.match(read('src/legacy/16-regisseur-cockpit.js'),/if\(this\._view!=='overview'\|\|!this\.config\|\|!this\._hass\|\|this\._ehLiveShown\)return;/);
 assert.match(read('src/legacy/02-card-shell.js'),/disconnectedCallback\(\)\{[\s\S]*?if\(typeof this\._ehLiveSuspend==='function'\)this\._ehLiveSuspend\(\);/);
 const {EnergiehuisCard}=load();
 assert.equal(typeof EnergiehuisCard.prototype._ehLiveSuspend,'function');
 // uitgeschakeld: render gaat door zonder Live Cockpit-state en zonder fouten
 const card=new EnergiehuisCard();card.config={};card._hass={states:{}};
 card._render();
 assert.equal(card.rendered,1);assert.equal(card._ehLiveShown,false);
 assert.deepEqual(JSON.parse(JSON.stringify(card._ehLive)),{ctl:null,key:'',error:null});
});

test('v1.27 integratiefixes in master.js zijn aanwezig en beperkt',()=>{
 assert.match(fragment,/\(LIVE \? 'live kaarten met actuele meetwaarden\.' : 'live DEMO-kaarten\.'\)/);
 assert.match(fragment,/e\.composedPath\(\)/);
});
