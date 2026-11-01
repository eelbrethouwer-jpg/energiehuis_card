// Mocked P1/price sources: this is a read-only browser regression, not a live Home Assistant test.
'use strict';
const {chromium}=require(require.resolve('playwright',{paths:[process.env.EH_PLAYWRIGHT_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../energiehuis-card.js'),'utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript':'text/html');res.end(req.url==='/card.js'?source:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522}energiehuis-card{display:block;max-width:900px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card>');});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Europe/Amsterdam',locale:'nl-NL'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  const card=document.querySelector('energiehuis-card');
  const state=(unit,value)=>({state:String(value),attributes:{unit_of_measurement:unit}});
  window.serviceCalls=0;
  const h={states:{'sensor.in':state('kWh',100),'sensor.out':state('kWh',50),'sensor.price':state('€/kWh',.25)},
   callService:()=>{window.serviceCalls++;},
   callWS:async q=>{
    if(q.type==='history/history_during_period')return [];
    if(q.type!=='recorder/statistics_during_period')return {};
    const result={};
    for(const id of q.statistic_ids){
      result[id]=[];
      for(let t=Date.parse(q.start_time);t<Date.parse(q.end_time);t+=(q.period==='5minute'?300000:3600000)){
        const hour=new Date(t).getUTCHours();
        result[id].push({start:t,change:id==='sensor.in'?(hour>=12?2:0):(hour<12?2:0),mean:.25});
      }
    }
    return result;
   }};
  h.states['sensor.price'].attributes.forecast=Array.from({length:24},(_,i)=>({start:new Date(Date.parse('2026-11-01T13:00:00Z')+i*3600000).toISOString(),price:i===3?.04:.18+i*.004}));
  card.setConfig({import:'sensor.in',export:'sensor.out',prijs:'sensor.price',mobile_fixed_navigation:false});
  card.hass=h;card._view='battery';card._render();
 });
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh22-invest="10"]'));
 assert.equal(await page.locator('[data-eh26-tab="today"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.eh26-forecast-svg').count(),1);
 assert.match(await page.locator('.eh26-outlook').innerText(),/komende 24 uur/);
 await page.locator('[data-eh26-tab="returns"]').click();
 assert.match(await page.locator('.eh22-finance').innerText(),/Batterij 4.0/);
 await page.locator('[data-eh22-period="30"]').click();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._eh20Battery?.days===30&&!document.querySelector('energiehuis-card')._eh20Loading);
 await page.locator('[data-eh22-invest="10"]').fill('3500');
 await page.locator('[data-eh22-invest="10"]').blur();
 await page.waitForFunction(()=>{
  const c=document.querySelector('energiehuis-card'),root=c.shadowRoot;
  return c._eh22Investments?.[10]===3500&&root.querySelector('[data-eh22-invest="10"]')?.value==='3500'
   &&root.querySelector('.eh22-payback')?.textContent.includes('slijtagekost');
 });
 await page.locator('[data-eh22-wear]').fill('0.02');
 await page.waitForFunction(()=>document.querySelector('energiehuis-card')._eh22Wear===.02);
 await page.locator('[data-eh22-wear]').blur();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh22-payback')?.textContent.includes('terugverdientijd'));
 const state=await page.evaluate(()=>{
  const c=document.querySelector('energiehuis-card');
  return {days:c._eh20Battery.days,price:c._eh22Investments?.[10],wear:c._eh22Wear,serviceCalls:window.serviceCalls};
 });
 assert.equal(state.days,30);assert.equal(state.price,3500);assert.equal(state.wear,.02);
 assert.equal(state.serviceCalls,0);
 assert.match(await page.locator('.eh22-finance').innerText(),/30 volledige kalenderdagen|30 volledige dagen/);
 await page.locator('[data-eh26-tab="history"]').click();
 // One primary, interactive flow chart; legacy scenarios remain accessible but collapsed.
 assert.equal(await page.locator('.eh23-flow-svg').count(),1);
 assert.equal(await page.locator('.eh23-advanced').evaluate(e=>e.open),false);
 assert.match(await page.locator('.eh23-flow').innerText(),/Gesimuleerd, niet fysiek gemeten/);
 const lastDay=await page.locator('.eh23-day-nav strong').innerText();
 await page.locator('[data-eh23-step="-1"]').click();
 await page.waitForFunction(previous=>{
  const card=document.querySelector('energiehuis-card');
  return card?.shadowRoot?.querySelector('.eh23-day-nav strong')?.textContent?.trim()!==previous;
 },lastDay);
 const previousDay=await page.locator('.eh23-day-nav strong').innerText();
 assert.notEqual(previousDay,lastDay);
 const hour=page.locator('[data-eh23-hour]').nth(3);
 const hourIndex=Number(await hour.getAttribute('data-eh23-hour'));
 await page.locator('[data-eh23-hour="'+hourIndex+'"]').click();
 await page.waitForFunction(index=>document.querySelector('energiehuis-card')._eh20Selected===index,hourIndex);
 const picked=await page.evaluate(()=>document.querySelector('energiehuis-card')._eh20Selected);
 assert.equal(picked,hourIndex);
 await page.waitForFunction(index=>{
  const card=document.querySelector('energiehuis-card');
  return Number(card?.shadowRoot?.querySelector('[data-eh20-hour]')?.value)===index;
 },hourIndex);
 const range=await page.locator('[data-eh20-hour]').inputValue();
 assert.equal(Number(range),hourIndex);
 assert.match(await page.locator('.eh20-hour-detail').innerText(),/PV-lading|Ontladen/);
 // HomeWizard-style graph combines charging, discharging and simulated SOC with clear labels.
 assert.equal(await page.locator('.eh24-combined-svg').count(),1);
 assert.equal(await page.locator('.eh24-charge').count(),1);
 assert.equal(await page.locator('.eh24-discharge').count(),1);
 assert.ok(await page.locator('.eh24-combined-svg polyline[stroke="#f6f8ff"]').count()>0);
 assert.equal(await page.locator('.eh24-tabs button', {hasText:'Jaar'}).isDisabled(),true);
 await page.locator('[data-eh24-view="week"]').click();
 await page.waitForFunction(()=>document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('[data-eh24-day]').length===7);
 assert.equal(await page.locator('[data-eh24-day]').count(),7);
 await page.locator('[data-eh24-view="month"]').click();
 await page.waitForFunction(()=>{
  const c=document.querySelector('energiehuis-card');
  return c._eh24GraphPeriod==='month'&&c.shadowRoot.querySelectorAll('[data-eh24-day]').length>=21;
 },null,{timeout:7000}).catch(async error=>{
  const snapshot=await page.evaluate(()=>{
   const c=document.querySelector('energiehuis-card');
   return {mode:c._eh24GraphPeriod,index:c._eh23DayIndex,days:c._eh20Battery?.days,
    rows:c._eh20Battery?.rows?.length,buckets:c.shadowRoot.querySelectorAll('[data-eh24-day]').length,
    panel:c.shadowRoot.querySelector('.eh23-flow')?.textContent?.slice(0,200)};
  });
  throw new Error('Month chart did not render: '+JSON.stringify({snapshot,errors}));
 });
 const months=await page.locator('[data-eh24-day]').count();
 assert.ok(months>=21&&months<=30);
 const firstDay=Number(await page.locator('[data-eh24-day]').first().getAttribute('data-eh24-day'));
 await page.locator('[data-eh24-day="'+firstDay+'"]').click();
 await page.waitForFunction(index=>{
  const c=document.querySelector('energiehuis-card');
  return c._eh24GraphPeriod==='day'&&c._eh23DayIndex===index&&c.shadowRoot.querySelectorAll('[data-eh23-hour]').length>=23;
 },firstDay);
 assert.equal(await page.locator('[data-eh23-hour]').count()>=23,true);
 // Full-period SOC and old models can be opened, with no data deletion.
 await page.locator('.eh23-soc-details summary').click();
 assert.equal(await page.locator('.eh23-soc-details').evaluate(e=>e.open),true);
 await page.locator('.eh23-advanced summary').click();
 assert.equal(await page.locator('.eh23-advanced').evaluate(e=>e.open),true);
 await page.locator('.eh23-advanced summary').click();
 // Read-only Recorder quality check: only explicit click, never automated on render.
 assert.equal(await page.locator('.eh25-audit').count(),1);
 await page.locator('.eh25-audit summary').click();
 await page.locator('[data-eh25-probe]').click();
 await page.waitForFunction(()=>{
  const c=document.querySelector('energiehuis-card');
  return !c._eh25Loading&&c._eh25Audit?.five?.valid>0&&c._eh25Audit?.old?.valid>0;
 });
 assert.equal(await page.evaluate(()=>window.serviceCalls),0);
 await page.waitForFunction(()=>{
  const c=document.querySelector('energiehuis-card');
  const d=c?.shadowRoot?.querySelector('.eh25-audit');
  return d?.open&&d.textContent.includes('Vijfminutenstatistieken gisteren');
 });
 assert.equal(await page.locator('.eh25-audit').evaluate(e=>e.open),true,'audit panel should stay open after results');
 assert.match(await page.locator('.eh25-audit').innerText(),/Vijfminutenstatistieken gisteren/);
 assert.match(await page.locator('.eh25-audit').innerText(),/een compleet jaar is niet bewezen/);
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.locator('.eh20-panel').evaluate(x=>x.scrollWidth>x.clientWidth+2),false,'Overflow battery '+width);
  assert.equal(await page.locator('.eh23-flow').evaluate(x=>x.scrollWidth>x.clientWidth+2),false,'Overflow flow '+width);
 }
 assert.deepEqual(errors,[]);
 await browser.close();server.close();
 console.log('Battery 4.0 browser: 7/30-day selection, financial inputs, mobile widths and zero HA service calls OK.');
})().catch(e=>{console.error('Battery browser regression failed:',e);server.close();process.exit(1);});
