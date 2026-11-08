// Synthetic sensor data only; no live Home Assistant connection.
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
const source=fs.readFileSync(process.cwd()+'/energiehuis-card.js','utf8');
const server=http.createServer((q,r)=>{r.setHeader('Content-Type',q.url==='/card.js'?'text/javascript':'text/html');r.end(q.url==='/card.js'?source:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522;font-family:Arial}energiehuis-card{display:block;max-width:1100px;margin:auto}</style><script src="/card.js"></script><energiehuis-card></energiehuis-card>');});
(async()=>{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:390,height:900},locale:'nl-NL',timezoneId:'Europe/Amsterdam'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');c.setConfig({mobile_fixed_navigation:false});const states={};const sensor=(id,n,unit,attrs={})=>states[id]={entity_id:id,state:String(n),last_updated:new Date().toISOString(),attributes:{unit_of_measurement:unit,...attrs}};
const conf=c.config;for(const [key,n,unit] of [['net',-450,'W'],['zonnepanelen',2500,'W'],['huis',1600,'W'],['laden',450,'W'],['cupra',52,'%'],['batterij',35,'%'],['stroom',2,'A'],['gas_today',1.2,'m³'],['gas',3000,'m³']])sensor(conf[key],n,unit);
const start=Math.floor(Date.now()/3600000)*3600000;const forecast=Array.from({length:48},(_,i)=>({start:new Date(start+i*3600000).toISOString(),price:.15+(i%8)*.03}));sensor(conf.prijs,.25,'€/kWh',{forecast});
c._schedule=()=>{};c.hass={states,callWS:async()=>({}),callApi:async()=>[],callService:()=>{throw Error('Unexpected HA write')}};c._departure=new Date(Date.now()+15*3600000).toISOString().slice(0,16);c._simNeed=30;c._simPower=3.7;c._eh17SessionsLoading=true;c._eh17Sessions={at:Date.now(),sessions:[],meta:{from:null}};
const rows=Array.from({length:168},(_,i)=>({t:start-(168-i)*3600000,end:start-(167-i)*3600000,import:.5,export:i%24>9&&i%24<16?.8:0,price:.2}));c._eh20Battery={at:Date.now(),days:7,rows};c._eh20Loading=true;c._eh17BatteryLoading=true;c._historyError='';c._render();});
for(const width of [390,320,768,1280]){await page.setViewportSize({width,height:900});for(const view of ['overview','cupra','charge','battery','costs','more']){await page.evaluate(v=>{const c=document.querySelector('energiehuis-card');c._view=v;c._render();},view);const info=await page.evaluate(()=>{const root=document.querySelector('energiehuis-card').shadowRoot;const visible=e=>e.checkVisibility({visibilityProperty:true,contentVisibilityAuto:true})&&!!e.getClientRects().length;const elements=[...root.querySelectorAll('*')].filter(visible);return {overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:elements.filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(e=>[e.tagName,e.className.baseVal??e.className,Math.round(e.getBoundingClientRect().right)]),heads:[...root.querySelectorAll('h2')].filter(visible).map(e=>e.textContent),chips:elements.filter(e=>e.matches('.eh19-connection')).map(e=>e.textContent),first:elements.find(e=>e.matches('.eh40-kpi strong,.metric-value,.cupra-big,.eh17-option strong,.eh26-overview strong,.subcard strong,.utility-head strong'))?.getBoundingClientRect().top,hero:root.querySelector('.hero')?.getBoundingClientRect().height,text:root.innerText||root.textContent};});console.log(JSON.stringify({width,view,...info,text:undefined}));if(width===390){await page.screenshot({path:'/tmp/eh-'+view+'.png',fullPage:true});}assert.equal(info.overflow,false,view+' overflow '+width);assert.ok(info.offenders.length===0,view+' offenders '+width);assert.equal(info.heads.length,1,view+' heading count');assert.equal(info.chips.length,1,view+' status chip');assert.ok(!info.hero||info.hero<=100,'compact hero');assert.ok(info.first===undefined||info.first<600,view+' first metric');assert.doesNotMatch(info.text,/Slim laden 2\.[01]|ontwerpen we/);if(view==='overview'){const initial=await page.locator('energiehuis-card').evaluate(card=>{const root=card.shadowRoot;return {legacyOpen:root.querySelector('.eh26-legacy')?.open,navCount:root.querySelectorAll('.nav > .navitem').length,netValue:root.querySelector('.eh40-kpi[data-eh-detail="grid"] strong')?.textContent};});assert.equal(initial.legacyOpen,width!==390,'Legacy starts collapsed and retains expanded state after navigation and resizing');assert.equal(initial.navCount,4,'Four mobile navigation destinations');assert.match(initial.netValue,/W/,'Actual P1 value remains visible');await page.locator('energiehuis-card').evaluate(card=>{card.shadowRoot.querySelector('.eh26-legacy').open=true;});assert.equal(await page.locator('.metric-grid .metric-sub').isVisible(),true,'Net direction label in expanded legacy details');assert.equal(await page.locator('.metric-water').count(),0,'Unconfigured water tile');const old=await page.locator('energiehuis-card').evaluate(card=>{const root=card.shadowRoot,tiles=[...root.querySelectorAll('.body .metrics > .metric')],first=tiles[0];return {count:tiles.length,label:first?.querySelector('.metric-label')?.textContent,detail:first?.dataset.ehDetail,height:first?.getBoundingClientRect().height,visible:first?getComputedStyle(first).display!=='none':false};});assert.ok(old.count>=6,'Original legacy metric tiles must remain');assert.equal(old.label,'Netvermogen','Original first tile retained');assert.equal(old.detail,'grid','Original first tile still navigates to net detail');assert.ok(old.height>0&&old.visible,'Original first tile available after expanding details');}}}
const insights=await page.locator('energiehuis-card').evaluate(card=>{card._view='overview';card._render();const root=card.shadowRoot;root.querySelector('[data-eh26-insights]').click();card._render();const menu=card.shadowRoot.querySelector('.eh26-insight-menu');const destinations=[...menu.querySelectorAll('[data-eh-page]')].map(x=>x.dataset.ehPage);menu.querySelector('[data-eh-page="costs"]').click();card._render();return {destinations,view:card._view,open:!!card.shadowRoot.querySelector('.eh26-insight-menu')};});
assert.deepEqual(insights.destinations,['cupra','battery','costs'],'All historical insight destinations remain accessible');
assert.equal(insights.view,'costs','Cost page opens from Inzicht menu');
assert.equal(insights.open,false,'Menu closes after navigation');

// Claude review regression suite: use actual keyboard, pointer and DOM interactions.
await page.setViewportSize({width:390,height:900});
await page.locator('energiehuis-card').evaluate(c=>{c._view='overview';c._eh26MenuOpen=false;c._render();});
await page.locator('[data-eh26-insights]').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>{
 const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;
 return !!r.querySelector('.eh26-insight-menu')&&r.activeElement?.dataset.ehPage==='cupra';
});
assert.equal(await page.locator('[data-eh26-insights]').getAttribute('aria-haspopup'),'dialog','Insights controls have popup semantics');
assert.equal(await page.locator('.eh26-insight-menu').getAttribute('role'),'dialog','Insights list has dialog role');
await page.locator('energiehuis-card').evaluate(c=>c._render());
assert.equal(await page.locator('energiehuis-card').evaluate(c=>c.shadowRoot.activeElement?.dataset.ehPage),'cupra','Focused menu item survives synchronous HA rerender');
await page.keyboard.press('Escape');
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>{
 const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;
 return !r.querySelector('.eh26-insight-menu')&&r.activeElement?.dataset.eh26Insights==='1';
});
await page.evaluate(()=>{
 document.body.tabIndex=-1;document.body.focus();
 const c=document.querySelector('energiehuis-card');
 c._eh26MenuOpen=true;c._render();
});
assert.equal(await page.locator('.eh26-insight-menu').count(),1,'Fixture opens menu with body focused');
await page.keyboard.press('Escape');
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>!document.querySelector('energiehuis-card')._eh26MenuOpen);
assert.equal(await page.locator('.eh26-insight-menu').count(),0,'Escape on document body closes menu');
await page.evaluate(()=>{
 const outside=document.createElement('button');
 outside.id='eh26-external-focus';outside.textContent='Outside Home Assistant';
 document.body.appendChild(outside);
});
await page.locator('[data-eh26-insights]').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>!!document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu'));
await page.locator('#eh26-external-focus').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>!document.querySelector('energiehuis-card')._eh26MenuOpen);
assert.equal(await page.locator('.eh26-insight-menu').count(),0,'Outside pointer closes insights menu');
await page.locator('[data-eh26-insights]').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>!!document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu'));
await page.locator('#eh26-external-focus').focus();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>!document.querySelector('energiehuis-card')._eh26MenuOpen);
assert.equal(await page.locator('.eh26-insight-menu').count(),0,'Outside focus closes insights menu');
await page.locator('energiehuis-card').evaluate(c=>{
 c._view='overview';c._detail=null;c._eh40PinnedDetail=null;c._render();
 c.shadowRoot.querySelector('.eh26-legacy').open=true;
});
await page.locator('.eh26-legacy .metric[data-eh-detail="grid"]').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
await page.waitForFunction(()=>{
 const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;
 return c._detail==='grid'&&r.querySelector('.eh26-legacy')?.open&&!!r.querySelector('.eh26-legacy .detail-panel');
});
await page.locator('energiehuis-card').evaluate(c=>c._render());
const legacy=await page.locator('energiehuis-card').evaluate(c=>{
 const r=c.shadowRoot,details=r.querySelector('.eh26-legacy'),pane=details.querySelector('.detail-panel');
 return {expanded:details.open,inside:!!pane,directChild:pane?.parentElement===details,net:!!details.querySelector('.metrics .metric[data-eh-detail="grid"]'),chart:!!details.querySelector('.chart-panel')};
});
assert.equal(legacy.expanded,true,'Legacy details stay open through synchronous rerender');
assert.equal(legacy.inside,true,'Legacy detail is inside expanded section');
assert.equal(legacy.directChild,true,'Legacy detail is directly after meter cards');
assert.equal(legacy.net,true,'Legacy meter buttons remain available');
assert.equal(legacy.chart,true,'Legacy historical graph remains available');


// N2: collapsing a legacy detail clears hidden state and the next cockpit click opens it.
await page.locator('.eh26-legacy > summary').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
const collapsed=await page.locator('energiehuis-card').evaluate(c=>({
 open:c.shadowRoot.querySelector('.eh26-legacy')?.open,detail:c._detail,
 legacyDetail:c._eh26LegacyDetail
}));
assert.equal(collapsed.open,false,'All measurements can be collapsed');
assert.equal(collapsed.detail,null,'Closing legacy details clears hidden selected meter');
assert.equal(collapsed.legacyDetail,null,'Legacy marker is cleared with collapse');
await page.locator('.eh40-kpi[data-eh-detail="grid"]').click();
await page.locator('energiehuis-card').evaluate(c=>c._render());
const reopened=await page.locator('energiehuis-card').evaluate(c=>({
 detail:c._detail,
 cockpitPane:c.shadowRoot.querySelector('.eh40-cockpit')?.nextElementSibling?.classList.contains('detail-panel')
}));
assert.equal(reopened.detail,'grid','First cockpit tap after legacy collapse opens detail');
assert.equal(reopened.cockpitPane,true,'Detail is shown at cockpit');

// N3: inspect actual computed labels (not font-size declarations on parent buttons).
for(const width of [320,390]){
 await page.setViewportSize({width,height:900});
 await page.locator('energiehuis-card').evaluate(c=>{c._view='overview';c._render();});
 const typography=await page.locator('energiehuis-card').evaluate(c=>{
  const root=c.shadowRoot;
  const measure=selector=>[...root.querySelectorAll(selector)].map(el=>({
    text:el.textContent.trim(),font:parseFloat(getComputedStyle(el).fontSize)
   }));
  return {
   nav:measure('.nav .eh26-navitem > span'),
   shortcuts:measure('.eh40-footer nav button')
  };
 });
 assert.equal(typography.nav.length,4,'Four mobile navigation labels');
 assert.equal(typography.shortcuts.length,3,'Three cockpit shortcuts');
 assert.ok(typography.nav.every(v=>v.font>=11),
  'At '+width+'px nav labels need >=11px computed font: '+JSON.stringify(typography.nav));
 assert.ok(typography.shortcuts.every(v=>v.font>=11),
  'At '+width+'px quicklinks need >=11px computed font: '+JSON.stringify(typography.shortcuts));
}

// N1: real custom-element disconnect lifecycle, 10 separate instances,
// document listener accounting, recreation and genuine rAF-driven hass update.
const lifecycle=await page.evaluate(async()=>{
 const original=document.querySelector('energiehuis-card');
 const add=document.addEventListener.bind(document);
 const remove=document.removeEventListener.bind(document);
 const types=new Set(['pointerdown','focusin','keydown']);
 const added=[],removed=[];
 document.addEventListener=function(type,fn,capture){
  if(types.has(type)&&capture===true)added.push([type,fn]);
  return add(type,fn,capture);
 };
 document.removeEventListener=function(type,fn,capture){
  if(types.has(type)&&capture===true)removed.push([type,fn]);
  return remove(type,fn,capture);
 };
 const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const container=document.createElement('div');
 container.id='eh26-ten-card-lifecycle';
 document.body.appendChild(container);
 const created=[];
 const create=()=>{
  const card=document.createElement('energiehuis-card');
  card._loadHistory=()=>{};
  card._loadMetricData=()=>{};
  card._loadCostCompare=()=>{};
  card._loadCupraInsights=()=>{};
  // Do not stub _schedule: exercise the actual requestAnimationFrame path.
  card.setConfig({mobile_fixed_navigation:false});
  card.hass=original._hass;
  container.appendChild(card);
  created.push(card);
  return card;
 };
 try{
  for(let i=0;i<10;i++)create();
  await raf();await raf();
  const mounted=created.filter(c=>!!c._eh26DocumentHandlers).length;
  const first=created[0],id=first.config.net;
  const before=first.shadowRoot.querySelector('.eh40-kpi[data-eh-detail="grid"] strong')?.textContent;
  const state=first._hass.states[id];
  first.hass={...first._hass,states:{...first._hass.states,[id]:{
   ...state,state:'321',last_updated:new Date().toISOString()
  }}};
  await raf();await raf();
  const after=first.shadowRoot.querySelector('.eh40-kpi[data-eh-detail="grid"] strong')?.textContent;
  container.replaceChildren();
  await raf();
  const detached=created.filter(c=>c._eh26DocumentHandlers===null).length;
  const countAfterTen={added:added.length,removed:removed.length};
  const another=create();
  await raf();await raf();
  another.remove();
  await raf();
  return {
   mounted,detached,countAfterTen,
   added:added.length,removed:removed.length,
   exactPairs:added.every(([type,fn])=>removed.some(([kind,cb])=>kind===type&&cb===fn)),
   before,after,liveConnected:first.isConnected
  };
 }finally{
  container.remove();
  document.addEventListener=add;
  document.removeEventListener=remove;
 }
});
assert.equal(lifecycle.mounted,10,'All ten live cards install document handlers');
assert.equal(lifecycle.detached,10,'Disconnect clears all document handler references');
assert.deepEqual(lifecycle.countAfterTen,{added:30,removed:30},
 '10 removed cards must unregister all three listeners each');
assert.equal(lifecycle.added,33,'Recreated card attaches three listeners');
assert.equal(lifecycle.removed,33,'Recreated card removes all three listeners');
assert.equal(lifecycle.exactPairs,true,'Every listener is removed with the original callback');
assert.equal(lifecycle.liveConnected,false,'Removed cards are disconnected');
assert.notEqual(lifecycle.before,lifecycle.after,'Live hass update must rerender via native rAF');
assert.match(lifecycle.after,/321/,'P1 sensor change visible after actual rAF rerender');

assert.deepEqual(errors,[]);console.log('Visual checks OK');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
