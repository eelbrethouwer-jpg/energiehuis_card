'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../energiehuis-card.js'),'utf8');
const registry=new Map();
const ctx={console,Date,Math,Map,Set,Array,Object,Number,String,JSON,
 window:{customCards:[],navigator:{onLine:true}},
 customElements:{get:n=>registry.get(n),define:(n,x)=>registry.set(n,x)},
 HTMLElement:class{attachShadow(){return {addEventListener(){}};}}};
vm.runInNewContext(src+'\n;globalThis.QUALITY={eh25AuditSummary,eh25ProbeCoverage,eh25AuditHtml,EnergiehuisCard};',ctx);
const {eh25AuditSummary,eh25ProbeCoverage,eh25AuditHtml,EnergiehuisCard}=ctx.QUALITY;
const now=Date.parse('2026-10-26T00:00:00Z'),ids=['sensor.import','sensor.export'];
const row=(i,valid=true,price=.2)=>({t:now+i*3600000,end:now+(i+1)*3600000,import:valid?1:null,export:valid?0:null,price});
test('coverage rekent alleen echte complete P1-data, prijzen worden apart gemeld',()=>{
 const rows=Array.from({length:72},(_,i)=>row(i,i!==13,i%2===0?.20:null));
 const s=eh25AuditSummary(rows);
 assert.equal(s.total,72);assert.equal(s.valid,71);assert.equal(s.prices,36);
 assert.equal(s.completeDays,2);
 assert.match(eh25AuditHtml({_eh22Days:7},{callWS(){}},{import:ids[0],export:ids[1]},rows),/71 \/ 72/);
 assert.match(eh25AuditHtml({_eh22Days:7},{callWS(){}},{import:ids[0],export:ids[1]},rows),/36 \/ 71/);
});
test('5-minutencontrole vereist P1-afname én teruglevering op hetzelfde interval',()=>{
 const from=now,to=from+3600000;
 const positions=Array.from({length:12},(_,i)=>new Date(from+i*300000).toISOString());
 const reply={};
 reply[ids[0]]=positions.map(start=>({start,change:0}));
 reply[ids[1]]=positions.slice(0,10).map(start=>({start,change:0}));
 const check=eh25ProbeCoverage(reply,ids,from,to,5);
 assert.equal(check.expected,12);assert.equal(check.valid,10);
 assert.ok(Math.abs(check.coverage-10/12)<1e-9);
 reply[ids[1]].push({start:positions[10],change:-8});
 assert.equal(eh25ProbeCoverage(reply,ids,from,to,5).valid,10);
});
test('geen resultaten worden gepresenteerd als bestaand jaarbewijs',()=>{
 const html=eh25AuditHtml({_eh25Audit:{five:{valid:280,expected:288,coverage:280/288},old:{valid:160,expected:168,coverage:160/168}}},{callWS(){}},{import:ids[0],export:ids[1]},[]);
 assert.match(html,/een compleet jaar is niet bewezen/);
 assert.match(html,/Steekproef, geen validatie van een compleet jaar/);
});
test('de controle is alleen-lezen, expliciet en loopt niet automatisch bij kaart-render',()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card.isConnected=true;card.config={import:ids[0],export:ids[1]};
 let calls=[],scheduled=0,services=0;
 card._schedule=()=>{scheduled++};
 card._hass={callWS:async q=>{
  calls.push(q);
  const ans={};
  for(const id of q.statistic_ids){
   ans[id]=[];
   for(let t=Date.parse(q.start_time);t<Date.parse(q.end_time);t+=q.period==='5minute'?300000:3600000)ans[id].push({start:t,change:.1});
  }
  return ans;
 },callService(){services++}};
 return Promise.resolve().then(async()=>{
  assert.equal(calls.length,0);
  await card._eh25LoadAudit();
  assert.equal(calls.length,2);
  assert.deepEqual(calls.map(q=>q.period).sort(),['5minute','hour']);
  assert.ok(card._eh25Audit.five.coverage>=.99);
  assert.ok(card._eh25Audit.old.coverage>=.99);
  assert.equal(services,0);assert.ok(scheduled>0);
 });
});
test('individuele recorderfout laat andere steekproef staan',async()=>{
 const card=Object.create(EnergiehuisCard.prototype);
 card.isConnected=true;card.config={import:ids[0],export:ids[1]};
 card._schedule=()=>{};
 card._hass={callWS:async q=>{
  if(q.period==='5minute')throw Error('unsupported');
  return {[ids[0]]:[],[ids[1]]:[]};
 }};
 await card._eh25LoadAudit();
 assert.equal(card._eh25Audit.five,null);
 assert.match(card._eh25Audit.fiveError,/Geen toegang/);
 assert.equal(card._eh25Audit.old.valid,0);
});
