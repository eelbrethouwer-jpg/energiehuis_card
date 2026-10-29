// Run with Node + Playwright installed; fixture values are fictional.
const {chromium}=require(require.resolve('playwright',{paths:[process.env.EH_PLAYWRIGHT_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../energiehuis-card.js'),'utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/card.js'?source:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#061722}energiehuis-card{display:block;max-width:900px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card>');});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Europe/Amsterdam',locale:'nl-NL'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-29T12:00:00Z')});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  const card=document.querySelector('energiehuis-card');window.serviceCalls=0;
  const sensor=(unit,state='100')=>({state,attributes:{unit_of_measurement:unit}});
  const h={states:{'sensor.in':sensor('kWh'),'sensor.out':sensor('kWh'),'sensor.price':sensor('€/kWh','.25')},callService:()=>{window.serviceCalls++;},callWS:async q=>{
   if(q.type!=='recorder/statistics_during_period')return {};
   const result={};for(const id of q.statistic_ids){result[id]=[];for(let t=Date.parse(q.start_time);t<Date.parse(q.end_time);t+=3600000)result[id].push({start:t,change:id==='sensor.in'?2:.5,mean:.25});}return result;
  }};
  card.setConfig({import:'sensor.in',export:'sensor.out',prijs:'sensor.price',mobile_fixed_navigation:false});card.hass=h;card._view='costs';card._render();
 });
 await page.locator('[data-ehcmp-action="open"]').click();await page.locator('[data-ehcmp-action="add"]').click();
 const fill=async(name,value)=>page.locator('[data-ehcmp-form] [name="'+name+'"]').fill(value);
 await fill('name','Test vast');await fill('buy','.3');await fill('sell','.08');await fill('exportFee','.01');await fill('daily','.2');
 // State update must not destroy an unfinished form or the input focus.
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c.hass=c._hass;});
 assert.equal(await page.locator('[name="name"]').inputValue(),'Test vast');
 await page.locator('[data-ehcmp-form] button[type=submit]').click();await page.locator('.ehcmp-result').first().waitFor();
 await page.locator('[data-ehcmp-action="zonneplan"]').click();await fill('sell','.08');await fill('exportFee','.01');await fill('daily','.2');await page.locator('[data-ehcmp-form] button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length===2&&!document.querySelector('energiehuis-card')._ehcmpLoading);
 await page.locator('[data-ehcmp-period="custom"]').click();await page.locator('[data-ehcmp-date="start"]').fill('2026-10-01');await page.locator('[data-ehcmp-date="end"]').fill('2026-10-01');
 await page.locator('[data-ehcmp-date="end"]').blur();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.textContent.includes('€ 11,36')).catch(async e=>{console.log(await page.locator('.ehcmp').innerText());console.log(await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {start:c._ehcmpStart,end:c._ehcmpEnd,data:c._ehcmpData?.key,contracts:c._ehcmpContracts};}));await page.screenshot({path:'/tmp/energiehuis-stroomvergelijker.png',fullPage:true});throw e;});
 assert.match(await page.locator('.ehcmp').innerText(),/2,40 duurder/);
 await page.locator('.ehcmp-result summary').first().click();assert.match(await page.locator('.ehcmp-result').first().innerText(),/Terugleverkosten/);
 await page.locator('.ehcmp-result').first().locator('[data-ehcmp-edit]').click();await fill('daily','.3');await page.locator('[data-ehcmp-form] button[type=submit]').click();
 await page.locator('[data-ehcmp-action="transfer"]').click();const json=await page.locator('[data-ehcmp-json]').inputValue();assert.equal(JSON.parse(json).contracts.length,2);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-ehcmp-action="download"]').click();assert.equal((await downloadPromise).suggestedFilename(),'energiehuis-stroomcontracten.json');
 await page.locator('[data-ehcmp-action="import"]').click();
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  const overflow=await page.locator('.ehcmp').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false,'overflow '+width);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/energiehuis-stroomvergelijker.png',fullPage:true});
 await page.locator('[data-ehcmp-action="back"]').click();await page.locator('[data-ehcmp-action="open"]').waitFor();assert.match(await page.locator('.subpage').innerText(),/Vattenfall 1 jaar/);
 await page.locator('[data-ehcmp-action="open"]').click();page.once('dialog',d=>d.accept());await page.locator('.ehcmp-result').first().locator('summary').click();await page.locator('.ehcmp-result').first().locator('[data-ehcmp-delete]').click();
 assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length),1);
 assert.equal(await page.evaluate(()=>window.serviceCalls),0);assert.deepEqual(errors,[]);
 await browser.close();server.close();console.log('Browser OK: add/edit/delete, reference, period, live updates, export/import, return to Vattenfall, 320/390/768/1280px, no HA service calls.');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
