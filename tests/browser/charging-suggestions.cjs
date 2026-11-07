// Synthetic Alfen readings and sessions only. No live HA connection or charging commands.
'use strict';
const {chromium}=require(require.resolve('playwright',{paths:[process.env.EH_PLAYWRIGHT_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../energiehuis-card.js'),'utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/card.js'?source:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522;font-family:Arial}energiehuis-card{display:block;max-width:1100px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card>');});
let browser;
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:900},timezoneId:'Europe/Amsterdam',locale:'nl-NL'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Keep synthetic wall-clock time fixed, but allow real requestAnimationFrame for _schedule().
 await page.clock.setFixedTime(new Date('2026-11-07T18:00:00Z'));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  const c=document.querySelector('energiehuis-card');c.setConfig({mobile_fixed_navigation:false,ev_charge_efficiency:.8});
  const state=(n,u)=>({state:String(n),last_updated:new Date().toISOString(),attributes:{unit_of_measurement:u}});
  const conf=c.config,states={[conf.laden]:state(7360,'W'),[conf.huis]:state(4000,'W'),[conf.net]:state(6000,'W'),[conf.cupra]:state(50,'%'),[conf.prijs]:state(.25,'€/kWh')};
  states[conf.prijs].attributes.forecast=Array.from({length:24},(_,i)=>({start:new Date(Math.floor(Date.now()/3600000)*3600000+i*3600000).toISOString(),price:.2+(i%4)*.04}));
  window.serviceCalls=0;c._hass={states,callWS:async()=>({}),callService(){window.serviceCalls++;}};
  c._view='charge';c._departure='2026-11-08T09:00';c._simNeed=20.7;c._simPower=3.7;c._eh17SessionsLoading=true;
  c._eh17Sessions={at:Date.now(),sessions:[6,7,8].map((kw,i)=>({start:Date.now()-(i+1)*86400000,end:Date.now()-(i+1)*86400000+2*3600000,kwh:kw*2,estimated:false}))};
  c._render();
 });
 const card=()=>page.locator('energiehuis-card');
 assert.equal(await page.locator('[data-eh-kw]').inputValue(),'3.7','Rendering suggestions must not fill the input');
 const choices=page.locator('.eh23-power-choice');assert.equal(await choices.count(),2);
 assert.equal(await choices.first().getAttribute('data-eh23-power'),'current');
 assert.equal(await choices.first().getAttribute('aria-pressed'),'false','Suggestie is niet vooraf geselecteerd');
 assert.match(await choices.first().innerText(),/7,36 kW/);
 assert.match(await page.locator('.eh23-power-limit').innerText(),/Aansluitgrens: 4,74 kW/);
 assert.equal(await page.locator('.eh23-power-limit').count(),1,'Only one shared limit note is rendered');
 assert.match(await page.locator('.eh23-power-limit').innerText(),/Hogere keuzes rekent de simulatie tot dit vermogen/);
 assert.match(await page.locator('.eh23-power-limit').innerText(),/Simulatiegrens; Alfen Active Load Balancing bepaalt het werkelijke vermogen/);
 assert.doesNotMatch(await page.locator('.eh23-power-limit').innerText(),/Voor dit scenario begrensd/);
 assert.doesNotMatch(await choices.first().innerText(),/Aansluitgrens: 4,74 kW/,'Limit note is not repeated in buttons');
 assert.match(await page.locator('.eh23-power-suggestions').innerText(),/Mediaan uit 3/);
 assert.match(await page.locator('.charge-page').innerText(),/Inclusief laadverlies \(rendement 80%\)/);
 assert.match(await page.locator('.eh17-option').last().innerText(),/PV-prognose ontbreekt/);
 assert.doesNotMatch(await page.locator('.eh17-option').last().innerText(),/Geen tijdvakken met voldoende/);
 assert.match(await page.locator('.eh23-window-note').innerText(),/geen berekende actieve laadtijd/);
 await page.locator('[data-eh23-power="current"]').click();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._simPower===7.36);
 // _schedule() uses requestAnimationFrame; await actual DOM commit, not only in-memory state.
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')?.shadowRoot?.querySelector('[data-eh-kw]')?.value==='7.36');
 assert.equal(await page.locator('[data-eh-kw]').inputValue(),'7.36');
 assert.equal(await page.locator('[data-eh23-power="current"]').getAttribute('aria-pressed'),'true');
 // Manual input stays authoritative across sensor updates and rerendering.
 await page.locator('[data-eh-kw]').fill('5.5');await page.locator('[data-eh-kw]').blur();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._simPower===5.5);
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh23-power="current"]')?.getAttribute('aria-pressed')==='false');
 assert.equal(await page.locator('[data-eh23-power="current"]').getAttribute('aria-pressed'),'false','Handmatig vermogen verwijdert selectie');
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.laden].state='4200';c._render();});
 assert.equal(await page.locator('[data-eh-kw]').inputValue(),'5.5');
 await page.locator('[data-eh23-power="history"]').click();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._simPower===7);
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh23-power="history"]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('[data-eh23-power="history"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.laden].state='0';c._eh17Sessions.sessions[2].estimated=true;c._render();});
 assert.equal(await page.locator('[data-eh23-power="current"]').isDisabled(),true);
 assert.equal(await page.locator('[data-eh23-power="history"]').count(),0,'Two measured sessions are insufficient');
 assert.equal(await page.locator('[data-eh-kw]').inputValue(),'7');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page overflow '+width);
  for(const selector of ['[data-eh20-action="start"]','[data-eh20-action="pause"]'])assert.ok((await page.locator(selector).boundingBox()).height>=44,'44px control target '+width);
  const chip=await page.locator('.eh20-state').evaluate(e=>({style:getComputedStyle(e).borderTopStyle,width:parseFloat(getComputedStyle(e).borderTopWidth)}));
  assert.equal(chip.style,'solid');assert.ok(chip.width>=1);
 }
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.laden].state='7360';c._eh17Sessions.sessions[2].estimated=false;c._render();});
 // Negatief huisverbruik wordt niet gebruikt als nul; er geldt zichtbaar een 2000 W-aanname.
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.huis].state='-500';c._render();});
 assert.match(await page.locator('.eh23-power-limit').innerText(),/Huisbelasting negatief; niet gebruikt \(aanname 2000 W\)/);
 assert.match(await page.locator('.eh23-power-limit').innerText(),/Aansluitgrens: 6,74 kW/);
 // Verouderde Alfenmeting mag niet als huidige keuze beschikbaar blijven.
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.laden].last_updated=new Date(Date.now()-3*60000).toISOString();c._render();});
 assert.equal(await page.locator('[data-eh23-power="current"]').isDisabled(),true);
 assert.match(await page.locator('.eh24-meter-warning').innerText(),/Alfen-meting is verouderd/);
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states[c.config.huis].state='4000';c._hass.states[c.config.laden].last_updated=new Date().toISOString();c._render();});
 await page.screenshot({path:'/tmp/energiehuis-charge-suggestions.png',fullPage:true});
 assert.equal(await page.evaluate(()=>window.serviceCalls),0);assert.deepEqual(errors,[]);
 console.log('Charging UI OK: explicit Alfen/history choice, manual precedence, bounded display, inactive/estimated sessions, 44px controls, responsive widths and zero HA writes.');
} )().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
