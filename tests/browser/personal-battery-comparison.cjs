// Fictitious meter data only. No user CSV or consumption history in this repository.
'use strict';
const {chromium}=require(require.resolve('playwright',{paths:[process.env.EH_PLAYWRIGHT_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../energiehuis-card.js'),'utf8');
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522}energiehuis-card{display:block;max-width:1100px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript':'text/html');res.end(req.url==='/card.js'?source:html);});
const head='time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh';
// A bounded 2025 calendar year, .1 kWh import / .05 export per quarter.
let csv=head+'\n',imp=100,exp=50;
const wall=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
for(let t=Date.parse('2024-12-31T23:00Z');t<=Date.parse('2025-12-31T23:00Z');t+=900000){
 const label=wall.format(new Date(t));
 csv+=label+','+imp.toFixed(3)+',0,'+exp.toFixed(3)+',0\n';imp+=.1;exp+=.05;
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:900},timezoneId:'Europe/Amsterdam',locale:'nl-NL'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  window.calls=0;window.hostHass={states:{},callService:()=>{window.calls++;},callWS:async()=>({})};
  const c=document.querySelector('energiehuis-card');c.setConfig({mobile_fixed_navigation:false});
  c.hass=window.hostHass;c._view='battery';c._eh26Tab='compare';c._render();
 });
 await page.locator('[data-eh31-file]').setInputFiles({name:'fictieve-kwartierdata.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await page.waitForFunction(()=>!!document.querySelector('energiehuis-card')._eh31History&&!document.querySelector('energiehuis-card')._eh31Loading);
 assert.match(await page.locator('.eh31-card').first().innerText(),/kwartier|stroomprofiel/i);
 assert.equal(await page.locator('.eh31-season').count(),1);
 assert.match(await page.locator('.eh31-results').innerText(),/standbyverbruik/);
 await page.locator('.eh31-profiles > summary').click();
 for(let i=0;i<3;i++){
  const input=page.locator('[data-eh31-profile="'+i+'"][data-eh31-field="standby"]');
  await input.fill('0');await input.blur();
  await page.waitForFunction(i=>document.querySelector('energiehuis-card')._eh31Settings.profiles[i].standby===0,i);
 }
 await page.locator('[data-eh31-profile="0"][data-eh31-field="name"]').fill('Mijn <accu>');
 await page.locator('[data-eh31-profile="0"][data-eh31-field="name"]').blur();
 await page.locator('.eh31-rates > summary').click();
 await page.locator('[data-eh31-rate="buy"]').fill('0.30');await page.locator('[data-eh31-rate="buy"]').blur();
 await page.locator('[data-eh31-rate="sell"]').fill('0.10');await page.locator('[data-eh31-rate="sell"]').blur();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._eh31Settings.sell===.1);
 assert.match(await page.locator('.eh31-results').innerText(),/Mijn <accu>/);
 assert.match(await page.locator('.eh31-results').innerText(),/Nog niet verantwoord/);
 assert.doesNotMatch(await page.locator('.eh31-results').innerText(),/Tariefinvoer ontbreekt/);
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c.hass={...window.hostHass};c._render();});
 assert.equal(await page.locator('.eh31-profiles').evaluate(e=>e.open),true);
 assert.equal(await page.locator('.eh31-rates').evaluate(e=>e.open),true);
 assert.equal(await page.locator('.eh31-results article').count(),3);
 // Browser stores only profile/rate settings, never file contents or meter history.
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('energiehuis:battery-comparison:v1')));
 assert.deepEqual(Object.keys(stored).sort(),['buy','profiles','sell']);
 assert.equal(stored.profiles[0].name,'Mijn <accu>');
 assert.equal(stored.profiles[0].standby,0);
 // Invalid replacement preserves the last successful import, with a visible error.
 await page.locator('[data-eh31-file]').setInputFiles({name:'ongeldig.csv',mimeType:'text/csv',buffer:Buffer.from('time,wrong\n1,2')});
 await page.waitForFunction(()=>!!document.querySelector('energiehuis-card')._eh31Error);
 assert.equal(await page.locator('.eh31-compare [role=alert]').count(),1);
 assert.equal(await page.locator('.eh31-season').count(),1);
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.locator('.eh31-compare').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'Comparison overflow '+width);
 }
 await page.locator('[data-eh31-clear]').click();
 await page.waitForFunction(()=>!document.querySelector('energiehuis-card')._eh31History);
 assert.equal(await page.locator('.eh31-season').count(),0);
 // Reopen page to verify settings persist while history does not.
 await page.reload();
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c.setConfig({});c.hass={states:{}};c._view='battery';c._eh26Tab='compare';c._render();});
 assert.equal(await page.locator('[data-eh31-profile="0"][data-eh31-field="name"]').inputValue(),'Mijn <accu>');
 assert.equal(await page.locator('.eh31-season').count(),0);
 assert.deepEqual(errors,[]);
 await browser.close();server.close();console.log('Personal battery comparison: CSV import, counter/DST replay, settings-only persistence, clear, expansion and responsive widths OK.');
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
