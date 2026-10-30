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
 // Empty required input must reach our handler and show actionable feedback, including in shadow DOM.
 await page.locator('[data-ehcmp-form] button[type=submit]').click();
 await page.locator('[data-ehcmp-error]').waitFor({state:'visible'});
 assert.match(await page.locator('[data-ehcmp-error]').innerText(),/Naam/);
 assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length),0);
 await fill('name','Test vast');await fill('buy','0,3');await fill('sell','0,08');await fill('daily','0,2');
 await page.locator('[data-ehcmp-form] button[type=submit]').click();
 assert.match(await page.locator('[data-ehcmp-error]').innerText(),/Extra terugleverkosten/);
 assert.equal(await page.locator('[name="name"]').inputValue(),'Test vast');
 await fill('exportFee','0,01');
 // A storage failure must remain visible and leave the draft available for retry.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError');};});
 await page.locator('[data-ehcmp-form] button[type=submit]').click();
 await page.locator('[data-ehcmp-error]').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length),0);
 assert.equal(await page.locator('[name="buy"]').inputValue(),'0,3');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
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
 // Fictitious catalogue fixtures isolate the UI tests from changing third-party prices.
 const rate=(value,unit='EUR/kWh')=>({bedragInclBtw:value,eenheid:unit,laatstGecontroleerd:'2026-10-25',bronUrl:'https://example.org/tarief'});
 const taxFixture={versie:1,valuta:'EUR',jaren:{2026:{geverifieerd:true,stroomPerKwh:{bedragInclBtw:.110848}}}};
 const catalogue={dynamic:{versie:1,valuta:'EUR',leveranciers:[{id:'voorbeeld',naam:'Voorbeeld dynamisch',producten:{stroom:true},tariefUrl:'https://example.org',tarieven:{stroomVastPerMaand:rate(6,'EUR/maand'),stroomInkoopopslag:rate(.02),terugleverCorrectie:rate(-.03)}}]},fixed:{valuta:'EUR',inclBtw:true,contracten:[{id:'voorbeeld-vast',leverancier:'Voorbeeld',naam:'Vast',tarieven:{stroomVastPerMaand:rate(8,'EUR/maand'),stroomLeveringPerKwh:rate(.2),terugleververgoedingPerKwh:rate(.08),terugleverkostenPerKwh:rate(.01)}}]}};
 let offline=false;
 await page.route('https://raw.githubusercontent.com/zhinees/energieprijzen-nl/main/data/**',route=>offline?route.abort():route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/leveranciers.json')?catalogue.dynamic:route.request().url().endsWith('/energiebelasting.json')?taxFixture:catalogue.fixed)}));
 await page.locator('[data-ehcat-action="open"]').click();await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('[data-ehcat-add]').length===2);assert.equal(await page.locator('[data-ehcat-add]').count(),2);
 await page.locator('[data-ehcat-filter]').selectOption('fixed');await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('[data-ehcat-add]').length===1);assert.equal(await page.locator('[data-ehcat-add]').count(),1);
 await page.locator('[data-ehcat-advanced] summary').click();await page.locator('[data-ehcat-add]').click();await fill('tax','.12');await page.locator('[data-ehcmp-form] button[type=submit]').click();assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length),1);
 await page.locator('[name="sourceConfirmed"]').check();await page.locator('[data-ehcmp-form] button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length===2);
 const saved=await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.find(c=>c.source));assert.equal(saved.buy,.32);assert.equal(saved.monthly,8);assert.equal(saved.source.fields.length,4);
 await page.locator('[data-ehcat-action="open"]').click();await page.locator('[data-ehcat-filter]').selectOption('dynamic');await page.locator('[data-ehcat-advanced] summary').click();await page.locator('[data-ehcat-add^="dynamic-"]').click();await fill('tax','.12');await fill('priceEntity','sensor.market');
 await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c._hass.states['sensor.market']={state:'.25',attributes:{unit_of_measurement:'€/kWh'}};});
 await page.locator('[name="sourceConfirmed"]').check();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('.ehcmp').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'catalogue form overflow '+width);}
 await page.locator('[data-ehcmp-form] button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length===3&&!document.querySelector('energiehuis-card')._ehcmpLoading);
 await page.locator('[data-ehcat-action="open"]').click();offline=true;await page.locator('[data-ehcat-action="refresh"]').click();await page.locator('.ehcat [role="alert"]').waitFor();assert.equal(await page.locator('[data-ehcat-add]').count(),1);assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.length),3);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/energiehuis-aanbiederstarieven.png',fullPage:true});
 assert.equal(await page.evaluate(()=>window.serviceCalls),0);assert.deepEqual(errors,[]);
 // Nieuw standaardpad: selecteer contract en klik uitsluitend op opslaan, zonder formulieren.
 await page.locator('[data-ehcat-filter]').selectOption('fixed');
 await page.locator('[data-ehcat-select]').selectOption('fixed-voorbeeld-vast');
 await page.waitForFunction(()=>!document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-ehcat-action="save-selected"]')?.disabled);
 await page.locator('[data-ehcat-action="save-selected"]').click();
 const fastFixed=await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.find(c=>c.id==='catalog-fixed-voorbeeld-vast'));
 assert.ok(fastFixed);assert.equal(fastFixed.pending,undefined);
 assert.ok(Math.abs(fastFixed.buy-.310848)<1e-9);
 await page.locator('[data-ehcat-action="open"]').click();
 await page.locator('[data-ehcat-filter]').selectOption('dynamic');
 await page.locator('[data-ehcat-select]').selectOption('dynamic-voorbeeld');
 await page.locator('[data-ehcat-action="save-selected"]').click();
 const fastDynamic=await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpContracts.find(c=>c.id==='catalog-dynamic-voorbeeld'));
 assert.equal(fastDynamic.priceEntity,'sensor.market');
 assert.equal(fastDynamic.pending,undefined);
 assert.equal(await page.evaluate(()=>window.serviceCalls),0);assert.deepEqual(errors,[]);
 if(process.env.EH_TEST_LIVE_TARIFFS==='1'){await page.locator('[data-ehcat-action="open"]').click();await page.unroute('https://raw.githubusercontent.com/zhinees/energieprijzen-nl/main/data/**');await page.locator('[data-ehcat-action="refresh"]').click();await page.waitForFunction(()=>!document.querySelector('energiehuis-card')._ehcatLoading);const live=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {error:c._ehcatError,count:c._ehcatEntries?.length};});assert.equal(live.error,'');assert.ok(live.count>0);console.log('Live tariff endpoints + CORS + schema OK: '+live.count+' offers');await page.screenshot({path:'/tmp/energiehuis-aanbiederstarieven-live.png',fullPage:true});}
 // Persistence must survive a real page reload, independently of Recorder data.
 const beforeReload=await page.evaluate(()=>JSON.stringify(document.querySelector('energiehuis-card')._ehcmpContracts));
 await page.reload();
 await page.evaluate(()=>document.querySelector('energiehuis-card')._ehcmpInit());
 assert.equal(await page.evaluate(()=>JSON.stringify(document.querySelector('energiehuis-card')._ehcmpContracts)),beforeReload);
 await browser.close();server.close();console.log('Browser OK: add/edit/delete, reference, period, live updates, export/import, return to Vattenfall, 320/390/768/1280px, no HA service calls; catalogue fetch/filter, fixed and dynamic draft, source confirmation, monthly fees, network failure and form widths.');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
