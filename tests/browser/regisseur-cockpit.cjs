'use strict';
// PR4 browser acceptance: entirely synthetic Home Assistant readings.
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.cwd()+'/energiehuis-card.js','utf8');
const html='<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522;font-family:Arial}energiehuis-card{display:block;max-width:1050px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card></html>';
const server=http.createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/card.js'?'text/javascript':'text/html');r.end(q.url==='/card.js'?source:html);});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850},locale:'nl-NL',timezoneId:'Europe/Amsterdam'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   const card=document.querySelector('energiehuis-card');
   card._schedule=()=>{};
   card._loadHistory=async()=>{};
   card._loadMetricData=async()=>{};
   card._loadCostCompare=async()=>{};
   card._loadCupraInsights=async()=>{};
   card.setConfig({mobile_fixed_navigation:false});
   const states={};
   const sensor=(id,n,unit)=>{
    if(!id)return;
    states[id]={entity_id:id,state:String(n),last_updated:new Date().toISOString(),attributes:{unit_of_measurement:unit}};
   };
   const c=card.config;
   for(const [key,value,unit] of [['net',-600,'W'],['zonnepanelen',2450,'W'],['huis',1650,'W'],['laden',420,'W'],['cupra',54,'%'],['prijs',.17,'€/kWh'],['stroom',2,'A'],['batterij',30,'%']]){
    sensor(c[key],value,unit);
   }
   card.hass={states,callWS:async()=>({}),callApi:async()=>[],callService:()=>{throw Error('Unwanted HA service call')}};
   const now=Date.now(),start=now-3*3600000;
   card._historyKey=ehDayKey(new Date())+'|cockpit';
   card._history={start,dayEnd:now+3600000,samples:Array.from({length:16},(_,i)=>({t:start+i*900000,[c.net]:-600+i*45,[c.zonnepanelen]:2400,[c.huis]:1600,[c.laden]:420}))};
   card._render();
  });
  for(const width of [390,320,768]){
   await page.setViewportSize({width,height:850});
   const info=await page.evaluate(()=>{
    const root=document.querySelector('energiehuis-card').shadowRoot;
    const cockpit=root.querySelector('.eh40-cockpit'),rect=cockpit?.getBoundingClientRect();
    return {
     cockpit:!!cockpit,
     overflow:document.documentElement.scrollWidth>innerWidth+2,
     cockpitRight:rect?.right,
     viewport:innerWidth,
     kpis:root.querySelectorAll('.eh40-kpi').length,
     spark:!!root.querySelector('.eh40-trend svg'),
     status:root.querySelector('.eh40-status')?.textContent,
     heading:root.querySelector('.eh40-top h3')?.textContent,
     chargeLink:!!root.querySelector('.eh40-footer [data-eh-page="charge"]')
    };
   });
   console.log('Cockpit viewport '+width+': '+JSON.stringify(info));
   assert.equal(info.cockpit,true);
   assert.equal(info.kpis,6);
   assert.equal(info.spark,true);
   assert.equal(info.status,'Alle bronnen actueel');
   assert.equal(info.heading,'Jouw energie, nu');
   assert.equal(info.chargeLink,true);
   assert.equal(info.overflow,false);
   assert.ok(info.cockpitRight<=info.viewport+2);
   if(width===390||width===320)await page.screenshot({path:'/tmp/eh-regisseur-'+width+'.png'});
  }
  await page.locator('energiehuis-card').evaluate(card=>{card.shadowRoot.querySelector('.eh40-kpi[data-eh-detail="grid"]').click();});
  assert.equal(await page.locator('energiehuis-card').evaluate(card=>card._detail),'grid');
  await page.locator('energiehuis-card').evaluate(card=>{card.shadowRoot.querySelector('.eh40-footer [data-eh-page="charge"]').click();});
  assert.equal(await page.locator('energiehuis-card').evaluate(card=>card._view),'charge');
  await page.locator('energiehuis-card').evaluate(card=>{
   card._view='overview';
   card._hass.states[card.config.net].last_updated=new Date(Date.now()-25*60000).toISOString();
   card._render();
  });
  assert.match(await page.locator('energiehuis-card').evaluate(card=>card.shadowRoot.querySelector('.eh40-status').textContent),/5 van 6 bronnen actueel/);
  assert.match(await page.locator('energiehuis-card').evaluate(card=>card.shadowRoot.querySelector('.eh40-kpi[data-eh-detail="grid"]').textContent),/Verouderd/);
  assert.deepEqual(errors,[]);
  console.log('PR4 read-only cockpit browser acceptance passed');
 }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
