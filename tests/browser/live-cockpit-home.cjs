'use strict';
// v1.27 browseracceptatie: Live Cockpit als Home binnen <energiehuis-card>, met GESIMULEERDE Home Assistant-data.
//   node tests/browser/live-cockpit-home.cjs [--screenshots=<map>]   (EH_LIVE_MASTER=<pad naar master.webp> optioneel)
// Geen echte Home Assistant. De getekende Media Source-route wordt nagebootst: /media/… alleen met geldige authSig.
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
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
 card._loadHistory=async()=>{};card._loadMetricData=async()=>{};card._loadCostCompare=async()=>{};card._loadCupraInsights=async()=>{};
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
   return {};
  },callApi:async()=>[],callService:()=>{throw Error('Ongewenste servicecall')},hassUrl:p=>new URL(p,location.origin).toString()};
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

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 console.log('chromium',browser.version());
 async function open(config,{width=1300,height=900,mode='ok',dpr=1,wait=true}={}){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,locale:'nl-NL',timezoneId:'Europe/Amsterdam'});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/40[134]|Failed to load resource/.test(m.text()))errors.push(m.text());});
  await page.goto(base);await page.evaluate(SETUP,[config,mode]);
  if(wait&&config.live_cockpit===true)await page.waitForFunction(()=>{const h=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home');const e=h&&h.shadowRoot.querySelector('.ehc');return e&&e.dataset.scene!=='loading';},null,{timeout:10000}).catch(()=>{});
  await frames(page,3);
  return {ctx,page,errors};
 }

 await check('standaard UIT: bestaande EnergieRegisseur-cockpit op Home, geen Live Cockpit, geen resolve_media',async()=>{
  const {ctx,page,errors}=await open({mobile_fixed_navigation:false});
  const s=await page.evaluate(STATE),calls=await page.evaluate(()=>window.__calls);await ctx.close();
  assert.equal(s.live,false);assert.equal(s.eh40,true);assert.ok(!calls.includes('media_source/resolve_media'));
  assert.deepEqual(s.nav,['Home','Laden','Inzicht','Meer']);assert.deepEqual(errors,[]);
  return {eh40:s.eh40,live:s.live};
 });

 await check('AAN: Live Cockpit vervangt de EnergieRegisseur op Home; één energieoverzicht; navigatie en "Alle metingen" behouden; LIVE zonder DEMO',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  const s=await page.evaluate(STATE);await ctx.close();
  assert.equal(s.live,true);assert.equal(s.eh40,false,'geen dubbele cockpit');
  assert.equal(s.legacy,true);assert.equal(s.legacyOpen,false,'aanvullende metingen ingeklapt');
  assert.deepEqual(s.nav,['Home','Laden','Inzicht','Meer']);
  assert.equal(s.scene,'ok');assert.match(s.img,/\/media\/local\/energiehuis\/master\.webp\?authSig=/);
  assert.match(s.badge,/LIVE · alleen-lezen/);assert.doesNotMatch(s.text,/DEMO|fictiev|Schommeling/);
  assert.deepEqual(s.particles,['home-ev','home-grid','sun-home']);assert.match(s.status,/5\/5 meetwaarden actueel/);
  assert.deepEqual(errors,[]);
  return {scene:s.scene,layout:s.layout,status:s.status,particles:s.particles};
 });

 await check('rendercyclus: 120 sensorupdates via de echte kaartrender ⇒ zelfde cockpit, zelfde master (1 resolve, 1 beeldverzoek), geen DOM-herbouw in de cockpit, laatste waarde getoond',async()=>{
  log.length=0;
  const {ctx,page,errors}=await open(LIVE);
  const r=await page.evaluate(async()=>{
   const card=document.querySelector('energiehuis-card'),host0=card.shadowRoot.querySelector('.eh-live-home'),sr=host0.shadowRoot,ehc0=sr.querySelector('.ehc'),img0=sr.querySelector('.ehm-scene');
   let structural=0;const mo=new MutationObserver(l=>{for(const m of l)if(m.type==='childList'&&[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1))structural++;});
   mo.observe(sr,{subtree:true,childList:true});
   let loads=0;img0.addEventListener('load',()=>loads++);
   const renders0=card._ehLive.ctl.debug.updates;
   for(let i=1;i<=120;i++){window.__push([['net',-400-i],['huis',1440-i]]);if(i%10===0)await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));}
   await new Promise(res=>setTimeout(res,150));
   mo.disconnect();
   const host1=card.shadowRoot.querySelector('.eh-live-home');
   return {sameHost:host0===host1,sameRoot:sr.querySelector('.ehc')===ehc0,sameImg:sr.querySelector('.ehm-scene')===img0,src:img0.getAttribute('src'),structural,loads,resolves:window.__resolves,modelUpdates:card._ehLive.ctl.debug.updates-renders0,net:sr.querySelector('.tile[data-key="net"] .t-value').textContent};
  });
  const media=log.filter(l=>l.startsWith('/media/')).length;await ctx.close();
  assert.equal(r.sameHost,true);assert.equal(r.sameRoot,true);assert.equal(r.sameImg,true);
  assert.equal(r.structural,0,'geen structurele DOM-wijziging in de cockpit');assert.equal(r.loads,0,'master niet opnieuw geladen');
  assert.equal(r.resolves,1);assert.equal(media,1);
  assert.ok(r.modelUpdates>=1&&r.modelUpdates<=40,'samengevoegd per frame: '+r.modelUpdates);
  assert.match(r.net,/^−520\s?W$/);assert.deepEqual(errors,[]);
  return r;
 });

 await check('navigatie: weg van Home ⇒ cockpit gepauzeerd (geen timer/animatie); terug ⇒ zelfde cockpit, actuele waarden; alle andere schermen zonder fouten',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  const r=await page.evaluate(async()=>{
   const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,host0=root.querySelector('.eh-live-home');
   const go=async p=>{root.querySelector('[data-eh-page="'+p+'"]')?.click();await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));};
   const views={};
   for(const p of ['charge','more']){await go(p);views[p]={live:!!root.querySelector('.eh-live-home'),eh40:!!root.querySelector('.eh40-cockpit'),dbg:{...card._ehLive.ctl.debug,anim:card._ehLive.ctl.cockpit.isAnimating()},len:root.querySelector('.shell').textContent.length};}
   window.__push([['net',900]]);await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
   for(const p of ['cupra','battery','costs']){card._view=p;card._render();views[p]={live:!!root.querySelector('.eh-live-home'),len:root.querySelector('.shell').textContent.length};}
   card._view='overview';card._render();await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
   const host1=root.querySelector('.eh-live-home');
   return {views,same:host0===host1,back:{...card._ehLive.ctl.debug,anim:card._ehLive.ctl.cockpit.isAnimating()},net:host1.shadowRoot.querySelector('.tile[data-key="net"] .t-value').textContent};
  });
  await ctx.close();
  for(const [p,v] of Object.entries(r.views)){assert.equal(v.live,false,p);assert.ok(v.len>200,p+' scherm leeg');}
  assert.equal(r.views.charge.dbg.suspended,true);assert.equal(r.views.charge.dbg.timer,false);assert.equal(r.views.charge.dbg.anim,false);
  assert.equal(r.same,true);assert.equal(r.back.suspended,false);assert.equal(r.back.timer,true);assert.equal(r.back.anim,true);
  assert.match(r.net,/^900\s?W$/);assert.deepEqual(errors,[]);
  return {charge:r.views.charge.dbg,back:r.back};
 });

 await check('kaart ontkoppelen ⇒ cockpit gepauzeerd, lopende beeldaanvraag afgebroken; opnieuw koppelen ⇒ hervat en beeld geladen',async()=>{
  const {ctx,page,errors}=await open({...LIVE},{mode:'hang',wait:false});
  const r=await page.evaluate(async()=>{
   const card=document.querySelector('energiehuis-card'),parent=card.parentNode;
   await new Promise(res=>setTimeout(res,200));
   const before={...card._ehLive.ctl.debug};
   card.remove();await new Promise(res=>setTimeout(res,100));
   const detached={...card._ehLive.ctl.debug,cockpitSuspended:card._ehLive.ctl.cockpit.suspended,anim:card._ehLive.ctl.cockpit.isAnimating()};
   window.__resolveMode='ok';parent.appendChild(card);card.hass=window.__hass;
   const sc=()=>card.shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehc').dataset.scene;
   for(let i=0;i<40&&sc()!=='ok';i++)await new Promise(res=>setTimeout(res,100));
   return {before,detached,after:{...card._ehLive.ctl.debug,scene:sc()},resolves:window.__resolves};
  });
  await ctx.close();
  assert.equal(r.before.pendingResolve,true);
  assert.equal(r.detached.suspended,true);assert.equal(r.detached.cockpitSuspended,true);assert.equal(r.detached.timer,false);assert.equal(r.detached.pendingResolve,false);assert.equal(r.detached.anim,false);
  assert.equal(r.after.scene,'ok');assert.equal(r.after.suspended,false);assert.equal(r.resolves,2);
  assert.deepEqual(errors,[]);
  return r;
 });

 await check('beeld: niet geconfigureerd / mislukt / onveilig (/local/) ⇒ duidelijke terugval, data blijft werken, geen /local/-verzoek',async()=>{
  const res={};
  for(const [name,cfg,mode] of [['geen-beeld',{live_cockpit:true,mobile_fixed_navigation:false},'ok'],['mislukt',LIVE,'fail'],['local',LIVE,'local']]){
   log.length=0;
   const {ctx,page,errors}=await open(cfg,{mode});
   const s=await page.evaluate(STATE);res[name]={scene:s.scene,layout:s.layout,note:s.note,particles:s.particles,local:log.filter(l=>l.startsWith('/local/')).length,media:log.filter(l=>l.startsWith('/media/')).length,errors};
   await ctx.close();
  }
  for(const [n,v] of Object.entries(res)){assert.equal(v.scene,'error',n);assert.equal(v.layout,'list',n);assert.equal(v.local,0);assert.equal(v.media,0);assert.deepEqual(v.particles,['home-ev','home-grid','sun-home'],n);assert.deepEqual(v.errors,[],n);}
  assert.match(res['geen-beeld'].note,/Geen beeld geconfigureerd \(live_cockpit_image\)/);
  assert.match(res.mislukt.note,/kon niet worden opgehaald/);
  return Object.fromEntries(Object.entries(res).map(([k,v])=>[k,v.note]));
 });

 await check('ongeldige Live Cockpit-configuratie ⇒ kaart blijft werken met EnergieRegisseur-cockpit en een duidelijke melding',async()=>{
  const {ctx,page,errors}=await open({live_cockpit:true,live_cockpit_image:'/local/master.webp',live_cockpit_route_ttl_s:{zonnepanelen:5000},mobile_fixed_navigation:false});
  const s=await page.evaluate(STATE);await ctx.close();
  assert.equal(s.live,false);assert.equal(s.eh40,true);assert.match(s.configError,/Live Cockpit niet actief: configuratiefout \(.*image.*route_ttl_s/);
  assert.deepEqual(errors,[]);
  return {error:s.configError};
 });

 await check('omkeerbaar: schakelaar tijdens gebruik uit ⇒ EnergieRegisseur terug, cockpit opgeruimd; weer aan ⇒ nieuwe Live Cockpit',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  const r=await page.evaluate(async()=>{
   const card=document.querySelector('energiehuis-card'),root=card.shadowRoot,ctl=card._ehLive.ctl;
   card.setConfig({...card.config,live_cockpit:false});card.hass=window.__hass;await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
   const off={live:!!root.querySelector('.eh-live-home'),eh40:!!root.querySelector('.eh40-cockpit'),destroyed:ctl.debug.destroyed,ctl:card._ehLive.ctl};
   card.setConfig({...card.config,live_cockpit:true});card.hass=window.__hass;await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
   return {off,on:{live:!!root.querySelector('.eh-live-home'),eh40:!!root.querySelector('.eh40-cockpit'),fresh:card._ehLive.ctl!==ctl}};
  });
  await ctx.close();
  assert.deepEqual(r.off,{live:false,eh40:true,destroyed:true,ctl:null});assert.deepEqual(r.on,{live:true,eh40:false,fresh:true});
  assert.deepEqual(errors,[]);
  return r;
 });

 await check('interactie met echte muis: kaart opent detail, klik in het detail sluit niet, detail en focus overleven sensorupdates; Escape sluit',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  const tile=page.locator('energiehuis-card').locator('.eh-live-home').locator('.ehm-tiles .tile[data-key="net"]');
  await tile.click();await frames(page);
  const d=page.locator('energiehuis-card').locator('.eh-live-home').locator('.ehc-detail');
  const box=await d.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+48);await frames(page);
  const r=await page.evaluate(async()=>{
   const sr=document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot;
   const open1=!sr.querySelector('.ehc-detail').hidden;
   sr.querySelector('.d-close').focus();
   for(let i=0;i<5;i++){window.__push([['net',-700-i]]);await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));}
   const card=document.querySelector('energiehuis-card');
   return {open1,open2:!sr.querySelector('.ehc-detail').hidden,focus:sr.activeElement?.className||null,cardFocus:card.shadowRoot.activeElement?.className||null,rows:[...sr.querySelectorAll('.ehc-detail dt')].map(x=>x.textContent)};
  });
  await page.keyboard.press('Escape');await frames(page);
  const closed=await page.evaluate(()=>document.querySelector('energiehuis-card').shadowRoot.querySelector('.eh-live-home').shadowRoot.querySelector('.ehc-detail').hidden);
  await ctx.close();
  assert.equal(r.open1,true,'klik in het detail sluit het niet');assert.equal(r.open2,true,'detail blijft open na updates');
  assert.equal(r.focus,'d-close');assert.equal(r.cardFocus,'eh-live-home');
  assert.ok(r.rows.includes('Ruwe P1-sensorwaarde')&&r.rows.includes('Tijdstempel'));
  assert.equal(closed,true);assert.deepEqual(errors,[]);
  return r;
 });

 await check('offline (hass.connected=false) ⇒ rode OFFLINE-status, geen lichtpunten; herstel ⇒ LIVE',async()=>{
  const {ctx,page,errors}=await open(LIVE);
  await page.evaluate(()=>window.__push([],{connected:false}));await frames(page);
  const off=await page.evaluate(STATE);
  await page.evaluate(()=>window.__push([],{connected:true}));await frames(page);
  const on=await page.evaluate(STATE);await ctx.close();
  assert.equal(off.badgeState,'offline');assert.match(off.badge,/^OFFLINE/);assert.deepEqual(off.particles,[]);assert.equal(off.status,'Offline');
  assert.equal(on.badgeState,'live');assert.ok(on.particles.length>0);assert.deepEqual(errors,[]);
  return {off:off.badge,on:on.badge};
 });

 for(const [w,h,layout] of [[390,844,'compact'],[320,700,'list'],[768,1024,'compact'],[1300,900,'overlay']]){
  await check(`weergave ${w}px: ${layout}, geen horizontale scroll, cockpit binnen de kaart`,async()=>{
   const {ctx,page,errors}=await open(LIVE,{width:w,height:h,dpr:w<500?2:1});
   const s=await page.evaluate(STATE);
   if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.locator('energiehuis-card').screenshot({path:path.join(SHOTS,`live-home-${w}.jpg`),type:'jpeg',quality:80});}
   await ctx.close();
   assert.equal(s.layout,layout);assert.equal(s.overflow,false);assert.ok(s.hostRect.l>=0&&s.hostRect.r<=w,JSON.stringify(s.hostRect));
   assert.deepEqual(errors,[]);
   return {layout:s.layout,host:s.hostRect};
  });
 }

 await check('390px met de standaard vaste mobiele navigatie: cockpit compact, geen fouten, geen horizontale scroll',async()=>{
  const {ctx,page,errors}=await open({live_cockpit:true,live_cockpit_image:LIVE.live_cockpit_image},{width:390,height:844,dpr:2});
  const s=await page.evaluate(STATE);await ctx.close();
  assert.equal(s.live,true);assert.equal(s.eh40,false);assert.equal(s.layout,'compact');assert.equal(s.overflow,false);assert.deepEqual(errors,[]);
  return {layout:s.layout};
 });

 if(SHOTS){
  await check('screenshots: niet-synchroon en offline (desktop en mobiel), standaard-UIT ter vergelijking',async()=>{
   const files=[];
   for(const [w,h] of [[1300,900],[390,844]]){
    for(const sc of ['niet-synchroon','offline']){
     const {ctx,page}=await open(LIVE,{width:w,height:h,dpr:w<500?2:1});
     if(sc==='offline')await page.evaluate(()=>window.__push([],{connected:false}));
     else await page.evaluate(()=>{const c=document.querySelector('energiehuis-card').config,s={...window.__hass.states};s[c.net]=window.__st(c.net,-1880,'W',0);s[c.zonnepanelen]=window.__st(c.zonnepanelen,3340,'W',32);s[c.huis]=window.__st(c.huis,3900,'W',0);s[c.laden]=window.__st(c.laden,0,'W',0);window.__hass={...window.__hass,states:s};document.querySelector('energiehuis-card').hass=window.__hass;});
     await frames(page,4);const f=`live-home-${sc}-${w}.jpg`;await page.locator('energiehuis-card').screenshot({path:path.join(SHOTS,f),type:'jpeg',quality:80});files.push(f);await ctx.close();
    }
    const {ctx,page}=await open({mobile_fixed_navigation:false},{width:w,height:h,dpr:w<500?2:1});const f=`standaard-uit-${w}.jpg`;await page.locator('energiehuis-card').screenshot({path:path.join(SHOTS,f),type:'jpeg',quality:80});files.push(f);await ctx.close();
   }
   return files;
  });
 }

 await browser.close();server.close();
 console.log(`\n${results.length}/${results.length+failed} Live Cockpit Home-controles geslaagd (chromium)`);
 process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
