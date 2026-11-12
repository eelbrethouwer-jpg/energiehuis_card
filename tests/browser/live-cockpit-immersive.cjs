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
   // GESIMULEERDE HA-gegevens (testdata): consistente tellers, vaste klok, instelbare sessies, gaten en resets (window.__simCfg).
   if(msg.type==='recorder/statistics_during_period'){
    if(window.__stats==='throw')throw new Error('recorder niet beschikbaar');
    if(window.__stats===false)return {};
    const out={};
    for(const id of msg.statistic_ids)if(window.__sim.rows[id])out[id]=window.__sim.rows[id].map(r=>({...r}));
    return out;
   }
   if(msg.type==='history/history_during_period'){
    if(window.__histFail)throw new Error('historie niet beschikbaar');
    const out={};for(const id of msg.entity_ids)if(window.__sim.history[id])out[id]=window.__sim.history[id].map(r=>({...r}));
    return out;
   }
   return {};
  },callApi:async()=>[],callService:()=>{throw Error('Ongewenste servicecall')},hassUrl:p=>new URL(p,location.origin).toString()};
 // ---- gesimuleerde, onderling consistente gegevens ----
 {
  const cfg=window.__simCfg||{},H=3600000,t0=(()=>{const d=new Date(now);d.setHours(0,0,0,0);return d.getTime();})();
  const full=Math.max(0,Math.floor((now-t0-600000)/H)),mH=i=>i%3+1;
  // Tellers met een vast uurpatroon: kWh-stand F(t) = basis + k × Σ patroon.
  const F=(meter,t)=>{const rel=Math.max(0,t-t0);const i=Math.floor(rel/H),fr=(rel-i*H)/H;let sum=0;for(let r=0;r<i;r++)sum+=mH(r);return meter.base+meter.k*(sum+mH(i)*fr);};
  const meters={[c.import]:{base:1200,k:.25},[c.export]:{base:800,k:.18}};
  // Alfen: segmenten [van,tot,kW] (ms); standaard een eerdere sessie vanochtend en een lopende sessie van 40 minuten.
  const segs=cfg.alfenMin?cfg.alfenMin.map(([a,b,kw])=>[now-a*60000,now-b*60000,kw]):[[now-300*60000,now-200*60000,7.4],[now-40*60000,now,2.98]];
  const rawA=t=>5000+segs.reduce((a,[f,e,kw])=>a+kw*Math.max(0,Math.min(t,e)-f)/H*(t>f?1:0),0);
  const resetT=cfg.resetMinAgo!=null?now-cfg.resetMinAgo*60000:null;
  const A=t=>resetT!==null&&t>=resetT?rawA(t)-rawA(resetT):rawA(t);
  const val=(id,t)=>id===c.laad_energie?A(t):F(meters[id],t);
  const rows={};
  for(const id of [c.import,c.export,c.laad_energie]){
   rows[id]=[];
   for(let j=-1;j<full;j++){
    const st0=t0+j*H,en=st0+H,state=val(id,en),ch=j<0?0:val(id,en)-val(id,st0);
    // HA corrigeert een tellerreset in `change`/`sum`; de `state` zakt wel.
    rows[id].push({start:st0,end:en,state,sum:state-1000,change:Math.max(0,ch)});
   }
   if(cfg.gapHour!=null)rows[id]=rows[id].filter(r=>r.start!==t0+cfg.gapHour*H);
   if(cfg.negativeHour!=null)rows[id].forEach(r=>{if(r.start===t0+cfg.negativeHour*H)r.change=-5;});
  }
  // Alfen-historie (compact): elke 5 minuten over 36 uur + de knikpunten van de segmenten; eerste punt met eenheid.
  const pts=new Set();for(let t=now-36*H;t<=now;t+=5*60000)pts.add(Math.round(t));
  for(const [f,e] of segs){pts.add(f);pts.add(e);} if(resetT!==null){pts.add(resetT-1);pts.add(resetT);} pts.add(now);
  const hist=[...pts].filter(t=>t<=now&&t>=now-36*H).sort((x,y)=>x-y).map((t,i)=>({s:String(A(t)),lu:t/1000,...(i===0?{a:{unit_of_measurement:'kWh'}}:{})}));
  window.__sim={rows,history:cfg.noHistory?{}:{[c.laad_energie]:hist},t0,full,
   expected:{imp:F(meters[c.import],now)-F(meters[c.import],t0),exp:F(meters[c.export],now)-F(meters[c.export],t0),ev:A(now)-A(t0)}};
  states[c.import]=st(c.import,F(meters[c.import],now),'kWh');states[c.export]=st(c.export,F(meters[c.export],now),'kWh');
  states[c.laad_energie]=st(c.laad_energie,A(now),'kWh',cfg.alfenStaleMin!=null?cfg.alfenStaleMin*60:2);
  // Zonneplan-kwartierprijzen: echte tijdstempels (92/96/100 per dag), optioneel negatief of met gaten.
  const dayEnd=new Date(t0);dayEnd.setDate(dayEnd.getDate()+1);const nq=Math.round((dayEnd.getTime()-t0)/900000);
  const fc=[];for(let i=0;i<nq;i++){if(cfg.quarterGaps&&i%7===3)continue;fc.push({start_date:new Date(t0+i*900000).toISOString(),price_tax_included:+((cfg.negative?-0.05:0.2)+0.08*Math.sin(i/9)+(i>=68&&i<80?0.07:0)).toFixed(4)});}
  window.__sim.quarters=nq;window.__sim.forecast=fc;
  const cur=fc.find(q=>{const t=Date.parse(q.start_date);return now>=t&&now<t+900000;});
  states[c.prijs]={entity_id:c.prijs,state:String(cur?cur.price_tax_included:0.22),attributes:{unit_of_measurement:'EUR/kWh',forecast:fc},last_updated:iso(2),last_changed:iso(2),last_reported:iso(2)};
  // Dagopbrengst zo dat het huis (afname − teruglevering + opwek − laden) 7,03 kWh is.
  window.__sim.pv=+(window.__sim.expected.ev-window.__sim.expected.imp+window.__sim.expected.exp+7.03).toFixed(2);window.__sim.expected.pv=window.__sim.pv;window.__sim.expected.home=window.__sim.expected.imp-window.__sim.expected.exp+window.__sim.pv-window.__sim.expected.ev;
  states[c.zonne_energie]=st(c.zonne_energie,window.__sim.pv,'kWh');states[c.cost_zonneplan_day]=st(c.cost_zonneplan_day,0.31,'EUR',30);
  states[c.cupra_outside_temp]=st(c.cupra_outside_temp,14.4,'°C',600);
 }
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
 if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
 // Screenshot met een duidelijke vermelding onderaan dat de data fictief is (de render zelf blijft pixel-exact).
 const SHA=process.env.EH_SHA||(()=>{try{return require('node:child_process').execSync('git rev-parse HEAD',{cwd:path.join(__dirname,'..','..')}).toString().trim();}catch(_){return 'onbekend';}})();
 async function shot(page,name){
  const buf=await page.screenshot(),vp=page.viewportSize(),bar=34;
  const stamp=await browser.newPage({viewport:{width:vp.width,height:vp.height+bar}});
  const text='FICTIEVE TESTDATA — gesimuleerde HA-gegevens en '+(process.env.EH_LIVE_MASTER?'lokaal beeld (privé)':'synthetisch beeld (niet de goedgekeurde master)')+' · '+browserType.name()+' · '+SHA.slice(0,12);
  const url=await stamp.evaluate(async([b64,w,h,bar,text])=>{
   const img=new Image();await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src='data:image/png;base64,'+b64;});
   const c=document.createElement('canvas');c.width=w;c.height=h+bar;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,w,h+bar);g.drawImage(img,0,0,w,h);
   g.fillStyle='#b00020';g.fillRect(0,h,w,bar);g.fillStyle='#fff';g.font='bold '+Math.max(9,Math.min(13,w/52))+'px Arial,sans-serif';g.textBaseline='middle';g.fillText(text,8,h+bar/2);
   return c.toDataURL('image/png');
  },[buf.toString('base64'),vp.width,vp.height,bar,text]);
  await stamp.close();
  fs.writeFileSync(path.join(SHOTS,name),Buffer.from(url.split(',')[1],'base64'));
 }
 console.log(browserType.name(),browser.version());
 async function open(config,{width=1300,height=900,mode='ok',dpr=1,wait=true,reducedMotion='no-preference',fontScale=1,hasTouch=false,init=null,sim=null,time=process.env.EH_TEST_TIME||null,tz='Europe/Amsterdam'}={}){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,locale:'nl-NL',timezoneId:tz,reducedMotion,hasTouch});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/40[134]|Failed to load resource/.test(m.text()))errors.push(m.text());});
  if(sim)await page.addInitScript(c=>{window.__simCfg=c;},sim);
  if(init)await page.addInitScript(init);
  // Vaste starttijd zonder Playwright-klok: alleen Date start op dat moment en loopt daarna gewoon door (timers en rAF blijven echt).
  if(time)await page.addInitScript(t=>{const R=Date,start=R.now(),base=t;
   class FD extends R{constructor(...a){if(a.length===0)super(base+(R.now()-start));else super(...a);}static now(){return base+(R.now()-start);}}
   window.Date=FD;},new Date(time).getTime());
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
   const shell0=card.shadowRoot.querySelector('.shell');
   let removals=0;
   const observe=records=>{for(const r of records)for(const n of r.removedNodes)if(n===shell0||n===host0||n.contains?.(host0))removals++;};
   const mo=new MutationObserver(observe);mo.observe(card.shadowRoot,{childList:true,subtree:true});
   for(let i=1;i<=60;i++){window.__push([['net',-400-i]]);if(i%10===0)await fr();}
   await fr();observe(mo.takeRecords());mo.disconnect();
   const sameShell=card.shadowRoot.querySelector('.shell')===shell0;
   const views=[];
   for(let round=0;round<3;round++)for(const k of ['pv','house','net','battery','cupra','practice']){
    card.shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehm-tiles .tile[data-key="'+k+'"]').click();await fr();views.push(card._view);
    card.shadowRoot.querySelector('.eh-imm-back[data-eh-page="overview"],.back-button[data-eh-page="overview"]').click();await fr();
   }
   await new Promise(res=>setTimeout(res,200));
   const host1=card.shadowRoot.querySelector('.eh-live-home');
   return {sameShell,removals,sameHost:host0===host1,sameImg:host1.shadowRoot.querySelector('.ehm-scene')===img0,ro:window.__ro-ro0,navs,views:views.length,resolves:window.__resolves,dbg:card._ehLive.ctl.debug,anim:card._ehLive.ctl.cockpit.isAnimating(),net:host1.shadowRoot.querySelector('.tile[data-key="net"] .t-value').textContent};
  });
  const media=log.filter(l=>l.startsWith('/media/')).length;await ctx.close();
  assert.equal(r.sameHost,true);assert.equal(r.sameImg,true);assert.equal(r.ro,0,'geen nieuwe ResizeObservers');
  assert.equal(r.sameShell,true,'meetupdates behouden de zichtbare shell');assert.equal(r.removals,0,'geen loskoppeling van shell of cockpit tijdens meetupdates');
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
  for(const [w,h] of seq){
   await page.setViewportSize({width:w,height:h});await frames(page,6);
   // WebKit past de lay-out iets later toe: wachten tot de navigatie de verwachte vorm heeft (rail liggend, balk in portret).
   let m=await page.evaluate(LAND);
   const want=w>h&&h<=500;for(let i=0;i<60&&(m.rail!==want||m.layout!==(want?'compact':'list'));i++){await frames(page,4);m=await page.evaluate(LAND);}
   assert.equal(m.layout,want?'compact':'list','laag na draaien naar '+w+'×'+h+' (binnen ± 4 s)');
   landed.push(m);
  }
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

 // ===== Definitieve Home: scène + vakjes + kwartierprijs; betrouwbare dagtotalen =====
 const EXTRA=()=>{
  const card=document.querySelector('energiehuis-card'),host=card.shadowRoot.querySelector('.eh-live-home'),sr=host.shadowRoot;
  const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height};};
  const ehc=sr.querySelector('.ehc'),tiles={};
  for(const b of sr.querySelectorAll('.ehm-tiles .tile')){
   const d=b.querySelector('.t-day'),shown=!!d&&!d.hidden&&d.getClientRects().length>0,spans=shown?[...d.querySelectorAll('span')]:[];
   tiles[b.dataset.key]={lines:d&&!d.hidden?[...d.querySelectorAll('span')].map(x=>x.textContent):[],shown,aria:b.getAttribute('aria-label'),rect:R(b),
    font:shown?parseFloat(getComputedStyle(d).fontSize):null,clip:spans.some(x=>x.scrollWidth>x.clientWidth+1),inside:shown?(r=>{const t=R(b);return r.l>=t.l-.5&&r.r<=t.r+.5&&r.t>=t.t-.5&&r.b<=t.b+.5;})(R(d)):null};
  }
  const p=sr.querySelector('.eh-price');
  return {tiles,layout:ehc.dataset.layout,form:ehc.dataset.layout==='list'?3:+ehc.dataset.dform,density:ehc.dataset.density,
   price:p?{tag:p.tagName,state:p.dataset.state,slots:+p.dataset.slots,text:p.textContent,aria:p.getAttribute('aria-label'),bars:p.querySelectorAll('rect').length,now:p.querySelectorAll('rect.now').length,zero:!!p.querySelector('line.zero'),svg:p.querySelector('svg')?.innerHTML||'',rect:R(p),pe:getComputedStyle(p).pointerEvents,shown:p.getClientRects().length>0}:null,
   panels:['.ehc-head','.ehc-summary','.ehm-legend'].map(q=>{const r=sr.querySelector(q).getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}),
   stage:R(sr.querySelector('.ehm-stage')),ehcR:R(ehc),sim:window.__sim&&{expected:window.__sim.expected,pv:window.__sim.pv,quarters:window.__sim.quarters},
   calls:window.__calls.slice()};
 };
 const fmtK=n=>Math.abs(n)>=100?n.toFixed(0).replace('.',','):Math.abs(n)>=10?n.toFixed(1).replace('.',','):n.toFixed(2).replace('.',',');
 const settle=async page=>{await page.waitForFunction(()=>window.__calls.includes('recorder/statistics_during_period'),null,{timeout:10000});await frames(page,8);};
 /** Verwachte dagregels per vorm (3 = breed/lijst, 2 = iPhone liggend, 1 = klein, 0 = zeer klein), uit de gesimuleerde bronnen. */
 const WANT=(e,form,sess)=>{
  const day=['','Dag ','Vandaag: ','Vandaag: '][form],K=n=>fmtK(n)+' kWh',cost='€ 0,31';
  const net=form>=3?['Afname: '+K(e.imp),'Teruggeleverd: '+K(e.exp),'Kosten: '+cost]:form===2?['Af '+K(e.imp).replace(' kWh','')+' · Terug '+K(e.exp),'Kosten: '+cost]:form===1?['Af '+fmtK(e.imp)+' · '+cost]:[K(e.imp)];
  const cup=[];
  if(form>=2){cup.push('Vandaag: '+K(e.ev));if(sess)cup.push(sess);}else if(sess)cup.push(form===1?sess.replace(': ',' '):sess.replace(/^Sessie: /,''));else cup.push(day+K(e.ev));
  return {pv:[day+K(e.pv)],house:[day+K(e.home)],cupra:cup,net,battery:[],practice:[]};
 };
 const VPS2=[[844,390,2],[932,430,2],[667,375,1],[568,320,1],[420,300,0],[390,844,3],[768,1024,2],[1280,800,3]];
 for(const [w,h,form] of VPS2){
  await check(`definitieve Home ${w}×${h}: alleen scène + vakjes + kwartierprijs-knop; dagtotalen uit gevalideerde bronnen in de vorm voor deze breedte; ≥ 9 px, niets afgekapt, geen overlap, geen horizontale scroll`,async()=>{
   const {ctx,page,errors}=await open(IMM,{width:w,height:h,hasTouch:true});await settle(page);
   const x=await page.evaluate(EXTRA),home=await page.evaluate(HOME);
   if(SHOTS)await shot(page,`home-final-${w}x${h}-${browserType.name()}.png`);
   await ctx.close();
   const T=x.tiles,want=WANT(x.sim.expected,x.form,'Sessie: 1,99 kWh'.replace(/^Sessie: /,x.form>=2?'Sessie: ':'Sessie: '));
   if(x.layout!=='list')assert.equal(x.form,form,'vorm voor deze breedte (stage '+Math.round(x.stage.w)+' px)');
   assert.deepEqual(x.panels.map(p=>p[0]<=1&&p[1]<=1),[true,true,true],'status/samenvatting/legenda alleen voor schermlezers');
   for(const k of ['pv','house','cupra','net','battery','practice'])assert.deepEqual(T[k].lines,want[k],k+' dagregels');
   assert.match(T.battery.aria,/simulatie/i);assert.doesNotMatch(T.practice.aria,/\d\s?kWh/,'praktijkruimte: geen fictieve getallen');
   for(const k of ['pv','house','cupra','net']){assert.equal(T[k].shown,true,k+' dagregel zichtbaar');assert.ok(T[k].font>=8.99,k+' tekst ≥ 9 px: '+T[k].font);assert.equal(T[k].clip,false,k+' niets afgekapt');assert.equal(T[k].inside,true,k+' dagregel binnen het vakje');}
   assert.match(T.net.aria,/Afname vandaag: .* kWh\. Teruggeleverd vandaag: .* kWh\. Kosten vandaag: € 0,31\./,'volledige toegankelijke naam');
   assert.match(T.cupra.aria,/Huidige laadsessie: 1,99 kWh\./);
   assert.ok(x.price&&x.price.shown,'kwartierprijs zichtbaar');assert.equal(x.price.tag,'BUTTON');assert.equal(x.price.state,'quarter');assert.equal(x.price.slots,x.sim.quarters);assert.ok(x.price.rect.w>=44&&x.price.rect.h>=44,'tikvlak ≥ 44×44: '+Math.round(x.price.rect.w)+'×'+Math.round(x.price.rect.h));
   assert.match(x.price.text,/Kwartierprijs/i);assert.match(x.price.text,/€ 0,\d{3}/);assert.equal(x.price.now,1);assert.equal(x.price.bars,x.sim.quarters);assert.equal(x.price.pe,'auto');
   assert.match(x.price.aria,/^Kwartierprijs: nu € 0,\d{3} per kWh \(kwartier \d\d:\d\d tot \d\d:\d\d\)\. Vandaag laagste .* \((92|96|100) van (92|96|100) kwartieren bekend\)\. Vandaag · morgen nog niet beschikbaar\. Tik voor het prijsoverzicht\.$/);
   if(x.layout!=='list'){
    const p=x.price.rect,ks=Object.keys(T);
    for(const k of ks){const r=T[k].rect;assert.ok(p.r<=r.l||p.l>=r.r||p.b<=r.t||p.t>=r.b,'kwartierprijs raakt vakje '+k);}
    for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=T[ks[i]].rect,b=T[ks[j]].rect;assert.ok(a.r<=b.l+.5||a.l>=b.r-.5||a.b<=b.t+.5||a.t>=b.b-.5,'vakjes '+ks[i]+' en '+ks[j]+' overlappen');}
    const st=x.stage,u=(v,k)=>st[k==='x'?'l':'t']+v*(k==='x'?st.w:st.h);
    assert.ok(p.t>=u(.8,'y'),'knop onder de auto en de kaarten (y ≥ 80 %)');assert.ok(p.l>=st.l&&p.r<=st.r+1&&p.b<=st.b+1,'knop binnen de scène');
    assert.ok(!(p.l<u(.93,'x')&&p.r>u(.64,'x')&&p.t<u(.8,'y')&&p.b>u(.52,'y')),'knop dekt de auto niet af');
   }else assert.ok(x.price.rect.t>=x.stage.b,'portret: prijs als rij onder de vakjes');
   assert.equal(home.overflow,false);assert.deepEqual(home.tiles.filter(t=>!t.hit).map(t=>t.key),[],'tikvlakken');assert.deepEqual(home.tiles.filter(t=>!t.covers).map(t=>t.key),[],'dekking');
   assert.deepEqual(errors,[]);
   return {form:x.form,lines:Object.fromEntries(Object.entries(T).map(([k,t])=>[k,t.lines])),font:T.net.font,price:x.price.text};
  });
 }
 const sessLine=async(sim,time,opts={})=>{
  const {ctx,page}=await open(IMM,{width:932,height:430,sim,time:time||'2026-11-12T14:37:00+01:00',...opts});await settle(page);   // vaste dag: uurgat en eerdere sessie liggen dan vandaag
  if(opts.afterOpen)await opts.afterOpen(page);
  const x=await page.evaluate(EXTRA);await ctx.close();return x;
 };
 await check('Cupra-laadsessie uit de Alfen-teller: actief, pauze en hervatten, nieuwe sessie, over middernacht; verouderd, ontbrekend of meterreset ⇒ "niet beschikbaar" (geen schatting)',async()=>{
  const out={},SESS=x=>x.tiles.cupra.lines.find(l=>/^Sessie/.test(l))||null,DAY=x=>x.tiles.cupra.lines.find(l=>/^Vandaag/.test(l))||null;
  const a=await sessLine(null);assert.equal(SESS(a),'Sessie: 1,99 kWh','actieve sessie 40 min × 2,98 kW');out.actief=SESS(a);
  assert.equal(DAY(a),'Vandaag: '+fmtK(a.sim.expected.ev)+' kWh','dagtotaal is niet de sessie (eerdere sessie vanochtend telt in het dagtotaal)');assert.notEqual(fmtK(a.sim.expected.ev),'1,99');
  const pa=await sessLine({alfenMin:[[90,50,2.98],[20,0,2.98]]});assert.equal(SESS(pa),'Sessie: 2,98 kWh','pauze van 30 min: dezelfde sessie (40 + 20 min)');out.pauze=SESS(pa);
  const nw=await sessLine({alfenMin:[[100,70,2.98],[20,0,2.98]]});assert.equal(SESS(nw),'Sessie: 0,99 kWh','pauze van 50 min: nieuwe sessie van 20 min');out.nieuw=SESS(nw);
  const mid=await sessLine({alfenMin:[[55,0,2.98]]},'2026-11-13T00:25:00+01:00');
  assert.equal(SESS(mid),'Sessie: 2,73 kWh','sessie begon 23:30, nu 00:25');assert.equal(DAY(mid),'Vandaag: 1,24 kWh','dagtotaal telt alleen vanaf middernacht (25 min)');out.middernacht=[SESS(mid),DAY(mid)];
  const rs=await sessLine({alfenMin:[[60,0,2.98]],resetMinAgo:20});assert.equal(SESS(rs),'Sessie: niet beschikbaar','meterreset tijdens de sessie');out.reset=SESS(rs);
  assert.match(rs.tiles.cupra.aria,/Huidige laadsessie: niet beschikbaar/);
  const st=await sessLine({alfenStaleMin:20});assert.equal(SESS(st),'Sessie: niet beschikbaar','verouderde Alfen-stand');out.verouderd=SESS(st);
  const nh=await sessLine({noHistory:true});assert.equal(SESS(nh),'Sessie: niet beschikbaar','ontbrekende historie');out.geenHistorie=SESS(nh);
  const hf=await sessLine(null,undefined,{init:()=>{window.__histFail=true;}});assert.equal(SESS(hf),'Sessie: niet beschikbaar','historie niet op te halen');
  const idle=await sessLine(null,undefined,{afterOpen:async p=>{await p.evaluate(()=>window.__push([['laden',0,'W']]));await frames(p,6);}});assert.equal(SESS(idle),null,'geen actieve laadsessie: geen sessieregel');
  return out;
 });
 await check('dagtotalen met onvolledige historie: ontbrekend uur ⇒ "≥" (deels), huis "onvolledig"; tellerreset, ontbrekende of falende statistieken ⇒ geen volledig getal; offline ⇒ geen dagtotalen',async()=>{
  const out={};
  const g=await sessLine({gapHour:5});
  assert.match(g.tiles.net.lines[0],/^Af ≥ [\d,]+ · Terug ≥ [\d,]+ kWh$/);assert.match(g.tiles.cupra.lines[0],/^Vandaag: ≥ [\d,]+ kWh$/);assert.deepEqual(g.tiles.house.lines,['Vandaag: onvolledig']);assert.deepEqual(g.tiles.pv.lines,['Vandaag: '+fmtK(g.sim.pv)+' kWh'],'dagsensor omvormer blijft volledig');
  assert.match(g.tiles.net.aria,/gedeeltelijk gemeten, minstens/);out.gat=[g.tiles.net.lines[0],g.tiles.house.lines[0]];
  const wide=await sessLine({gapHour:5},undefined,{width:1280,height:800});
  const n=await sessLine({negativeHour:6});assert.match(n.tiles.net.lines[0],/≥/,'tellerreset/negatieve uurwaarde: ondergrens');assert.deepEqual(n.tiles.house.lines,['Vandaag: onvolledig']);
  const hasEv=a=>a.tiles.cupra.lines.some(l=>/^Vandaag/.test(l));
  for(const [name,init] of [['statistieken leeg',()=>{window.__stats=false;}],['statistieken falen',()=>{window.__stats='throw';}]]){
   const x=await sessLine(null,undefined,{init});
   assert.equal(hasEv(x),false,name);assert.deepEqual(x.tiles.house.lines,['Vandaag: onvolledig'],name+': huis kan niet worden bepaald');assert.ok(!x.tiles.net.lines.some(l=>/^Af|Afname/.test(l)),name+': geen afname');assert.deepEqual(x.tiles.pv.lines,['Vandaag: '+fmtK(x.sim.pv)+' kWh'],name+': dagsensor');assert.deepEqual(x.tiles.net.lines,['Kosten: € 0,31']);out[name]=true;
  }
  const off=await sessLine(null,undefined,{afterOpen:async p=>{await p.evaluate(()=>window.__push([],{connected:false}));await frames(p,6);}});
  assert.ok(Object.values(off.tiles).every(t=>t.lines.length===0),'offline: geen dagtotalen');out.offline=true;
  return out;
 });
 await check('kwartierprijs: 92/96/100 kwartieren (zomer-/wintertijd) op echte tijdstempels, negatieve prijzen met nulbasislijn, ontbrekende kwartieren blijven leeg, uurprijs- en geen-data-fallback; gewijzigde forecast rendert opnieuw',async()=>{
  const out={};
  for(const [time,n] of [['2026-03-29T14:37:00+02:00',92],['2026-11-12T14:37:00+01:00',96],['2026-10-25T14:37:00+01:00',100]]){
   const x=await sessLine(null,time);
   assert.equal(x.price.slots,n,time);assert.equal(x.sim.quarters,n);assert.equal(x.price.bars,n,'één staaf per kwartier');assert.equal(x.price.now,1);assert.match(x.price.aria,new RegExp('\\('+n+' van '+n+' kwartieren bekend\\)'));
   assert.ok(x.price.svg.includes('class="nowline"'));out[n]=x.price.bars;
  }
  const neg=await sessLine({negative:true});assert.equal(neg.price.zero,true,'nulbasislijn bij negatieve prijzen');assert.match(neg.price.text,/€ 0,\d{3}|−€ 0,\d{3}/);assert.match(neg.price.aria,/laagste −€ 0,/);
  const gaps=await sessLine({quarterGaps:true});assert.equal(gaps.price.bars,96-Math.ceil((96-3)/7),'ontbrekende kwartieren blijven leeg (geen interpolatie)');assert.match(gaps.price.aria,/kwartieren bekend/);
  // gewijzigde forecast (zelfde aantal kwartieren, één toekomstige prijs anders) ⇒ nieuwe render
  const {ctx,page}=await open(IMM,{width:932,height:430});await settle(page);
  const before=await page.evaluate(EXTRA);
  await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states},e=s[c.prijs],fc=e.attributes.forecast.map((q,i)=>i===85?{...q,price_tax_included:+(q.price_tax_included+0.05).toFixed(4)}:q);s[c.prijs]={...e,attributes:{...e.attributes,forecast:fc}};window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});await frames(page,6);
  const after=await page.evaluate(EXTRA);
  assert.notEqual(before.price.svg,after.price.svg,'gewijzigde toekomstige prijs ⇒ grafiek opnieuw gerenderd');assert.equal(after.price.bars,after.sim.quarters);
  await page.evaluate(()=>{
   const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states},e=s[c.prijs];
   const tomorrow=new Date();tomorrow.setHours(0,0,0,0);tomorrow.setDate(tomorrow.getDate()+1);
   const fc=e.attributes.forecast.concat(Array.from({length:96},(_,i)=>({start_date:new Date(+tomorrow+i*900000).toISOString(),price_tax_included:i===20?-.05:.25})));
   s[c.prijs]={...e,attributes:{...e.attributes,forecast:fc}};window.__hass={...window.__hass,states:s};card.hass=window.__hass;
  });await frames(page,6);
  const twoDays=await page.evaluate(EXTRA);await ctx.close();
  assert.equal(twoDays.price.slots,192);assert.equal(twoDays.price.bars,192);assert.equal(twoDays.price.now,1);
  assert.ok(twoDays.price.svg.includes('class="daybreak"'));assert.match(twoDays.price.aria,/Vandaag en morgen/);assert.match(twoDays.price.text,/Vandaag · morgen/);
  out.update=true;out.tomorrow=twoDays.price.bars;return out;
 });
 await check('HA-laadplanning: zelfde bestaande helpers, groen/oranje kwartieren tot vertrek, prijsgrens en wijzigingen zonder nieuwe forecast of loskoppeling',async()=>{
  const {ctx,page,errors}=await open({...IMM,live_cockpit_planning:true},{width:932,height:430});await settle(page);
  await page.evaluate(()=>{
   const card=document.querySelector('energiehuis-card'),s={...window.__hass.states},now=new Date(),departure=new Date(+now+6*3600000);
   for(const [id,v] of Object.entries({'input_select.cupra_prijsstrategie':'Goedkoopste kwartieren','input_number.cupra_gewenste_soc':'80','sensor.cupra_actuele_laadgrens':'.25','sensor.cupra_slim_effectieve_vertrektijd':departure.toISOString(),'sensor.cupra_slim_minimaal_bekende_kwartieren_nodig':'3'}))s[id]={state:v};
   window.__hass={...window.__hass,states:s};card.hass=window.__hass;
  });await frames(page,6);
  const plan=await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),sr=card._ehLive.ctl.host.shadowRoot;window.__planShell=card.shadowRoot.querySelector('.shell');return {planned:sr.querySelectorAll('rect.planned').length,waiting:sr.querySelectorAll('rect.waiting').length,text:sr.querySelector('.eh-price').textContent,limit:!!sr.querySelector('line.limit')};});
  assert.equal(plan.planned,3);assert.ok(plan.waiting>0);assert.match(plan.text,/Laadplanning/);assert.equal(plan.limit,false);
  await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),s={...window.__hass.states};s['sensor.cupra_slim_minimaal_bekende_kwartieren_nodig']={state:'1'};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
  const changed=await page.evaluate(()=>{const card=document.querySelector('energiehuis-card');return {same:window.__planShell===card.shadowRoot.querySelector('.shell'),planned:card._ehLive.ctl.host.shadowRoot.querySelectorAll('rect.planned').length};});
  assert.deepEqual(changed,{same:true,planned:1});
  await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),s={...window.__hass.states};s['input_select.cupra_prijsstrategie']={state:'Vast'};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
  assert.equal(await page.evaluate(()=>!!document.querySelector('energiehuis-card')._ehLive.ctl.host.shadowRoot.querySelector('line.limit')),true);
  await page.evaluate(()=>{const card=document.querySelector('energiehuis-card'),s={...window.__hass.states};s['sensor.cupra_actuele_laadgrens']={state:'unavailable'};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});await frames(page,6);
  const unavailable=await page.evaluate(()=>{const sr=document.querySelector('energiehuis-card')._ehLive.ctl.host.shadowRoot;return {planned:sr.querySelectorAll('rect.planned,rect.waiting,rect.cheap').length,text:sr.querySelector('.eh-price').textContent};});
  assert.equal(unavailable.planned,0);assert.match(unavailable.text,/Planning n.b./);assert.match(unavailable.text,/laadgrens ontbreekt/);
  assert.deepEqual(errors,[]);await ctx.close();return {plan,changed,unavailable};
 });
 await check('kwartierprijs-knop: tik, klik en toetsenbord (Enter/Space) openen het bestaande prijsoverzicht (Slim laden); ≥ 44×44, bereikbaar en onbedekt op 320/390/430/844/932; terug naar Home met focus op de knop',async()=>{
  const out={};
  for(const [w,h] of [[320,568],[390,844],[430,932],[844,390],[932,430]]){
   for(const input of ['pointer','touch','keys']){
    const {ctx,page,errors}=await open(IMM,{width:w,height:h,hasTouch:input==='touch'});await settle(page);
    const t=await page.evaluate(()=>{
     const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,host=root.querySelector('.eh-live-home'),sr=host.shadowRoot,el=sr.querySelector('.eh-price');
     const nb=root.querySelector('.shell > .nav').getBoundingClientRect(),limit=Math.min(innerHeight,nb.width<innerWidth*.5?innerHeight:nb.top);
     let r=el.getBoundingClientRect();if(r.top<0||r.bottom>limit){window.scrollBy({top:r.top+r.height/2-limit/2,behavior:'instant'});r=el.getBoundingClientRect();}
     const deep=(x,y)=>{let e=document.elementFromPoint(x,y);for(let i=0;i<4&&e&&e.shadowRoot;i++){const n=e.shadowRoot.elementFromPoint(x,y);if(!n||n===e)break;e=n;}return e;};
     const cx=r.left+r.width/2,cy=r.top+r.height/2,pts=[[cx,cy],[cx-20,cy-20],[cx+20,cy-20],[cx-20,cy+20],[cx+20,cy+20]];
     return {x:cx,y:cy,w:r.width,h:r.height,inView:r.top>=0&&r.bottom<=limit+.5&&r.left>=0&&r.right<=innerWidth,hit:pts.every(([a,b])=>{const e=deep(a,b);return !!e&&(e===el||el.contains(e));})};
    });
    assert.ok(t.w>=44&&t.h>=44,`tikvlak ${Math.round(t.w)}×${Math.round(t.h)} op ${w}×${h}`);assert.ok(t.inView,'zichtbaar op '+w+'×'+h);assert.ok(t.hit,'niet bedekt door nav/hotspots op '+w+'×'+h);
    if(input==='pointer')await page.mouse.click(t.x,t.y);
    else if(input==='touch')await page.touchscreen.tap(t.x,t.y);
    else{await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.eh-price').focus());await page.keyboard.press(w===390?'Space':'Enter');}
    await frames(page,5);
    const v=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),r=c.shadowRoot;return {view:c._view,price:!!r.querySelector('.cupra-price-bars'),title:r.querySelector('h2')?.textContent,back:r.querySelector('.back-button[data-eh-page="overview"]')?.getAttribute('aria-label'),from:c._ehImmFrom};});
    assert.equal(v.view,'charge',`${input} ${w}×${h}`);assert.equal(v.price,true,'bestaand prijsoverzicht (kwartierprijzen) zichtbaar');assert.equal(v.title,'Slim laden');assert.equal(v.from,'price');
    await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh26-navitem[data-eh-page="overview"]').click());await frames(page,6);
    const back=await page.evaluate(()=>{const c=document.querySelector('energiehuis-card'),sr=c.shadowRoot.querySelector('.eh-live-home')?.shadowRoot;return {view:c._view,focus:sr?.activeElement?.className||null,suspended:c._ehLive.ctl.debug.suspended};});
    assert.equal(back.view,'overview');assert.equal(back.focus,'eh-price','focus terug op de prijsknop');assert.equal(back.suspended,false);
    await ctx.close();assert.deepEqual(errors,[]);
   }
   out[w+'x'+h]=true;
  }
  return out;
 });
 await check('alleen-lezen: één statistiekvraag en één historievraag (laden) per 150 s–5 min (60 hass-updates ⇒ 1 + 1), geen service- of schrijfaanroepen; Net-pagina en navigatie ongewijzigd bereikbaar',async()=>{
  const {ctx,page,errors}=await open(IMM,{width:844,height:390});await settle(page);
  for(let i=0;i<60;i++){await page.evaluate(i=>window.__push([['net',-380-i,'W'],['zonnepanelen',4820+i,'W']]),i);}
  await frames(page,6);await clickTile(page,'net');await frames(page,4);const v=await page.evaluate(()=>document.querySelector('energiehuis-card')._view);
  const x=await page.evaluate(()=>({stats:window.__calls.filter(t=>t==='recorder/statistics_during_period').length,hist:window.__calls.filter(t=>t==='history/history_during_period').length,other:window.__calls.filter(t=>!['media_source/resolve_media','recorder/statistics_during_period','history/history_during_period'].includes(t))}));
  await ctx.close();
  assert.equal(v,'grid');assert.equal(x.stats,1,'één gedeelde statistiekvraag');assert.equal(x.hist,1,'één historievraag voor de sessie');assert.deepEqual(x.other,[],'geen servicecalls of andere aanroepen');assert.deepEqual(errors,[]);
  return x;
 });
 await check('prijs- en kostenfallbacks: geen kwartierdata ⇒ uurprijs, geen prijssensor ⇒ "geen data", kostensensor ontbreekt/verouderd/onbekende eenheid ⇒ geen kostenregel (nooit € 0)',async()=>{
  const out={};
  const mutate=async(fn,time)=>{const {ctx,page}=await open(IMM,{width:932,height:430,time});await settle(page);await page.evaluate(fn);await frames(page,8);const x=await page.evaluate(EXTRA);await ctx.close();return x;};
  const hour=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states};s[c.prijs]={...s[c.prijs],state:'0.21',attributes:{unit_of_measurement:'EUR/kWh'}};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  assert.equal(hour.price.state,'hour');assert.match(hour.price.text,/Uurprijs/);assert.match(hour.price.text,/€ 0,210/);assert.equal(hour.price.bars,0,'geen staafjes zonder kwartierdata (geen 4 gekopieerde kwartieren)');assert.match(hour.price.aria,/Geen kwartierdata/);
  const none=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states};delete s[c.prijs];window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  assert.equal(none.price.state,'none');assert.match(none.price.text,/Kwartierprijs.*geen data/);assert.equal(none.price.bars,0);
  const few=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states},e=s[c.prijs];s[c.prijs]={...e,attributes:{...e.attributes,forecast:e.attributes.forecast.slice(40,45)}};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  assert.equal(few.price.state,'hour','te weinig kwartieren (5) ⇒ geen grafiek');
  const costOf=x=>x.tiles.net.lines.some(l=>/Kosten/.test(l));
  const noCost=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states};delete s[c.cost_zonneplan_day];window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  const stale=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states},old=new Date(Date.now()-30*3600000).toISOString();s[c.cost_zonneplan_day]={...s[c.cost_zonneplan_day],last_updated:old,last_changed:old};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  const cents=await mutate(()=>{const card=document.querySelector('energiehuis-card'),c=card.config,s={...window.__hass.states};s[c.cost_zonneplan_day]={...s[c.cost_zonneplan_day],attributes:{unit_of_measurement:'ct'}};window.__hass={...window.__hass,states:s};card.hass=window.__hass;});
  assert.deepEqual([costOf(noCost),costOf(stale),costOf(cents)],[false,false,false]);
  out.prijs={uur:hour.price.text,geen:none.price.text};out.kosten='verborgen bij ontbrekend, verouderd en onbekende eenheid';
  return out;
 });
 await check('pil bovenaan: datum en buitentemperatuur naast de tijd (weer-entiteit, anders Cupra-buitentemperatuur; verouderd/onbekend ⇒ alleen datum; offline ⇒ niets extra)',async()=>{
  const PILL=()=>{const sr=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot,p=sr.querySelector('.ehm-pill'),x=p.querySelector('.p-extra'),r=p.getBoundingClientRect(),xr=x?x.getBoundingClientRect():null;
   return {text:p.textContent.replace(/\s+/g,' ').trim(),extra:x&&!x.hidden?x.textContent:null,fits:!!xr&&xr.right<=r.right+0.5&&xr.left>=r.left-0.5&&p.scrollWidth<=p.clientWidth+1,time:p.querySelector('.p-time').textContent};};
  const date=process.env.EH_TEST_TIME?new Date(process.env.EH_TEST_TIME).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Amsterdam'}).replace(/\.$/,''):new Date().toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\.$/,'');
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
