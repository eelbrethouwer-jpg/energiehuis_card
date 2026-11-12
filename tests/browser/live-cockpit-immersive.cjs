'use strict';
// v1.28-voorstel (PR #56) browseracceptatie: immersive Live Cockpit Home + klikbare energieroutes, GESIMULEERDE HA-data.
//   node tests/browser/live-cockpit-immersive.cjs [--browser=webkit] [--screenshots=<map>]   (EH_LIVE_MASTER=<pad> optioneel)
// Geen echte Home Assistant. De getekende Media Source-route wordt nagebootst: /media/… alleen met geldige authSig.
const {chromium,webkit}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const browserType=process.argv.includes('--browser=webkit') ? webkit : chromium;
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');

const source=fs.readFileSync(path.join(__dirname,'..','..','energiehuis-card.js'),'utf8');
const SHOTS=(process.argv.find(a=>a.startsWith('--screenshots='))||'').split('=')[1]||'';

// Testbeeld 1330×748 (PNG, effen kleurverloop) tenzij een lokale master is opgegeven (alleen voor lokale screenshots).
function png(w,h){
 const crcT=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
 const crc=b=>{let c=-1;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const raw=Buffer.alloc((w*3+1)*h);
 for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;raw[o]=20+Math.round(40*y/h);raw[o+1]=30+Math.round(50*x/w);raw[o+2]=60;}}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const MASTER=process.env.EH_LIVE_MASTER?{body:fs.readFileSync(process.env.EH_LIVE_MASTER),type:'image/webp'}:{body:png(1330,748),type:'image/png'};
const SECRET=crypto.randomBytes(16);
const sign=(p,ttl)=>{const pl=Buffer.from(JSON.stringify({p,exp:Date.now()+ttl*1000})).toString('base64url');return pl+'.'+crypto.createHmac('sha256',SECRET).update(pl).digest('base64url');};
const verify=(p,sig)=>{if(!sig||!sig.includes('.'))return 401;const [pl,mac]=sig.split('.');if(crypto.createHmac('sha256',SECRET).update(pl).digest('base64url')!==mac)return 403;const o=JSON.parse(Buffer.from(pl,'base64url').toString());return o.p!==p||Date.now()>o.exp?403:0;};
const log=[];
const html='<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#071522;font-family:Arial}energiehuis-card{display:block;max-width:1300px;margin:auto}</style><energiehuis-card></energiehuis-card><script src="/card.js"></script>';
const server=http.createServer((q,r)=>{
 const u=new URL(q.url,'http://x');log.push(u.pathname+u.search);
 if(u.pathname==='/card.js'){r.setHeader('Content-Type','text/javascript');return r.end(source);}
 if(u.pathname==='/__sign'){const p=u.searchParams.get('path');r.setHeader('Content-Type','application/json');return r.end(JSON.stringify({url:p+'?authSig='+sign(p,+(u.searchParams.get('ttl')||30)),mime_type:MASTER.type}));}
 if(u.pathname.startsWith('/media/')){const why=u.pathname==='/media/local/energiehuis/master.webp'?verify(u.pathname,u.searchParams.get('authSig')):404;if(why){r.statusCode=why;return r.end();}r.setHeader('Content-Type',MASTER.type);return r.end(MASTER.body);}
 if(u.pathname!=='/'){r.statusCode=404;return r.end();}
 r.setHeader('Content-Type','text/html');r.end(html);
});

// In de pagina: kaart met gesimuleerde HA-states; hass.callWS ondersteunt alleen resolve_media (rest: lege antwoorden).
const SETUP=([config,mode])=>{
 const card=document.querySelector('energiehuis-card');
 card._loadHistory=async()=>{};window.__metricLoads=[];card._loadMetricData=async function(){window.__metricLoads.push(this._detail);};card._loadCostCompare=async()=>{};card._loadCupraInsights=async()=>{};
 window.__resolves=0;window.__resolveMode=mode||'ok';window.__calls=[];
 const now=Date.now(),iso=s=>new Date(now-s*1000).toISOString();
 const st=(id,v,unit,age=2)=>({entity_id:id,state:String(v),attributes:unit?{unit_of_measurement:unit}:{},last_updated:iso(age),last_changed:iso(age),last_reported:iso(age)});
 card.setConfig(config);
 const c=card.config;
 const states={};
 for(const [k,v,u,age] of [['net',-380,'W'],['zonnepanelen',4820,'W'],['huis',1460,'W'],['laden',2980,'W'],['cupra',58,'%',300],['batterij',72,'%',300],['prijs',.17,'€/kWh'],['stroom',13,'A']])states[c[k]]=st(c[k],v,u,age);
 window.__st=st;
 window.__hass={connected:true,states,callWS:async msg=>{
   window.__calls.push(msg.type);
   if(msg.type==='media_source/resolve_media'){
    window.__resolves++;
    if(window.__resolveMode==='fail')throw new Error('niet gevonden');
    if(window.__resolveMode==='local')return {url:'/local/energiehuis/master.webp'};
    if(window.__resolveMode==='hang')return new Promise(()=>{});
    const m=/^media-source:\/\/media_source\/local\/(.+)$/.exec(msg.media_content_id);
    return (await fetch('/__sign?path='+encodeURIComponent('/media/local/'+m[1]))).json();
   }
   if(msg.type==='recorder/statistics_during_period'&&window.__stats!==false){
    // GESIMULEERDE dagstatistieken (testdata): uurbuckets vandaag; alleen aangevraagde ids.
    const out={},start=new Date();start.setHours(0,0,0,0);
    const per={[c.import]:.25,[c.export]:.18,[c.zonne_energie]:.6,[c.laad_energie]:.3,[c.huis_energie]:null,[c.huis]:null};
    for(const id of msg.statistic_ids){const k=per[id];if(k==null)continue;out[id]=[];for(let i=0;i<=new Date().getHours();i++)out[id].push({start:start.getTime()+i*3600000,end:start.getTime()+(i+1)*3600000,change:k*(i%3+1)});}
    return out;
   }
   return {};
  },callApi:async()=>[],callService:()=>{throw Error('Ongewenste servicecall')},hassUrl:p=>new URL(p,location.origin).toString()};
 // Gesimuleerde kwartierprijzen (Zonneplan-vorm: forecast met start_date en price) en dagsensoren.
 {const d0=new Date();d0.setHours(0,0,0,0);const fc=[];for(let i=0;i<96;i++)fc.push({start_date:new Date(d0.getTime()+i*900000).toISOString(),price_tax_included:+(0.2+0.08*Math.sin(i/9)+(i>=68&&i<80?0.07:0)).toFixed(4)});
  const cur=fc.find(q=>{const t=Date.parse(q.start_date);return now>=t&&now<t+900000;});
  states[c.prijs]={entity_id:c.prijs,state:String(cur?cur.price_tax_included:0.22),attributes:{unit_of_measurement:'EUR/kWh',forecast:fc},last_updated:iso(2),last_changed:iso(2),last_reported:iso(2)};
  states[c.zonne_energie]=st(c.zonne_energie,12.4,'kWh');states[c.cost_zonneplan_day]=st(c.cost_zonneplan_day,0.31,'EUR',30);
  states[c.cupra_charged_energy]=st(c.cupra_charged_energy,5.1,'kWh',60);states[c.cupra_outside_temp]=st(c.cupra_outside_temp,14.4,'°C',600);}
  card.hass=window.__hass;
 window.__push=(patch,extra={})=>{const s={...window.__hass.states};for(const [k,v,u] of patch)s[c[k]]=st(c[k],v,u||'W',0);window.__hass={...window.__hass,...extra,states:s};card.hass=window.__hass;};
};
const LIVE={live_cockpit:true,live_cockpit_image:'media-source://media_source/local/energiehuis/master.webp',mobile_fixed_navigation:false};
const frames=(page,n=2)=>page.evaluate(n=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
const STATE=()=>{
 const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,host=root.querySelector('.eh-live-home');
 const sr=host&&host.shadowRoot,ehc=sr&&sr.querySelector('.ehc');
 const tile=k=>sr&&sr.querySelector('.ehm-tiles .tile[data-key="'+k+'"]');
 return {
  view:card._view,live:!!host,eh40:!!root.querySelector('.eh40-cockpit'),configError:root.querySelector('.eh-live-config-error')?.textContent||null,
  legacy:!!root.querySelector('.eh26-legacy'),legacyOpen:root.querySelector('.eh26-legacy')?.open??null,nav:[...root.querySelectorAll('.eh26-navitem')].map(b=>b.textContent.trim()),
  scene:ehc?.dataset.scene,layout:ehc?.dataset.layout,note:sr?.querySelector('.ehc-scene-note')?.textContent,badge:sr?.querySelector('.ehc-demo')?.textContent,badgeState:sr?.querySelector('.ehc-demo')?.dataset.state,
  status:sr?.querySelector('.ehc-status')?.textContent,net:tile('net')?.querySelector('.t-value')?.textContent,netSub:tile('net')?.querySelector('.t-sub')?.textContent,
  text:ehc?.textContent||'',img:sr?.querySelector('.ehm-scene')?.getAttribute('src')||'',
  particles:card._ehLive?.ctl?.cockpit.particleInfo().filter(p=>p.active).map(p=>p.route).sort()||[],
  debug:card._ehLive?.ctl?{...card._ehLive.ctl.debug,cockpitSuspended:card._ehLive.ctl.cockpit.suspended}:null,
  overflow:document.documentElement.scrollWidth>innerWidth+1,
  hostRect:host?(r=>({l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width)}))(host.getBoundingClientRect()):null
 };
};

const results=[];let failed=0;
async function check(name,fn){
 try{const info=await fn();results.push(name);console.log('PASS',name,info?JSON.stringify(info).slice(0,280):'');}
 catch(e){failed++;console.log('FAIL',name,'-',process.env.EH_VERBOSE?e.stack:e.message.split('\n')[0]);}
}

const IMM={...LIVE,live_cockpit_immersive:true};
const SHOT_SET=process.argv.includes('--screenshots-all');

// Meting van de immersive Home in de pagina (kaart-shadow + Live Cockpit-shadow).
const HOME=()=>{
 const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,shell=root.querySelector('.shell'),host=root.querySelector('.eh-live-home');
 const sr=host&&host.shadowRoot,ehc=sr&&sr.querySelector('.ehc'),stage=sr&&sr.querySelector('.ehm-stage');
 const vis=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const st=stage?stage.getBoundingClientRect():null,nav=root.querySelector('.shell > .nav').getBoundingClientRect(),rail=nav.width<innerWidth*.5;
 const S=card._ehLive?.ctl?EhLiveCockpit.scope.EhPve04MasterScene:null;
 const tiles=sr?[...sr.querySelectorAll('.ehm-tiles .tile')].map(b=>{
  const r=b.getBoundingClientRect(),layout=ehc.dataset.layout,cx=r.left+r.width/2,cy=r.top+r.height/2;
  const pts=layout==='list'?[[cx,cy]]:[[cx,cy],[cx-21,cy],[cx+21,cy],[cx,cy-21],[cx,cy+21]];
  const nb=root.querySelector('.shell > .nav').getBoundingClientRect(),navTop=nb.width<innerWidth*.5?innerHeight:nb.top;   // liggend: rail links, geen balk onder de scène
  const hit=pts.every(([x,y])=>{if(x<0||y<0||x>innerWidth||y>=Math.min(innerHeight,navTop))return true;   // onder de ondernavigatie: na scrollen bereikbaar
   const e=sr.elementFromPoint(x,y);return !!e&&e.closest('.tile')===b;});
  let covers=true;
  if(layout!=='list'&&S){const c=S.covers[b.dataset.key].baked;covers=r.left<=st.left+c.x*st.width+.5&&r.top<=st.top+c.y*st.height+.5&&r.right>=st.left+(c.x+c.w)*st.width-.5&&r.bottom>=st.top+(c.y+c.h)*st.height-.5;}
  return {key:b.dataset.key,x:Math.round(r.left),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height),hit,covers,haspopup:b.hasAttribute('aria-haspopup'),label:b.getAttribute('aria-label')};
 }):[];
 return {
  view:card._view,imm:shell.classList.contains('eh-imm-home'),portrait:!!host&&host.hasAttribute('data-imm-portrait'),total:host?.style.getPropertyValue('--eh-imm-total'),hostW:host?Math.round(host.getBoundingClientRect().width):0,all:shell.classList.contains('eh-imm-all'),live:!!host,immAttr:!!host&&host.hasAttribute('data-immersive'),
  layout:ehc?.dataset.layout,scene:ehc?.dataset.scene,heroVisible:vis(root.querySelector('.shell > .hero')),legacyVisible:vis(root.querySelector('.eh26-legacy')),
  coachVisible:vis(root.querySelector('.eh17-panel')),chartVisible:vis(root.querySelector('.chart-panel')),eh40:!!root.querySelector('.eh40-cockpit'),
  stage:st&&{l:Math.round(st.left),r:Math.round(st.right),t:Math.round(st.top),b:Math.round(st.bottom),ratio:+(st.width/st.height).toFixed(3)},navTop:Math.round(rail?innerHeight:nav.top),innerW:innerWidth,innerH:innerHeight,
  overflow:document.documentElement.scrollWidth>innerWidth+1,ambient:!!sr?.querySelector('.eh-imm-ambient'),badge:sr?.querySelector('.ehc-demo')?.textContent,tiles
 };
};
const clickTile=(page,key)=>page.evaluate(k=>{const h=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home');h.shadowRoot.querySelector('.ehm-tiles .tile[data-key="'+k+'"]').click();},key);
const PAGE=()=>{
 const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,main=root.querySelector('.eh-imm-page,.cupra-page,.subpage');
 const ae=root.activeElement;
 return {view:card._view,detail:card._detail,page:main?.dataset.ehImmPage||null,title:main?.querySelector('h2')?.textContent||null,
  back:!!root.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]'),backLabel:root.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]')?.getAttribute('aria-label'),
  follow:!!root.querySelector('.eh-imm-follow[data-eh-page="charge"]'),pane:!!main?.querySelector('.detail-panel'),text:main?.textContent||'',focus:ae?(ae.id||ae.className||ae.tagName):null,
  live:!!root.querySelector('.eh-live-home'),suspended:card._ehLive?.ctl?.debug.suspended,loads:window.__metricLoads.slice(),overflow:document.documentElement.scrollWidth>innerWidth+1};
};

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await browserType.launch({headless:true});
 console.log(browserType.name(),browser.version());
 async function open(config,{width=1300,height=900,mode='ok',dpr=1,wait=true,reducedMotion='no-preference',fontScale=1,hasTouch=false,init=null}={}){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion,hasTouch});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/40[134]|Failed to load resource/.test(m.text()))errors.push(m.text());});
  if(init)await page.addInitScript(init);
  await page.addInitScript(()=>{const RO=window.ResizeObserver;window.__ro=0;window.ResizeObserver=class extends RO{constructor(cb){super(cb);window.__ro++;}};});
  await page.goto(base);if(fontScale!==1)await page.addStyleTag({content:'html{font-size:'+(fontScale*100)+'%}'});await page.evaluate(SETUP,[config,mode]);
  if(wait&&config.live_cockpit===true)await page.waitForFunction(()=>{const h=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home');const e=h&&h.shadowRoot.querySelector('.ehc');return e&&e.dataset.scene!=='loading';},null,{timeout:15000});
  await frames(page,4);
  return {ctx,page,errors};
 }

 await check('opt-in UIT: live_cockpit zonder immersive = v1.27-gedrag (hero, alle metingen, detaildialoog); immersive zonder live_cockpit = genegeerd',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  const a=await page.evaluate(HOME);
  await clickTile(page,'pv');await frames(page,3);
  const afterClick=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {view:c._view,dialog:!c.shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehc-detail').hidden};});
  await ctx.close();
  const b=await (async()=>{const {ctx,page}=await open({live_cockpit_immersive:true,mobile_fixed_navigation:false});const s=await page.evaluate(HOME);await ctx.close();return s;})();
  assert.equal(a.imm,false);assert.equal(a.immAttr,false);assert.equal(a.legacyVisible,true);assert.ok(a.tiles.every(t=>t.haspopup));
  assert.deepEqual(afterClick,{view:'overview',dialog:true});
  assert.equal(b.live,false);assert.equal(b.eh40,true);assert.equal(b.imm,false);
  assert.deepEqual(errors,[]);
  return {v127:{imm:a.imm,legacy:a.legacyVisible},afterClick,immersiveWithoutLive:{live:b.live,eh40:b.eh40}};
 });

 // Portret (smal én hoog): volle-breedte scène + routekaarten eronder (lijst). Tablet, desktop en liggend: kaarten op de master.
 const VPS=[[320,568,'list',true],[390,844,'list',true],[430,932,'list',true],[768,1024,'compact',false],[1280,800,null,false],[844,390,'compact',false]];
 for(const [w,h,layout,portrait] of VPS){
  await check(`immersive Home ${w}×${h}: één visual, oude modules verborgen, master volledig zichtbaar (contain), tikvlakken ≥44 px, geen horizontale scroll`,async()=>{
   const {ctx,page,errors}=await open(IMM,{width:w,height:h});
   const s=await page.evaluate(HOME);
   if(SHOTS)await page.screenshot({path:path.join(SHOTS,`imm-home-${w}x${h}-${browserType.name()}.png`)});
   await ctx.close();
   assert.equal(s.imm,true);assert.equal(s.immAttr,true);assert.equal(s.view,'overview');
   assert.deepEqual([s.heroVisible,s.legacyVisible,s.coachVisible,s.chartVisible,s.eh40],[false,false,false,false,false]);
   if(layout)assert.equal(s.layout,layout);
   assert.equal(s.portrait,portrait,'portretstand');
   if(portrait){
    assert.ok(s.stage.r-s.stage.l>=s.hostW-10,'portret: scène over (vrijwel) de volle breedte '+JSON.stringify([s.stage,s.hostW]));
    const cols=new Set(s.tiles.map(t=>t.x)).size;
    assert.equal(cols,w>=390?2:1,'kolommen routekaarten');
    if(w>=390)assert.ok(s.tiles.every(t=>t.b<=s.navTop),'portret ≥390: alle zes routes zichtbaar zonder scrollen '+JSON.stringify([s.tiles.map(t=>t.b),s.navTop]));
   }
   assert.equal(s.overflow,false);
   assert.ok(s.stage.l>=0&&s.stage.r<=s.innerW,'scène horizontaal volledig zichtbaar');
   assert.ok(Math.abs(s.stage.ratio-1330/748)<0.02,'verhouding behouden '+s.stage.ratio);
   if(s.layout!=='list')assert.ok(s.stage.b<=Math.min(s.innerH,s.navTop)+1,'scène boven de ondernavigatie: '+JSON.stringify([s.stage,s.navTop,s.innerH]));
   assert.deepEqual(s.tiles.filter(t=>!t.hit).map(t=>t.key),[],'tikvlak');
   assert.deepEqual(s.tiles.filter(t=>!t.covers).map(t=>t.key),[],'dekking');
   if(s.layout==='list')assert.ok(s.tiles.every(t=>t.w>=44&&t.h>=44));
   assert.ok(s.tiles.every(t=>!t.haspopup&&/Pagina openen\./.test(t.label)),'navigatiesemantiek');
   assert.ok(s.scene!=='ok'||s.ambient,'achtergrondverlenging');
   assert.deepEqual(errors,[]);
   return {layout:s.layout,portrait:s.portrait,stage:s.stage,stageShare:+(((s.stage.r-s.stage.l)*(s.stage.b-s.stage.t))/(s.hostW*parseFloat(s.total))).toFixed(2),navTop:s.navTop};
  });
 }

 await check('klikroutes: zon/huis/net → eigen pagina met bestaand energiedetail; batterij → Batterij; Cupra → Cupra + Slim laden; praktijk → read-only; telkens terug naar Home met focus op de kaart',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:390,height:844});
  const out={};
  for(const [key,view] of [['pv','sun'],['house','home'],['net','grid'],['battery','battery'],['cupra','cupra'],['practice','practice']]){
   await page.evaluate(()=>{window.__metricLoads.length=0;});
   await clickTile(page,key);await frames(page,3);
   const p=await page.evaluate(PAGE);
   if(SHOTS&&SHOT_SET)await page.screenshot({path:path.join(SHOTS,`imm-page-${view}-${browserType.name()}.png`),fullPage:true});
   let follow=null;
   if(key==='cupra'){await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-follow').click());await frames(page,3);follow=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);}
   await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').click());
   await frames(page,3);
   const home=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),h=c.shadowRoot.querySelector('.eh-live-home');return {view:c._view,imm:c.shadowRoot.querySelector('.shell').classList.contains('eh-imm-home'),focus:h?.shadowRoot.activeElement?.dataset?.key||null,suspended:c._ehLive.ctl.debug.suspended};});
   out[key]={view:p.view,page:p.page,title:p.title,pane:p.pane,loads:p.loads,back:p.back,backLabel:p.backLabel,follow,home,practiceNumbers:key==='practice'?/\d+([.,]\d+)?\s?(k?W|kWh)\b/.test(p.text):undefined,live:p.live,suspended:p.suspended,overflow:p.overflow};
  }
  await ctx.close();
  for(const [key,view] of [['pv','sun'],['house','home'],['net','grid']]){const o=out[key];assert.equal(o.view,view);assert.equal(o.page,view);assert.equal(o.pane,true,key+' energiedetail');assert.deepEqual(o.loads,[view],key+' meetdata');}
  assert.equal(out.pv.title,'Zonnepanelen');assert.equal(out.house.title,'Huisverbruik');assert.equal(out.net.title,'Net');
  assert.equal(out.battery.view,'battery');assert.equal(out.battery.back,true);
  assert.equal(out.cupra.view,'cupra');assert.equal(out.cupra.follow,'charge');
  assert.equal(out.practice.view,'practice');assert.equal(out.practice.practiceNumbers,false);
  for(const [k,o] of Object.entries(out)){assert.equal(o.live,false,k);assert.equal(o.suspended,true,k+' cockpit gepauzeerd');assert.equal(o.backLabel,'Terug naar Home',k);assert.equal(o.overflow,false,k);
   if(k!=='cupra'){assert.deepEqual(o.home,{view:'overview',imm:true,focus:k,suspended:false},k);}}
  assert.deepEqual(errors,[]);
  return Object.fromEntries(Object.entries(out).map(([k,o])=>[k,o.view+(o.follow?'→'+o.follow:'')]));
 });

 await check('ondernavigatie en Inzicht: Home-knop terug; Inzicht bevat Zon/Huis/Net/Praktijk/Alle metingen; "Alle metingen" toont de oude Home-inhoud met de cockpit gepauzeerd',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:1280,height:800});
  await clickTile(page,'net');await frames(page,3);
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,3);
  const viaNav=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh26-insights]').click());await frames(page,3);
  const menu=await page.evaluate(()=>[...document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('.eh26-insight-menu button strong')].map(x=>x.textContent));
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu [data-eh-page="sun"]').click());await frames(page,3);
  const viaMenu=await page.evaluate(PAGE);
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh26-insights]').click());await frames(page,3);
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu [data-eh-imm-all]').click());await frames(page,3);
  const all=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;return {view:c._view,all:r.querySelector('.shell').classList.contains('eh-imm-all'),live:!!r.querySelector('.eh-live-home'),legacyOpen:r.querySelector('.eh26-legacy')?.open,metrics:r.querySelectorAll('.eh26-legacy .metric').length,coach:!!r.querySelector('.eh17-panel'),chart:!!r.querySelector('.chart-panel'),suspended:c._ehLive.ctl.debug.suspended,focus:r.activeElement?.id};});
  if(SHOTS&&SHOT_SET)await page.screenshot({path:path.join(SHOTS,`imm-alle-metingen-${browserType.name()}.png`),fullPage:true});
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-allhead .eh-imm-back').click());await frames(page,3);
  const back=await page.evaluate(HOME);
  await ctx.close();
  assert.equal(viaNav,'overview');
  for(const m of ['Zonnepanelen','Huisverbruik','Net','Praktijkruimte','Alle metingen','Cupra inzichten','Thuisbatterij'])assert.ok(menu.includes(m),m);
  assert.equal(viaMenu.view,'sun');assert.equal(viaMenu.pane,true);
  assert.deepEqual([all.view,all.all,all.live,all.legacyOpen,all.coach,all.chart,all.suspended,all.focus],['overview',true,false,true,true,true,true,'eh-imm-title']);
  assert.ok(all.metrics>=6);
  assert.equal(back.imm,true);assert.equal(back.live,true);
  assert.deepEqual(errors,[]);
  return {menu,all};
 });

 await check('levenscyclus: 60 hass-updates op Home en 3× alle routes heen en terug ⇒ zelfde cockpit en master (1 resolve), geen extra ResizeObservers/timers, één klik = één navigatie',async()=>{
  log.length=0;
  const {ctx,page,errors}=await open(IMM,{width:390,height:844});
  const r=await page.evaluate(async()=>{
   const card=document.querySelector('energiehuis-card'),host0=card.shadowRoot.querySelector('.eh-live-home'),img0=host0.shadowRoot.querySelector('.ehm-scene');
   const ro0=window.__ro,fr=()=>new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
   let navs=0;const nav=card._ehImmNavigate;card._ehImmNavigate=function(k){navs++;return nav.call(this,k);};
   for(let i=1;i<=60;i++){window.__push([['net',-400-i]]);if(i%10===0)await fr();}
   const views=[];
   for(let round=0;round<3;round++)for(const k of ['pv','house','net','battery','cupra','practice']){
    card.shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehm-tiles .tile[data-key="'+k+'"]').click();await fr();views.push(card._view);
    card.shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').click();await fr();
   }
   await new Promise(res=>setTimeout(res,200));
   const host1=card.shadowRoot.querySelector('.eh-live-home');
   return {sameHost:host0===host1,sameImg:host1.shadowRoot.querySelector('.ehm-scene')===img0,ro:window.__ro-ro0,navs,views:views.length,resolves:window.__resolves,dbg:card._ehLive.ctl.debug,anim:card._ehLive.ctl.cockpit.isAnimating(),net:host1.shadowRoot.querySelector('.tile[data-key="net"] .t-value').textContent};
  });
  const media=log.filter(l=>l.startsWith('/media/')).length;await ctx.close();
  assert.equal(r.sameHost,true);assert.equal(r.sameImg,true);assert.equal(r.ro,0,'geen nieuwe ResizeObservers');
  assert.equal(r.navs,18,'één klik = één navigatie');assert.equal(r.resolves,1);assert.equal(media,1);
  assert.equal(r.dbg.suspended,false);assert.equal(r.dbg.timer,true);assert.equal(r.anim,true);
  assert.match(r.net,/^−460\s?W$/);assert.deepEqual(errors,[]);
  return r;
 });

 // Echte pointer- en touchinvoer (geen DOM-.click()): per doel controleren dat het zichtbaar, bereikbaar (eventueel na
 // scrollen) en op het tikpunt NIET bedekt is (elementFromPoint door alle shadow-roots heen: ondernavigatie, overlays,
 // waas, lichtpunten), en dan op dat punt klikken of tikken.
 const TARGET=([sel,key])=>{
  const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,host=root.querySelector('.eh-live-home');
  const scope=sel==='back'?root:host.shadowRoot;
  const el=sel==='back'?root.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]'):scope.querySelector(sel+'[data-key="'+key+'"]');
  if(!el)return {missing:true};
  const nb=root.querySelector('.shell > .nav').getBoundingClientRect(),navTop=nb.width<innerWidth*.5?innerHeight:nb.top,limit=Math.min(innerHeight,navTop);
  let r=el.getBoundingClientRect(),scrolled=false;
  if(r.top<0||r.bottom>limit){window.scrollBy({top:r.top+r.height/2-limit/2,behavior:'instant'});r=el.getBoundingClientRect();scrolled=true;}
  const cs=getComputedStyle(el);
  const visible=r.width>0&&r.height>0&&cs.visibility!=='hidden'&&+cs.opacity>0&&cs.display!=='none';
  const deep=(x,y)=>{let e=document.elementFromPoint(x,y);for(let i=0;i<4&&e&&e.shadowRoot;i++){const n=e.shadowRoot.elementFromPoint(x,y);if(!n||n===e)break;e=n;}return e;};
  const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=Math.min(14,r.width*.3),dy=Math.min(10,r.height*.3);
  const pts=[[cx,cy],[cx-dx,cy],[cx+dx,cy],[cx,cy-dy],[cx,cy+dy]];
  const q=[[22,22],[-22,22],[22,-22],[-22,-22]].map(([a,b])=>[cx+a,cy+b]);
  const hit44=q.every(([x,y])=>{if(y<0||y>=limit)return true;const e=deep(x,y);return !!e&&(e===el||el.contains(e));});
  const blocked=pts.map(([x,y])=>{const e=deep(x,y);return e&&(e===el||el.contains(e))?null:(e?(e.className&&e.className.baseVal===undefined?String(e.className):e.tagName)||e.tagName:'niets');}).filter(Boolean);
  return {x:Math.round(cx),y:Math.round(cy),w:Math.round(r.width),h:Math.round(r.height),hit44,visible,inView:r.top>=0&&r.bottom<=limit+.5&&r.left>=0&&r.right<=innerWidth,blocked,scrolled};
 };
 const ROUTES={pv:['sun','sun'],house:['home','home'],net:['grid','grid'],battery:['battery',null],cupra:['cupra',null],practice:['practice',null]};
 // Portret 320/390/430: muis én touch, kaarten én vlakken. Tablet (touch) en desktop (muis): kaarten op de master.
 const COMBOS=[[320,568,'pointer'],[320,568,'touch'],[390,844,'pointer'],[390,844,'touch'],[430,932,'pointer'],[430,932,'touch'],[768,1024,'touch'],[1280,800,'pointer'],[844,390,'touch'],[844,390,'pointer'],[932,430,'touch']];
 for(const [w,h,input] of COMBOS){
  {
   await check(`echte ${input==='touch'?'touch-tik':'muisklik'} ${w}×${h}: ${w<600?'zes routekaarten én zes vlakken op de master':'zes kaarten op de master'} zichtbaar, bereikbaar, niet bedekt (ondernavigatie/overlays) en navigeren; Terug idem`,async()=>{
    const {ctx,page,errors}=await open(IMM,{width:w,height:h,hasTouch:input==='touch'});
    const press=(x,y)=>input==='touch'?page.touchscreen.tap(x,y):page.mouse.click(x,y);
    const out=[];
    const list=await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehc').dataset.layout==='list');
    assert.equal(list,w<600,'portret ⇒ lijst met vlakken op de master');
    for(const sel of list?['.ehm-tiles .tile','.ehm-covers .ehm-plate']:['.ehm-tiles .tile']){
     for(const key of Object.keys(ROUTES)){
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      const t=await page.evaluate(TARGET,[sel,key]);
      assert.ok(!t.missing,sel+' '+key+' ontbreekt');
      assert.ok(t.visible&&t.inView,sel+' '+key+' zichtbaar: '+JSON.stringify(t));
      assert.deepEqual(t.blocked,[],sel+' '+key+' bedekt op het tikpunt');
      if(sel.includes('tile'))assert.ok((t.w>=44&&t.h>=44)||t.hit44,'tikvlak ≥44 px (kaart of ::before): '+JSON.stringify(t));
      await press(t.x,t.y);await frames(page,3);
      const p=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {view:c._view,detail:c._detail};});
      assert.deepEqual([p.view,p.detail],ROUTES[key],sel+' '+key+' bestemming');
      const b=await page.evaluate(TARGET,['back']);
      assert.ok(b.visible&&b.inView&&!b.blocked.length,'Terug bereikbaar: '+JSON.stringify(b));
      await press(b.x,b.y);await frames(page,3);
      assert.equal(await page.evaluate(()=>document.querySelector('energiehuis-card')._view),'overview',key+' terug naar Home');
      out.push((sel.includes('tile')?'k:':'m:')+key+(t.scrolled?'(scroll)':''));
     }
    }
    await ctx.close();
    if(w>=390)assert.ok(!out.some(x=>x.includes('scroll')),'≥390 px: geen scroll nodig '+out.join(' '));
    assert.deepEqual(errors,[]);
    return {input,targets:out.length,scrolled:out.filter(x=>x.includes('scroll'))};
   });
  }
 }

 // ===== Landscape first (telefoon liggend) =====
 // Meting van de liggende compositie: scène, zijkolom, app-/ondernavigatie, veilige zones, overflow, overlap.
 const LAND=()=>{
  const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,host=root.querySelector('.eh-live-home'),sr=host&&host.shadowRoot;
  const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)};};
  const vis=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
  const ehc=sr&&sr.querySelector('.ehc'),stage=sr&&sr.querySelector('.ehm-stage');
  const side=['.ehc-head','.ehc-summary','.ehm-legend'].map(q=>sr&&sr.querySelector(q));
  const st=R(stage),tiles=[...(sr?sr.querySelectorAll('.ehm-tiles .tile'):[])].map(b=>({key:b.dataset.key,vis:vis(b),...R(b)}));
  return {layout:ehc?.dataset.layout,scene:ehc?.dataset.scene,portrait:host?.hasAttribute('data-imm-portrait'),stage:st,
   side:side.map(R),sideVis:side.map(vis),tiles,appbar:R(root.querySelector('.shell > .eh19-appbar')),nav:R(root.querySelector('.shell > .nav')),rail:root.querySelector('.shell > .nav').getBoundingClientRect().width<innerWidth*.5,navItems:[...root.querySelectorAll('.shell > .nav .eh26-navitem')].map(R),
   body:R(root.querySelector('.shell > .body')),host:R(host),innerW:innerWidth,innerH:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
   shellOverflow:root.querySelector('.shell').scrollWidth>root.querySelector('.shell').clientWidth+1};
 };
 const SAFE=(page,l,r,b)=>page.evaluate(([l,r,b])=>{const c=document.querySelector('energiehuis-card');c.style.setProperty('--eh-safe-test-l',l+'px');c.style.setProperty('--eh-safe-test-r',r+'px');c.style.setProperty('--eh-safe-test-b',b+'px');window.dispatchEvent(new Event('resize'));},[l,r,b]);   // echte zones veranderen bij het draaien, dat geeft een resize
 for(const [w,h] of [[844,390],[932,430],[667,375]]){
  await check(`landscape ${w}×${h}: scène dominant (≥ 80 % van de hoogte, ≥ 60 % van de breedte), zes kaarten op de scène, navigatie als rail links, geen paneel naast de scène, geen overflow of overlap`,async()=>{
   const {ctx,page,errors}=await open(IMM,{width:w,height:h});
   const m=await page.evaluate(LAND),home=await page.evaluate(HOME);
   if(SHOTS)await page.screenshot({path:path.join(SHOTS,`landscape-${w}x${h}-${browserType.name()}.png`)});
   await ctx.close();
   assert.equal(m.layout,'compact');assert.equal(m.scene,'ok');assert.equal(m.portrait,false);
   assert.equal(m.overflow,false);assert.equal(m.shellOverflow,false);
   assert.ok(m.stage.l>=0&&m.stage.r<=w,'scène binnen scherm');
   assert.ok(Math.abs(m.stage.w/m.stage.h-1330/748)<0.02,'verhouding');
   // 667×375 is breedtebeperkt (rail + tekstkolom): daar volstaat 60 % van de hoogte.
   assert.ok(m.stage.h>=h*(w>=800?0.8:0.6),`scène groot: ${m.stage.h}/${h}`);
   assert.ok(m.stage.w>=w*(w>=800?0.6:0.55),`scène breed: ${m.stage.w}/${w}`);
   assert.equal(m.rail,true,'navigatie als rail');
   assert.ok(m.stage.l>=m.nav.r-1&&m.stage.t>=m.appbar.b-1&&m.stage.b<=h,'scène rechts van de rail, onder de appbalk, binnen het scherm '+JSON.stringify([m.appbar,m.stage,m.nav]));
   assert.ok(m.appbar.h<=52,'slanke appbalk '+m.appbar.h);
   assert.ok(m.nav.b<=h+0.5&&m.navItems.length===4&&m.navItems.every(r=>r.t>=0&&r.b<=h&&r.h>=44&&r.r<=m.stage.l),'vier navigatieknoppen ≥44 px in de rail '+JSON.stringify(m.navItems));
   assert.ok(m.side.every(r=>r.w<=1&&r.h<=1),'geen paneel naast of onder de scène: status, samenvatting en legenda alleen voor schermlezers '+JSON.stringify(m.side));
   assert.equal(m.tiles.length,6);
   assert.ok(m.tiles.every(t=>t.vis&&t.l>=m.stage.l-1&&t.r<=m.stage.r+1&&t.t>=m.stage.t-1&&t.b<=m.stage.b+1),'zes kaarten binnen de scène');
   assert.deepEqual(home.tiles.filter(t=>!t.hit).map(t=>t.key),[],'tikvlak');assert.deepEqual(home.tiles.filter(t=>!t.covers).map(t=>t.key),[],'dekking');
   assert.deepEqual(errors,[]);
   return {stage:m.stage,shareH:+(m.stage.h/h).toFixed(2),shareW:+(m.stage.w/w).toFixed(2),rail:m.nav.w};
  });
 }
 await check('landscape veilige zones: notch links/rechts (47 px) en home-indicator (21 px) ⇒ app-/ondernavigatie, scène en zijkolom blijven erbinnen; zonder zones ongewijzigd',async()=>{
  const out={};
  for(const [w,h] of [[844,390],[932,430]]){
   const {ctx,page,errors}=await open(IMM,{width:w,height:h});
   const a=await page.evaluate(LAND);
   await SAFE(page,47,47,21);await frames(page,5);
   const b=await page.evaluate(LAND),home=await page.evaluate(HOME);
   await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh26-insights]').click());await frames(page,3);
   const menu=await page.evaluate(()=>{const m=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu'),r=m.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};});
   await ctx.close();
   assert.ok(b.navItems.every(r=>r.l>=47&&r.b<=h-21),'rail-knoppen binnen notch en home-indicator '+JSON.stringify(b.navItems));
   assert.ok(a.navItems.some(r=>r.l<47),'zonder zones geen extra marge');
   assert.ok(b.appbar.r<=w-47,'appbalk binnen de rechternotch');
   assert.ok(b.stage.l>=47&&b.side.every(r=>r.r<=w-47),'scène en tekst binnen de notch '+JSON.stringify([b.stage,b.side]));
   assert.ok(b.stage.l>=b.nav.r-1&&b.stage.b<=h,'scène rechts van de rail');
   assert.ok(menu.l>=b.nav.r&&menu.r<=w-47&&menu.t>=0&&menu.b<=h-21+0.5,'Inzicht-menu binnen veilige zone '+JSON.stringify(menu));
   assert.equal(b.overflow,false);assert.equal(b.shellOverflow,false);
   assert.deepEqual(home.tiles.filter(t=>!t.hit).map(t=>t.key),[],'tikvlak met veilige zones');
   assert.deepEqual(errors,[]);
   out[w+'x'+h]={nav:b.nav,stage:b.stage};
  }
  return out;
 });
 await check('landscape: alle functies bereikbaar (Laden/Slim laden, Inzicht-menu met alle items, Meer, Cupra, Batterij, historie, contracten/kosten, Alle metingen); menu binnen het scherm; geen overflow; echte touch-tikken',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:844,height:390,hasTouch:true});
  const tap=async el=>{const r=await page.evaluate(TARGET,el);assert.ok(r.visible&&r.inView&&!r.blocked.length,JSON.stringify([el,r]));await page.touchscreen.tap(r.x,r.y);await frames(page,4);};
  const view=()=>page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;return {v:c._view,d:c._detail,all:r.querySelector('.shell').classList.contains('eh-imm-all'),overflow:document.documentElement.scrollWidth>innerWidth+1,shell:r.querySelector('.shell').scrollWidth>r.querySelector('.shell').clientWidth+1};});
  const NAVSEL=k=>['nav',k];
  const reached={};
  // Hoofdnavigatie
  for(const [page_,v] of [['charge','charge'],['more','more'],['overview','overview']]){
   await page.evaluate(([k])=>{const c=document.querySelector('energiehuis-card');c.shadowRoot.querySelector('.eh26-navitem[data-eh-page="'+k+'"]').scrollIntoView({block:'nearest'});},[page_]);
   const r=await page.evaluate(k=>{const n=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="'+k+'"]').getBoundingClientRect();return {x:n.left+n.width/2,y:n.top+n.height/2,w:n.width,h:n.height,inside:n.bottom<=innerHeight&&n.top>=0};},page_);
   assert.ok(r.inside&&r.h>=44,'navigatieknop '+page_+' '+JSON.stringify(r));
   await page.touchscreen.tap(r.x,r.y);await frames(page,4);
   const st=await view();assert.equal(st.v,v);assert.equal(st.overflow,false);assert.equal(st.shell,false);reached[page_]=st.v;
  }
  // Inzicht-menu: alle items volledig zichtbaar binnen het scherm; elk item bereikbaar
  const items=async()=>{await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh26-insights]').click());await frames(page,3);
   return page.evaluate(()=>{const m=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu'),mr=m.getBoundingClientRect(),nav=document.querySelector('energiehuis-card').shadowRoot.querySelector('.shell > .nav').getBoundingClientRect();
    return {menu:{t:mr.top,b:mr.bottom,l:mr.left,r:mr.right,scrolls:m.scrollHeight>m.clientHeight+1},nav:nav.top,innerH:innerHeight,
     items:[...m.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {key:b.hasAttribute('data-eh-imm-all')?'all':(b.dataset.ehPage||b.textContent.trim()),label:b.querySelector('strong')?.textContent,h:Math.round(r.height),t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right)};})};});};
  const first=await items();
  assert.ok(first.items.length>=7,'menu-items '+first.items.length);
  assert.ok(first.menu.t>=0&&first.menu.b<=first.innerH+0.5&&first.menu.l>=0&&first.menu.r<=844,'menu binnen scherm '+JSON.stringify(first.menu));
  assert.ok(first.items.every(i=>i.h>=44&&i.t>=first.menu.t-1&&i.b<=first.menu.b+1),'alle items zichtbaar ≥44 px '+JSON.stringify(first.items));
  const keys=first.items.map(i=>i.key);
  for(const k of ['sun','home','grid','practice','all'])assert.ok(keys.includes(k),'menu mist '+k);
  const EXPECT={sun:'sun',home:'home',grid:'grid',practice:'practice',all:'overview'};
  for(let i=0;i<keys.length;i++){
   if(i>0)await items();
   const it=await page.evaluate(i=>{const b=document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('.eh26-insight-menu button')[i],r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},i);
   await page.touchscreen.tap(it.x,it.y);await frames(page,4);
   const st=await view();
   reached[keys[i]]=st.all?'all':st.v;
   assert.equal(st.overflow,false,keys[i]);assert.equal(st.shell,false,keys[i]);
   if(EXPECT[keys[i]])assert.equal(st.all?'overview':st.v,EXPECT[keys[i]],keys[i]);
   else assert.notEqual(st.v,'overview',keys[i]+' opent een eigen pagina');
   await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,4);
  }
  // Cupra → Slim laden, batterij, historie (periodeknoppen op Zon), kosten/contracten via menu
  await clickTile(page,'cupra');await frames(page,3);const cupra=await view();
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-follow').click());await frames(page,3);const slim=await view();
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,3);
  await clickTile(page,'battery');await frames(page,3);const bat=await view();
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,3);
  await clickTile(page,'pv');await frames(page,3);
  const periods=await page.evaluate(()=>[...document.querySelector('energiehuis-card').shadowRoot.querySelectorAll('.eh-imm-page .detail-panel button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,8));
  await ctx.close();
  assert.equal(cupra.v,'cupra');assert.equal(slim.v,'charge');assert.equal(bat.v,'battery');
  assert.ok(periods.length>=4,'periodeknoppen/historie '+periods.join('|'));
  const costs=Object.values(reached).includes('costs');
  assert.ok(costs,'kosten/contracten bereikbaar via menu of navigatie: '+JSON.stringify(reached));
  assert.deepEqual(errors,[]);
  return {reached,menu:keys,periods};
 });

 await check('rotatie portret ⇄ landscape: zelfde cockpit en master (1 resolve), geen extra listeners/observers, geen flikkering (elk frame: host, scène ok en beeld geladen), huidige pagina blijft staan',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:390,height:844,hasTouch:true});
  await page.evaluate(()=>{
   const card=document.querySelector('energiehuis-card'),host=card.shadowRoot.querySelector('.eh-live-home');
   window.__h=host;window.__img=host.shadowRoot.querySelector('.ehm-scene');window.__net={resize:0,orient:0};window.__bad=[];window.__lay=[];
   const a=window.addEventListener.bind(window),r=window.removeEventListener.bind(window);
   window.addEventListener=(t,f,o)=>{if(t==='resize')window.__net.resize++;if(t==='orientationchange')window.__net.orient++;return a(t,f,o);};
   window.removeEventListener=(t,f,o)=>{if(t==='resize')window.__net.resize--;if(t==='orientationchange')window.__net.orient--;return r(t,f,o);};
   window.__ro0=window.__ro;window.__loads0=window.__metricLoads.length;window.__res0=window.__resolves;
   const tick=()=>{const c=document.querySelector('energiehuis-card'),h=c.shadowRoot.querySelector('.eh-live-home');
    if(window.__stop)return;
    if(h!==window.__h)window.__bad.push('host vervangen');
    else{const e=h.shadowRoot.querySelector('.ehc'),im=h.shadowRoot.querySelector('.ehm-scene'),st=h.shadowRoot.querySelector('.ehm-stage').getBoundingClientRect();
     if(e.dataset.scene!=='ok')window.__bad.push('scene '+e.dataset.scene);
     if(im!==window.__img||!im.complete||!im.naturalWidth)window.__bad.push('beeld');
     if(st.width<50||st.height<30)window.__bad.push('scène leeg '+Math.round(st.width)+'x'+Math.round(st.height));
     const l=e.dataset.layout+(h.hasAttribute('data-imm-portrait')?'+p':'');if(window.__lay[window.__lay.length-1]!==l)window.__lay.push(l);}
    requestAnimationFrame(tick);};
   requestAnimationFrame(tick);
  });
  const seq=[[844,390],[390,844],[932,430],[430,932],[844,390]];
  const landed=[];
  for(const [w,h] of seq){await page.setViewportSize({width:w,height:h});await frames(page,6);landed.push(await page.evaluate(LAND));}
  const homeEnd=await page.evaluate(()=>({view:document.querySelector('energiehuis-card')._view,dbg:document.querySelector('energiehuis-card')._ehLive.ctl.debug,ro:window.__ro-window.__ro0,net:window.__net,res:window.__resolves-window.__res0,bad:window.__bad.slice(),lay:window.__lay.slice(),same:window.__h===document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home')}));
  assert.deepEqual(homeEnd.bad,[],'flikkering/verlies');assert.equal(homeEnd.same,true);assert.equal(homeEnd.res,0,'geen nieuwe beeldaanvraag');
  assert.deepEqual(homeEnd.net,{resize:0,orient:0},'geen extra listeners');assert.equal(homeEnd.ro,0,'geen extra ResizeObservers');
  assert.ok(homeEnd.lay.every(l=>['list+p','compact'].includes(l)),'geen tussenlagen (compact in portret, lijst zonder portret): '+homeEnd.lay);
  assert.equal(homeEnd.dbg.timer,true);assert.equal(homeEnd.dbg.suspended,false);
  assert.equal(landed[0].layout,'compact');assert.equal(landed[1].portrait,true);assert.equal(landed[2].layout,'compact');
  for(const m of landed){assert.equal(m.overflow,false);assert.ok(m.rail?(m.stage.l>=m.nav.r-1&&m.stage.b<=m.innerH):m.stage.b<=m.nav.t+0.5,'scène overlapt de navigatie niet na draaien');}
  // Pagina blijft staan: Net-pagina, Cupra-pagina en Alle metingen
  const pages={};
  for(const [name,open_] of [['grid',()=>clickTile(page,'net')],['cupra',()=>clickTile(page,'cupra')]]){
   await page.evaluate(()=>{window.__metricLoads.length=0;});
   await open_();await frames(page,4);
   const before=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {v:c._view,d:c._detail,from:c._ehImmFrom,loads:window.__metricLoads.length,title:c.shadowRoot.querySelector('h2')?.textContent};});
   for(const [w,h] of [[844,390],[390,844],[932,430]]){await page.setViewportSize({width:w,height:h});await frames(page,5);}
   const after=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card');return {v:c._view,d:c._detail,from:c._ehImmFrom,loads:window.__metricLoads.length,title:c.shadowRoot.querySelector('h2')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,live:!!c.shadowRoot.querySelector('.eh-live-home'),susp:c._ehLive.ctl.debug.suspended};});
   pages[name]={before,after};
   assert.deepEqual([after.v,after.d,after.from,after.title],[before.v,before.d,before.from,before.title],name+' pagina behouden');
   assert.equal(after.loads,before.loads,name+' geen herlaad/reset van meetdata');assert.equal(after.overflow,false);assert.equal(after.susp,true,'cockpit gepauzeerd op subpagina');
   await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,5);
  }
  // Alle metingen: open details + view blijven
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('[data-eh26-insights]').click());await frames(page,3);
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-insight-menu [data-eh-imm-all]').click());await frames(page,4);
  for(const [w,h] of [[844,390],[390,844]]){await page.setViewportSize({width:w,height:h});await frames(page,5);}
  const all=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;return {all:r.querySelector('.shell').classList.contains('eh-imm-all'),open:r.querySelector('.eh26-legacy')?.open,overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.deepEqual(all,{all:true,open:true,overflow:false});
  await page.evaluate(()=>{window.__stop=true;});
  await ctx.close();
  assert.deepEqual(errors,[]);
  return {lay:homeEnd.lay,pages:Object.keys(pages)};
 });

 await check('landscape 844×390 zonder meting en zonder beeld: kaarten tonen "—"/reden, geen overflow, geen overlap; Home en alle bestemmingen blijven bereikbaar',async()=>{
  const out={};
  for(const [name,mode,mut] of [['geen-metingen','ok','missing'],['geen-master','fail',null],['offline','ok','offline']]){
   const {ctx,page,errors}=await open(IMM,{width:844,height:390,mode,hasTouch:true});
   if(mut==='missing')await page.evaluate(()=>{window.__hass={...window.__hass,states:{}};document.querySelector('energiehuis-card').hass=window.__hass;});
   if(mut==='offline')await page.evaluate(()=>window.__push([],{connected:false}));
   await frames(page,6);
   const m=await page.evaluate(LAND),home=await page.evaluate(HOME);
   if(SHOTS)await page.screenshot({path:path.join(SHOTS,`landscape-${name}-${browserType.name()}.png`)});
   assert.equal(m.overflow,false,name);assert.equal(m.shellOverflow,false,name);
   if(m.layout!=='list'){assert.ok(m.rail?m.stage.l>=m.nav.r-1:m.stage.b<=m.nav.t+0.5,name+' scène overlapt navigatie niet');assert.ok(m.tiles.every(t=>t.vis&&t.r<=m.stage.r+1&&t.l>=m.stage.l-1&&t.b<=m.stage.b+1),name+' kaarten binnen de scène');}
   const reach=[];
   for(const [key,view] of [['pv','sun'],['house','home'],['net','grid'],['battery','battery'],['cupra','cupra'],['practice','practice']]){
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    const t=await page.evaluate(TARGET,['.ehm-tiles .tile',key]);
    assert.ok(t.visible&&t.inView&&!t.blocked.length,name+' '+key+' '+JSON.stringify(t));
    await page.touchscreen.tap(t.x,t.y);await frames(page,3);
    reach.push((await page.evaluate(()=>document.querySelector('energiehuis-card')._view))===view);
    await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').click());await frames(page,3);
   }
   const txt=await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehc').textContent);
   await ctx.close();
   assert.ok(reach.every(Boolean),name+' bestemmingen '+reach);assert.deepEqual(errors,[],name);
   if(mut==='missing')assert.ok(/—/.test(txt)||/Geen meting|Entiteit niet gevonden/.test(txt),'ontbrekende meting zichtbaar als streepje of reden');
   out[name]={layout:m.layout,scene:m.scene};
  }
  return out;
 });

 await check('landscape + reduced motion: geen animatielus, scène en kaarten bruikbaar; touch-navigatie werkt',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:844,height:390,reducedMotion:'reduce',hasTouch:true});
  const anim=await page.evaluate(()=>document.querySelector('energiehuis-card')._ehLive.ctl.cockpit.isAnimating());
  const m=await page.evaluate(LAND),home=await page.evaluate(HOME);
  const t=await page.evaluate(TARGET,['.ehm-tiles .tile','net']);await page.touchscreen.tap(t.x,t.y);await frames(page,3);
  const v=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);
  await ctx.close();
  assert.equal(anim,false);assert.equal(m.layout,'compact');assert.equal(m.overflow,false);assert.equal(v,'grid');
  assert.deepEqual(home.tiles.filter(x=>!x.hit).map(x=>x.key),[]);assert.deepEqual(errors,[]);
  return {anim,layout:m.layout};
 });

 // ===== Definitieve Home: scène + vakjes + kwartierprijs; dagtotalen =====
 const EXTRA=()=>{
  const card=document.querySelector('energiehuis-card'),host=card.shadowRoot.querySelector('.eh-live-home'),sr=host.shadowRoot;
  const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height};};
  const tiles={};
  for(const b of sr.querySelectorAll('.ehm-tiles .tile')){const d=b.querySelector('.t-day');tiles[b.dataset.key]={lines:d&&!d.hidden?[...d.querySelectorAll('span')].map(x=>x.textContent):[],shown:!!d&&!d.hidden&&d.getClientRects().length>0,aria:b.getAttribute('aria-label'),rect:R(b)};}
  const p=sr.querySelector('.eh-price'),ehc=sr.querySelector('.ehc');
  const H=new Date().getHours(),f=k=>{let t=0;for(let i=0;i<=H;i++)t+=k*(i%3+1);return t;};
  return {tiles,layout:ehc.dataset.layout,
   price:p?{state:p.dataset.state,text:p.textContent,aria:p.getAttribute('aria-label'),bars:p.querySelectorAll('rect').length,now:p.querySelectorAll('rect.now').length,rect:R(p),pe:getComputedStyle(p).pointerEvents,shown:p.getClientRects().length>0}:null,
   panels:['.ehc-head','.ehc-summary','.ehm-legend'].map(q=>{const r=sr.querySelector(q).getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}),
   stage:R(sr.querySelector('.ehm-stage')),ehcR:R(ehc),
   expected:{ev:f(.3),home:f(.25)-f(.18)+f(.6)-f(.3),net:f(.25)-f(.18)},
   statsCalls:window.__calls.filter(t=>t==='recorder/statistics_during_period').length,calls:window.__calls.slice()};
 };
 const fmtK=n=>Math.abs(n)>=100?n.toFixed(0).replace('.',','):Math.abs(n)>=10?n.toFixed(1).replace('.',','):n.toFixed(2).replace('.',',');
 const settle=async page=>{await page.waitForFunction(()=>window.__calls.includes('recorder/statistics_during_period'),null,{timeout:10000});await frames(page,6);};
 for(const [w,h] of [[844,390],[932,430],[390,844],[1280,800]]){
  await check(`definitieve Home ${w}×${h}: alleen scène + vakjes + kwartierprijs-overlay (geen paneel naast of onder het beeld); dagtotalen in de vakjes; kwartierprijs subtiel en zonder tikvlakken te blokkeren`,async()=>{
   const {ctx,page,errors}=await open(IMM,{width:w,height:h});await settle(page);
   const x=await page.evaluate(EXTRA),home=await page.evaluate(HOME);
   if(SHOTS)await page.screenshot({path:path.join(SHOTS,`home-final-${w}x${h}-${browserType.name()}.png`)});
   await ctx.close();
   const T=x.tiles;
   assert.deepEqual(x.panels.map(p=>p[0]<=1&&p[1]<=1),[true,true,true],'status/samenvatting/legenda alleen voor schermlezers');
   assert.deepEqual(T.pv.lines,['Vandaag: 12,4 kWh']);
   assert.deepEqual(T.house.lines,['Vandaag: '+fmtK(x.expected.home)+' kWh']);
   assert.deepEqual(T.cupra.lines,['Vandaag: '+fmtK(x.expected.ev)+' kWh','Sessie: 5,10 kWh']);
   assert.equal(T.net.lines.length,2);assert.equal(T.net.lines[0],'Vandaag: '+fmtK(x.expected.net)+' kWh');assert.equal(T.net.lines[1],'Kosten: € 0,31');
   assert.deepEqual(T.practice.lines,[],'praktijkruimte: geen fictieve data');assert.deepEqual(T.battery.lines,[],'virtuele batterij: geen dagtotaal');
   assert.match(T.battery.aria,/simulatie/i,'batterij als simulatie gelabeld');
   assert.match(T.cupra.aria,/Vandaag: .* kWh\. Sessie: 5,10 kWh\. (Pagina openen)/,'dagtotalen in de toegankelijke naam');
   if(w>=390)for(const k of ['pv','house','cupra','net'])assert.equal(T[k].shown,true,k+' dagregel zichtbaar');
   assert.ok(x.price&&x.price.shown,'kwartierprijs zichtbaar');
   assert.equal(x.price.state,'quarter');assert.match(x.price.text,/Kwartierprijs/i);assert.match(x.price.text,/€ 0,\d{3}/);
   assert.ok(x.price.bars>=90&&x.price.now===1,'staafjes met precies één gemarkeerd kwartier: '+x.price.bars+'/'+x.price.now);
   assert.match(x.price.aria,/^Kwartierprijs: nu € 0,\d{3} per kWh/);
   assert.equal(x.price.pe,'none','overlay vangt geen aanrakingen op');
   if(x.layout!=='list'){
    const p=x.price.rect;
    for(const [k,t] of Object.entries(T)){const r=t.rect;assert.ok(p.r<=r.l||p.l>=r.r||p.b<=r.t||p.t>=r.b,'kwartierprijs raakt vakje '+k);}
    assert.ok(p.l>=x.stage.l&&p.r<=x.stage.r+1&&p.b<=x.stage.b+1,'overlay binnen de scène');
    // Geen blok onder of naast de scène: de kaart bestaat uit het beeld (de scène vult de hoogte of de breedte).
    assert.ok(x.stage.h>=x.ehcR.h*0.8||x.stage.w>=x.ehcR.w*0.8,'scène is de enige inhoud '+JSON.stringify([x.stage,x.ehcR]));
   }else assert.ok(x.price.rect.t>=x.stage.b,'portret: prijs als rij onder de vakjes');
   assert.deepEqual(home.tiles.filter(t=>!t.hit).map(t=>t.key),[],'tikvlakken');assert.deepEqual(home.tiles.filter(t=>!t.covers).map(t=>t.key),[],'dekking');
   assert.deepEqual(errors,[]);
   return {lines:Object.fromEntries(Object.entries(T).map(([k,t])=>[k,t.lines])),price:x.price.text};
  });
 }
 await check('dagtotalen en prijs: ontbrekende data ⇒ nette fallback, geen fictieve getallen (geen statistieken, geen kostensensor, geen sessie, geen kwartierdata, geen prijssensor)',async()=>{
  const out={};
  // 1. geen recorder-statistieken
  {const {ctx,page,errors}=await open(IMM,{width:844,height:390,init:()=>{window.__stats=false;}});await settle(page);
   const x=await page.evaluate(EXTRA);await ctx.close();
   assert.deepEqual(x.tiles.house.lines,[]);assert.deepEqual(x.tiles.cupra.lines,['Sessie: 5,10 kWh']);assert.deepEqual(x.tiles.net.lines,['Kosten: € 0,31']);assert.deepEqual(x.tiles.pv.lines,['Vandaag: 12,4 kWh'],'omvormer-dagsensor blijft');
   assert.deepEqual(errors,[]);out.geenStats=Object.fromEntries(Object.entries(x.tiles).map(([k,t])=>[k,t.lines]));}
  // 2. geen kostensensor, sessie verouderd, Cupra laadt niet
  {const {ctx,page}=await open(IMM,{width:844,height:390});await settle(page);
   await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states};delete s[c.cost_zonneplan_day];const o=s[c.cupra_charged_energy];const old=new Date(Date.now()-3600000).toISOString();s[c.cupra_charged_energy]={...o,last_updated:old,last_changed:old,last_reported:old};window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});await frames(page,6);
   const a=await page.evaluate(EXTRA);
   await page.evaluate(()=>window.__push([['laden',0,'W']]));await frames(page,6);const b=await page.evaluate(EXTRA);await ctx.close();
   assert.ok(!a.tiles.net.lines.some(l=>/^Kosten/.test(l)),'geen kosten zonder sensor');assert.ok(!a.tiles.cupra.lines.some(l=>/^Sessie/.test(l)),'verouderde sessiewaarde niet tonen');
   assert.ok(!b.tiles.cupra.lines.some(l=>/^Sessie/.test(l)),'geen sessie als er niet wordt geladen');
   out.zonderKostenSessie={net:a.tiles.net.lines,cupra:a.tiles.cupra.lines};}
  // 3. geen kwartierdata ⇒ uurprijs; geen prijssensor ⇒ "geen data"
  {const {ctx,page}=await open(IMM,{width:844,height:390});await settle(page);
   await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states};s[c.prijs]={...s[c.prijs],state:'0.21',attributes:{unit_of_measurement:'EUR/kWh'}};window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});await frames(page,6);
   const h1=await page.evaluate(EXTRA);
   await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states};delete s[c.prijs];window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});await frames(page,6);
   const n=await page.evaluate(EXTRA);await ctx.close();
   assert.equal(h1.price.state,'hour');assert.match(h1.price.text,/Uurprijs/);assert.match(h1.price.text,/€ 0,210/);assert.equal(h1.price.bars,0,'geen staafjes zonder kwartierdata');assert.match(h1.price.aria,/Geen kwartierdata/);
   assert.equal(n.price.state,'none');assert.match(n.price.text,/Kwartierprijs.*geen data/);assert.equal(n.price.bars,0);
   out.prijs={uur:h1.price.text,geen:n.price.text};}
  // 4. offline: geen dagtotalen (geen verouderde getallen als actueel)
  {const {ctx,page}=await open(IMM,{width:844,height:390});await settle(page);
   await page.evaluate(()=>window.__push([],{connected:false}));await frames(page,6);const o=await page.evaluate(EXTRA);await ctx.close();
   assert.ok(Object.values(o.tiles).every(t=>t.lines.length===0),'offline: geen dagtotalen');out.offline=true;}
  return out;
 });
 await check('pil bovenaan: datum en buitentemperatuur naast de tijd (weer-entiteit, anders Cupra-buitentemperatuur; verouderd/onbekend ⇒ alleen datum; offline ⇒ niets extra)',async()=>{
  const PILL=()=>{const sr=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot,p=sr.querySelector('.ehm-pill'),x=p.querySelector('.p-extra'),r=p.getBoundingClientRect(),xr=x?x.getBoundingClientRect():null;
   return {text:p.textContent.replace(/\s+/g,' ').trim(),extra:x&&!x.hidden?x.textContent:null,fits:!!xr&&xr.right<=r.right+0.5&&xr.left>=r.left-0.5&&p.scrollWidth<=p.clientWidth+1,time:p.querySelector('.p-time').textContent};};
  const date=new Date().toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\.$/,'');
  const out={};
  for(const [w,h] of [[844,390],[390,844],[1280,800]]){
   const {ctx,page,errors}=await open(IMM,{width:w,height:h});await settle(page);const a=await page.evaluate(PILL);await ctx.close();
   assert.equal(a.extra,date+' · 14°','datum en temperatuur '+w);assert.ok(a.fits,'past in de pil '+JSON.stringify(a));assert.match(a.time,/^\d\d:\d\d$/);assert.deepEqual(errors,[]);out[w]=a.text;
  }
  {const {ctx,page}=await open(IMM,{width:844,height:390});await settle(page);
   // weer-entiteit heeft voorrang (°F wordt omgerekend)
   await page.evaluate(()=>{const card=document.querySelector('energiehuis-card');card.config.weather='weather.thuis';const s={...window.__hass.states};const t=new Date().toISOString();s['weather.thuis']={entity_id:'weather.thuis',state:'sunny',attributes:{temperature:50,temperature_unit:'°F'},last_updated:t,last_changed:t};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
   const w=await page.evaluate(PILL);
   // verouderde bron (4 uur) ⇒ alleen datum
   await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,old=new Date(Date.now()-4*3600000).toISOString(),s={...window.__hass.states};s['weather.thuis']={...s['weather.thuis'],last_updated:old,last_changed:old};s[c.cupra_outside_temp]={...s[c.cupra_outside_temp],last_updated:old,last_changed:old};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
   const old=await page.evaluate(PILL);
   // onbekende eenheid ⇒ geen temperatuur
   await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,t=new Date().toISOString(),s={...window.__hass.states};delete s['weather.thuis'];s[c.cupra_outside_temp]={...s[c.cupra_outside_temp],state:'288',attributes:{unit_of_measurement:'K'},last_updated:t,last_changed:t};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
   const unit=await page.evaluate(PILL);
   await page.evaluate(()=>window.__push([],{connected:false}));await frames(page,6);const off=await page.evaluate(PILL);await ctx.close();
   assert.equal(w.extra,date+' · 10°','50 °F = 10 °C');assert.equal(old.extra,date,'verouderde bronnen: alleen datum');assert.equal(unit.extra,date,'onbekende eenheid: alleen datum');
   assert.equal(off.extra,null,'offline: geen datum of temperatuur');
   out.fallbacks={weerF:w.extra,oud:old.extra,eenheid:unit.extra};}
  return out;
 });
 await check('alleen-lezen: één statistiekvraag per 5 minuten (60 hass-updates ⇒ 1), geen service- of schrijfaanroepen; Net-pagina en navigatie ongewijzigd bereikbaar',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:844,height:390});await settle(page);
  for(let i=0;i<60;i++){await page.evaluate(i=>window.__push([['net',-380-i,'W'],['zonnepanelen',4820+i,'W']]),i);}
  await frames(page,6);await clickTile(page,'net');await frames(page,4);const v=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);
  const x=await page.evaluate(()=>({stats:window.__calls.filter(t=>t==='recorder/statistics_during_period').length,other:window.__calls.filter(t=>!['media_source/resolve_media','recorder/statistics_during_period','history/history_during_period'].includes(t))}));
  await ctx.close();
  assert.equal(v,'grid');assert.equal(x.stats,1,'één statistiekvraag');assert.deepEqual(x.other,[],'geen servicecalls of andere aanroepen');assert.deepEqual(errors,[]);
  return x;
 });

 await check('toetsenbord en VoiceOver-semantiek: Tab naar kaart, Enter ⇒ pagina met focus op de kop; Enter op "Terug naar Home" ⇒ focus terug op de kaart',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:1280,height:800});
  let key=null;
  for(let i=0;i<20&&!key;i++){await page.keyboard.press('Tab');key=await page.evaluate(()=>{const h=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home');const a=h?.shadowRoot.activeElement;return a?.classList.contains('tile')?a.dataset.key:null;});}
  await page.keyboard.press('Enter');await frames(page,3);
  const onPage=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),a=c.shadowRoot.activeElement;return {view:c._view,focus:a?.id||a?.tagName,role:a?.tagName};});
  await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').focus());
  await page.keyboard.press('Enter');await frames(page,3);
  const back=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),h=c.shadowRoot.querySelector('.eh-live-home');return {view:c._view,focus:h.shadowRoot.activeElement?.dataset?.key};});
  await ctx.close();
  assert.ok(key);assert.notEqual(onPage.view,'overview');assert.ok(onPage.role==='H2'||onPage.focus==='eh-imm-title',JSON.stringify(onPage));
  assert.deepEqual(back,{view:'overview',focus:key});
  assert.deepEqual(errors,[]);
  return {key,onPage,back};
 });

 await check('robuust: ontbrekende master, offline en verouderde Alfen ⇒ Home blijft bruikbaar en alle bestemmingen bereikbaar; geen servicecalls',async()=>{
  const res={};
  for(const [name,mode,mut] of [['geen-master','fail',null],['offline','ok','offline'],['alfen-oud','ok','alfen']]){
   const {ctx,page,errors}=await open(IMM,{width:390,height:844,mode});
   if(mut==='offline')await page.evaluate(()=>window.__push([],{connected:false}));
   if(mut==='alfen')await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states},o=s[c.laden];s[c.laden]={...o,state:'2980',last_updated:new Date(Date.now()-7200000).toISOString(),last_changed:new Date(Date.now()-7200000).toISOString(),last_reported:new Date(Date.now()-7200000).toISOString()};window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});
   await frames(page,4);
   const s=await page.evaluate(HOME);const reached=[];
   for(const [key,view] of [['pv','sun'],['house','home'],['net','grid'],['battery','battery'],['cupra','cupra'],['practice','practice']]){
    await clickTile(page,key);await frames(page,3);reached.push((await page.evaluate(()=>document.querySelector('energiehuis-card')._view))===view);
    await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').click());await frames(page,3);
   }
   // Alleen-lezen WS-opdrachten (beeld, recorder, history) zijn toegestaan; geen servicecalls of schrijfacties.
   const calls=await page.evaluate(()=>window.__calls.filter(c=>!['media_source/resolve_media','recorder/statistics_during_period','history/history_during_period'].includes(c)));
   res[name]={layout:s.layout,scene:s.scene,imm:s.imm,badge:s.badge,reached:reached.every(Boolean),calls,errors};
   await ctx.close();
  }
  assert.equal(res['geen-master'].layout,'list');assert.equal(res['geen-master'].scene,'error');
  assert.match(res.offline.badge,/OFFLINE|Offline/);
  for(const [n,v] of Object.entries(res)){assert.equal(v.imm,true,n);assert.equal(v.reached,true,n);assert.deepEqual(v.calls,[],n);assert.deepEqual(v.errors,[],n);}
  return res;
 });

 await check('reduced motion en 200 % tekst: geen animatielus; navigatie werkt; lijstweergave zonder afkapping of horizontale scroll',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:390,height:844,reducedMotion:'reduce',fontScale:2});
  const anim=await page.evaluate(()=>document.querySelector('energiehuis-card')._ehLive.ctl.cockpit.isAnimating());
  const s=await page.evaluate(HOME);
  await clickTile(page,'house');await frames(page,3);const v=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);
  await ctx.close();
  assert.equal(anim,false);assert.equal(s.layout,'list');assert.equal(s.overflow,false);assert.equal(v,'home');
  assert.deepEqual(errors,[]);
  return {anim,layout:s.layout,v};
 });

 await browser.close();server.close();
 console.log(`\n${results.length}/${results.length+failed} immersive-controles geslaagd (${browserType.name()} ${''})`);
 process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
