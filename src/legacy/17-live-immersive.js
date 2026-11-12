/* v1.28 (voorstel) — Immersive Live Cockpit Home met klikbare energieroutes (PR #56, LIVE_COCKPIT_IMMERSIVE_SPEC.md).
 * Opt-in: `live_cockpit_immersive: true` werkt ALLEEN samen met `live_cockpit: true`; standaard uit. Met de opt-in uit
 * blijft het v1.27.0-gedrag identiek (deze laag doet dan niets).
 * - Home toont uitsluitend de Live Cockpit (goedgekeurde master ongewijzigd, animaties behouden), schermvullend met een
 *   volledig zichtbare voorgrondscène; de oude Home-modules (hero, alle metingen, energiecoach, grafiek) blijven
 *   bestaan en bereikbaar via Inzicht → "Alle metingen".
 * - Eén tik op een PVE-04-kaart navigeert via de bestaande _view/_detail-controller naar een vaste bestemming
 *   (centrale whitelist hieronder). Geen externe URL's, geen history.pushState, geen servicecalls, geen opslag.
 */
const EH_IMM_ROUTES=Object.freeze({
 pv:Object.freeze({view:'sun',detail:'sun'}),
 house:Object.freeze({view:'home',detail:'home'}),
 net:Object.freeze({view:'grid',detail:'grid'}),
 battery:Object.freeze({view:'battery',detail:null}),
 cupra:Object.freeze({view:'cupra',detail:null}),
 practice:Object.freeze({view:'practice',detail:null})
});
const EH_IMM_VIEWS=Object.freeze({
 sun:Object.freeze({route:'pv',title:'Zonnepanelen',icon:'sun',tile:'pv',reading:'pv',intro:'Actuele opwek van de GoodWe-omvormer, met historie en periodevergelijking.'}),
 home:Object.freeze({route:'house',title:'Huisverbruik',icon:'home',tile:'house',reading:'house',intro:'Verbruik van de woning exclusief Cupra, uit de bestaande huisverbruik-sensor (geen nieuwe berekening).'}),
 grid:Object.freeze({route:'net',title:'Net',icon:'grid',tile:'net',reading:'net',intro:'P1-netvermogen: afname en teruglevering, met historie.'}),
 practice:Object.freeze({route:'practice',title:'Praktijkruimte',icon:'home',tile:'practice',reading:null,intro:'Alleen-lezen. Er is nog geen submeter gekoppeld.'})
});
function ehImmOn(card){return typeof EhLiveCockpit!=='undefined'&&!!card?.config&&EhLiveCockpit.immersiveEnabled(card.config);}
/** Actuele (niet-gepauzeerde) modelstand voor de bestemmingspagina's: zelfde adapter en regels als de Live Cockpit. */
function ehImmModel(card){
 const ctl=card._ehLive?.ctl,M=EhLiveCockpit.scope?.EhPve04Model;
 if(!ctl||!M||!card._hass)return null;
 // Vorig cockpitmodel meegeven: dezelfde netrichting in de dode band (40–80 W) als de Home-tegel.
 try{return M.computeModel(ctl.adapter.input(card._hass,Date.now()),ctl.cockpit?.model||null);}catch(_){return null;}
}
/**
 * Net-pagina: EXACT dezelfde neutrale netpresentatie als de Net-tegel op Home (EhPve04Model.netPresentation, RC2).
 * Een richting (teken, label) alleen bij een ACTIEVE netroute; anders het absolute P1-vermogen zonder teken met
 * "richting niet bevestigd". De ruwe, ondertekende P1-sensorwaarde staat uitsluitend in de technische diagnose.
 */
function ehImmNetView(M,m){
 const NP=M.netPresentation(m),t=m.tiles.net,rd=m.readings.net;
 const dir=NP.confirmed?(NP.direction==='import'?'Afname van het net (bevestigd door actieve netroute)':'Teruglevering aan het net (bevestigd door actieve netroute)')
  :NP.unconfirmed?'Niet bevestigd ('+NP.reason+')'
  :t.direction==='balance'?'Geen: in balans (onder 40 W)':'Onbekend ('+(rd.reason||'geen actuele P1-meting')+')';
 const raw=rd&&rd.raw?rd.raw.state+(rd.raw.unit?' '+rd.raw.unit:''):'—';
 const rows=[['Bevestigde richting',dir],['Ruwe P1-sensorwaarde (ondertekend)',raw]];
 if(m.critical||m.hold)rows.push(['Meetketen',m.status.text+' · '+m.balanceInfo]);
 return {value:NP.value,label:NP.unconfirmed?NP.label:NP.sub,direction:NP.direction,confirmed:NP.confirmed,
  tone:NP.unconfirmed?(m.critical?'bad':'warn'):t.tone,rows};
}
function ehImmCss(){
 return [
  '/* EH-IMM */',
  '.shell.eh-imm-home>.hero,.shell.eh-imm-all>.hero{display:none}',
  '.shell.eh-imm-home>.body{margin-top:0;padding:8px 10px 12px}',
  '.shell.eh-imm-home>.body>:not(.eh-live-home):not(.eh-live-config-error){display:none!important}',
  '.shell.eh-imm-all>.body{margin-top:0;padding-top:8px}',
  '.eh-imm-back{appearance:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:8px 14px;border-radius:12px;border:1px solid #7a9eaf66;background:#193346;color:#eaf5ff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
  '.eh-imm-back:focus-visible,.eh-imm-follow:focus-visible,.eh-imm-page h2:focus-visible{outline:2px solid #76c1ef;outline-offset:2px}',
  '.eh-imm-page{padding:16px 16px 88px;min-height:520px}',
  '.eh-imm-page .subpage-head{display:block;padding:4px 2px;margin:0 0 12px}',
  '.eh-imm-page .subpage-head h2{margin:12px 0 6px;font-size:28px;letter-spacing:-.6px}',
  '.eh-imm-page .subpage-head p{margin:0;color:#a9c3d5;font-size:13px;line-height:1.5}',
  '.eh-imm-now{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;padding:14px 16px;border-radius:16px;border:1px solid #8fb3ca33;background:linear-gradient(145deg,#1a3145,#0c2031)}',
  '.eh-imm-now strong{font-size:30px;font-weight:820;letter-spacing:-.6px;font-variant-numeric:tabular-nums}',
  '.eh-imm-now span{font-size:13px;color:#c9dbe7}',
  '.eh-imm-now[data-tone="warn"]{border-color:#ffb54788}.eh-imm-now[data-tone="warn"] span{color:#ffd28a}',
  '.eh-imm-now[data-tone="bad"]{border-color:#ff6b6b99}.eh-imm-now[data-tone="bad"] span{color:#ffb3b3}',
  '.eh-imm-meta{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr);gap:4px 12px;margin:10px 2px 0;font-size:11px;color:#9dbbd1}.eh-imm-meta dd{margin:0;color:#d5e5ef;overflow-wrap:anywhere}',
  '.eh-imm-page .detail-panel{margin-top:14px}.eh-imm-page .detail-close{display:none}',
  '.eh-imm-practice{margin-top:12px;padding:14px 16px;border-radius:16px;border:1px dashed #e08a3c88;background:#e08a3c14;color:#ffe2c4;font-size:13px;line-height:1.55}',
  '.eh-imm-follow{appearance:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;margin:8px 0 0;padding:9px 14px;border-radius:12px;border:1px solid #38dfa3aa;background:#0d3d34;color:#eafff8;font:inherit;font-size:13px;font-weight:750;cursor:pointer}',
  '.eh-imm-headback{margin:0 0 8px}',
  '.eh-imm-allhead{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:6px 2px 12px}.eh-imm-allhead h2{margin:0;font-size:22px}',
  '@media(max-width:720px){.eh-imm-page{padding:12px 10px 82px}.eh-imm-page .subpage-head h2{font-size:24px}.eh-imm-now strong{font-size:26px}}',
  // Landscape first (telefoon liggend, lage schermen): slanke app- en ondernavigatie zodat de scène de hoogte krijgt,
  // veilige zones (notch links/rechts, home-indicator onder) en een Inzicht-menu dat binnen het scherm blijft.
  // De testvariabelen --eh-safe-test-* laten de tests een notch simuleren; echte waarden komen uit env().
  '.shell{--eh-sl:var(--eh-safe-test-l,env(safe-area-inset-left,0px));--eh-sr:var(--eh-safe-test-r,env(safe-area-inset-right,0px));--eh-sb:var(--eh-safe-test-b,env(safe-area-inset-bottom,0px))}',
  '@media (max-height:500px) and (orientation:landscape){',
  // Navigatie als slanke rail links (geen balk onder de scène): de scène krijgt bijna de volle hoogte en breedte.
  ' .shell{display:grid;grid-template-columns:calc(76px + var(--eh-sl)) minmax(0,1fr);grid-auto-rows:auto;padding:0 var(--eh-sr) 0 0}',
  ' .shell>*{grid-column:2;min-width:0}',
  ' .shell>.eh19-appbar{padding:2px 12px;gap:8px;min-height:0;border-radius:0 20px 0 0}',
  ' .shell>.eh19-appbar button{min-height:32px;position:relative}',
  ' .shell>.eh19-appbar button::before{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}',
  ' .shell>.nav{grid-column:1;grid-row:1 / span 8;position:sticky;top:0;bottom:auto;align-self:start;height:min(100svh,100%);flex-direction:column;justify-content:center;align-items:stretch;gap:6px;padding:6px 6px calc(6px + var(--eh-sb)) calc(6px + var(--eh-sl));border-radius:20px 0 0 20px;box-sizing:border-box;overflow:visible}',
  ' .shell>.nav .eh26-navitem{flex:none;flex-direction:column;min-height:52px;width:100%;gap:3px;padding:5px 2px;justify-content:center}',
  ' .shell>.nav .eh26-navitem>span{font-size:10px!important}',
  ' .shell>.nav .eh26-insight-menu{grid-template-columns:repeat(2,minmax(0,1fr));left:calc(100% + 10px);right:auto;bottom:calc(10px + var(--eh-sb));width:min(560px,calc(100vw - 76px - var(--eh-sl) - var(--eh-sr) - 28px));max-height:calc(100svh - 20px - var(--eh-sb));overflow:auto;overscroll-behavior:contain}',
  ' .shell>.nav .eh26-insight-menu button{min-height:48px;padding:6px 10px}',
  ' .shell.eh-imm-home>.body{padding:2px 6px 4px}',
  '}'
 ].join('\n');
}
function ehImmPageHtml(card,view){
 const v=EH_IMM_VIEWS[view],m=ehImmModel(card),t=m&&v.tile?m.tiles[v.tile]:null,rd=m&&v.reading?m.readings[v.reading]:null;
 const back='<button type="button" class="eh-imm-back" data-eh-page="overview" aria-label="Terug naar Home">← Terug naar Home</button>';
 let now='';
 if(view==='practice'){
  now='<div class="eh-imm-practice" role="note"><strong>Nog niet gekoppeld.</strong> Er is geen meting van de praktijkruimte: er worden geen vermogens of energiewaarden getoond, en niets wordt bij het huis opgeteld of ervan afgetrokken. Koppelen vraagt een aparte, goedgekeurde wijziging.</div>';
 }else if(t){
  const age=rd&&Number.isFinite(rd.ageMs)?EhLiveCockpit.scope.EhPve04Model.ageLabel(rd.ageMs):'';
  const meta=[['Entiteit',t.entity||'—'],['Tijdstempel',rd?.stampSource?(rd.stampSource+(age?' · '+age:'')):'onbekend']];
  let shown={value:t.value,label:t.sub,tone:t.tone,direction:''};
  if(view==='grid'){
   const nv=ehImmNetView(EhLiveCockpit.scope.EhPve04Model,m);
   shown={value:nv.value,label:nv.label,tone:nv.tone,direction:nv.direction};
   meta.push(...nv.rows,['P1-tekenconfiguratie',m.p1Sign==='export_positive'?'Export positief (gecorrigeerd)':'Import positief']);
  }
  if(view==='home')meta.push(['Definitie','Huisverbruik exclusief Cupra (bestaande sensor)']);
  now='<section class="eh-imm-now" data-tone="'+ehEsc(shown.tone)+'"'+(shown.direction?' data-direction="'+ehEsc(shown.direction)+'"':'')+' aria-label="Actuele meting"><strong>'+ehEsc(shown.value)+'</strong><span>'+ehEsc(shown.label)+'</span></section>'+
   '<dl class="eh-imm-meta">'+meta.map(([k,x])=>'<dt>'+ehEsc(k)+'</dt><dd>'+ehEsc(x)+'</dd>').join('')+'</dl>';
 }else now='<section class="eh-imm-now" data-tone="warn" aria-label="Actuele meting"><strong>—</strong><span>Meting niet beschikbaar</span></section>';
 return '<main class="subpage eh-imm-page" data-eh-imm-page="'+ehEsc(view)+'" aria-labelledby="eh-imm-title">'+
  '<div class="subpage-head"><div>'+back+'<h2 id="eh-imm-title" tabindex="-1">'+ehEsc(v.title)+'</h2><p>'+ehEsc(v.intro)+'</p></div></div>'+now+'</main>';
}
(function ehImmInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 /** Enige ingang vanuit de Live Cockpit (onTileNavigate). Alleen bestemmingen uit de whitelist. */
 P._ehImmNavigate=function(key){
  const r=Object.prototype.hasOwnProperty.call(EH_IMM_ROUTES,key)?EH_IMM_ROUTES[key]:null;
  if(!r||!ehImmOn(this))return false;
  this._ehImmFrom=key;this._ehImmAll=false;this._ehImmFocus='page';
  this._view=r.view;this._detail=r.detail;this._metricSelectedTime=null;
  if(r.view==='cupra'&&typeof this._loadCupraInsights==='function')this._loadCupraInsights();
  this._schedule();
  if(r.detail&&typeof this._loadMetricData==='function')this._loadMetricData();
  requestAnimationFrame(()=>{if(this.isConnected&&typeof this.scrollIntoView==='function')this.scrollIntoView({block:'start'});});
  return true;
 };
 // ===== Home-extra's (alleen lezen): dagtotalen in de vakjes en de kwartierprijs-overlay =====
 // Dagtotalen: dezelfde read-only recorder-statistiekvraag als de detailpagina's (vandaag, uurbuckets, 5 min cache);
 // de dagsensor van de omvormer, de kostensensor en de Cupra-sessie komen rechtstreeks uit de HA-toestanden.
 // Geen servicecalls, geen opslag, geen schrijfacties, geen aannames: ontbrekend ⇒ regel verborgen.
 const DAY_TTL_MS=5*60*1000;
 const kwh=n=>Number.isFinite(n)?ehFmt(n,Math.abs(n)>=100?0:Math.abs(n)>=10?1:2):null;
 const sumKey=(b,k)=>{const v=b.map(x=>x[k]).filter(Number.isFinite);return v.length?v.reduce((a,x)=>a+x,0):null;};
 const stateKwh=(h,id)=>{
  const e=id&&h?.states?.[id],n=e?ehNum(e.state):null;if(n===null)return null;
  const u=String(e.attributes?.unit_of_measurement||'').trim().toLowerCase();
  return u==='kwh'?n:u==='wh'?n/1000:u==='mwh'?n*1000:null;
 };
 const sameLocalDay=(iso,now)=>{const t=Date.parse(iso);return Number.isFinite(t)&&ehDayKey(new Date(t))===ehDayKey(now);};
 const sessionKwh=(h,c,m)=>{
  // "Sessie" alleen tijdens het laden, met een verse kWh-waarde uit de Cupra-integratie en een plausibel bereik.
  const e=c.cupra_charged_energy&&h?.states?.[c.cupra_charged_energy];if(!e||!m.tiles.cupra.charging)return null;
  const v=stateKwh(h,c.cupra_charged_energy),t=Date.parse(e.last_updated||e.last_changed||'');
  if(v===null||!Number.isFinite(t)||Date.now()-t>35*60000||v<=0||v>(Number(c.cupra_usable_kwh)||59)*1.2)return null;
  return v;
 };
 const costToday=(h,c,now)=>{
  const e=c.cost_zonneplan_day&&h?.states?.[c.cost_zonneplan_day];if(!e)return null;
  const n=ehNum(e.state),u=String(e.attributes?.unit_of_measurement||'').trim().toLowerCase();
  if(n===null||!['','€','eur'].includes(u)||!sameLocalDay(e.last_updated||e.last_changed,now))return null;
  return (n<0?'−':'')+'€ '+ehFmt(Math.abs(n),2);
 };
 P._ehImmLoadDay=async function(){
  const c=this.config,h=this._hass,st=this._ehImmDay||(this._ehImmDay={at:0,data:null,loading:false});
  if(!h||typeof h.callWS!=='function'||!c||st.loading||(st.at&&Date.now()-st.at<DAY_TTL_MS))return;
  st.loading=true;st.at=Date.now();   // ook na een mislukking pas na de TTL opnieuw
  try{
   const lim=ehPeriodLimits('today'),bins=ehWindows(lim);
   const ids=[...new Set([c.import,c.export,c.zonne_energie,c.laad_energie,c.huis_energie,c.huis].filter(Boolean))];
   if(ids.length){
    const before=new Date(lim.from.getTime()-3600000);
    const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:before.toISOString(),end_time:lim.to.toISOString(),statistic_ids:ids,period:lim.step,types:['change','sum','mean'],units:{energy:'kWh'}});
    const b=ehEnergyBuckets(stats,bins,lim.step,c,h);
    st.data={dayKey:ehDayKey(new Date()),import:sumKey(b,'import'),export:sumKey(b,'export'),sun:sumKey(b,'sun'),ev:sumKey(b,'ev'),home:sumKey(b,'home'),estimated:b.some(x=>x.estimated)};
   }
  }catch(_){st.data=null;}
  finally{st.loading=false;}
  const ctl=this._ehLive?.ctl;
  if(ctl&&!ctl.debug.suspended&&ehImmOn(this))ctl.cockpit.rerender();
 };
 /** Korte tekstregels onder de livewaarde van een vakje (leeg = verborgen). */
 P._ehImmTileDay=function(key,m){
  const c=this.config,h=this._hass,now=new Date(),d=this._ehImmDay?.data,ok=!!d&&d.dayKey===ehDayKey(now),L=[];
  if(!c||!m||!m.connected)return null;
  if(key==='pv'){const v=stateKwh(h,c.zonne_energie)??(ok?d.sun:null);if(v!==null)L.push('Vandaag: '+kwh(v)+' kWh');}
  else if(key==='house'){if(ok&&d.home!==null)L.push('Vandaag: '+(d.estimated?'≈ ':'')+kwh(d.home)+' kWh');}
  else if(key==='cupra'){
   if(ok&&d.ev!==null)L.push('Vandaag: '+kwh(d.ev)+' kWh');
   const s=sessionKwh(h,c,m);if(s!==null)L.push('Sessie: '+kwh(s)+' kWh');
  }else if(key==='net'){
   if(ok&&d.import!==null&&d.export!==null){const n=d.import-d.export;L.push('Vandaag: '+(n<-0.005?'−':'')+kwh(Math.abs(n))+' kWh');}
   const k=costToday(h,c,now);if(k)L.push('Kosten: '+k);
  }
  return L;
 };
 /** Kwartierprijs-overlay (Zonneplan, uit de bestaande prijssensoren; geen fictieve data). */
 P._ehImmPrice=function(){
  const ctl=this._ehLive?.ctl;if(!ctl||ctl.debug.suspended)return;
  const tiles=ctl.cockpit.el.querySelector('.ehm-tiles');if(!tiles)return;
  const doc=tiles.ownerDocument;
  let el=tiles.querySelector(':scope > .eh-price');
  if(!el){el=doc.createElement('div');el.className='eh-price';el.setAttribute('role','img');tiles.appendChild(el);}
  const now=new Date(),c=this.config,h=this._hass;
  let info=null;try{info=ehPricesForDay(h,c,now);}catch(_){}
  const day=(info?.day||[]).slice().sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const cur=info?.currentQ||null,curStart=cur?Date.parse(cur.t):null;
  let state='none',label='Kwartierprijs',nowTxt='geen data',at='',aria='Kwartierprijs: geen kwartierdata beschikbaar.',bars='';
  if(day.length>=8){
   state='quarter';
   const ps=day.map(q=>q.p),min=Math.min(...ps),max=Math.max(...ps),span=Math.max(.001,max-min);
   const idx=t=>Math.max(0,Math.min(95,Math.round((Date.parse(t)-dayStart)/900000)));
   const nowIdx=cur?idx(cur.t):-1;
   bars=day.map(q=>{const i=idx(q.t),hh=3+(q.p-min)/span*19,cls=i===nowIdx?'now':(q.p-min)<=span*.25?'cheap':'';
    return '<rect class="'+cls+'" x="'+(i+.08).toFixed(2)+'" y="'+(24-hh).toFixed(2)+'" width=".84" height="'+hh.toFixed(2)+'"/>';}).join('');
   if(nowIdx>=0)bars='<line x1="'+(nowIdx+.5)+'" x2="'+(nowIdx+.5)+'" y1="0" y2="24"/>'+bars;
   if(cur){nowTxt='€ '+ehFmt(cur.p,3);at=ehClock(curStart);aria='Kwartierprijs: nu € '+ehFmt(cur.p,3)+' per kWh (kwartier '+ehClock(curStart)+' tot '+ehClock(curStart+900000)+'). Vandaag laagste € '+ehFmt(min,3)+', hoogste € '+ehFmt(max,3)+'.';}
   else{nowTxt='nu onbekend';aria='Kwartierprijs: het huidige kwartier is niet beschikbaar. Vandaag laagste € '+ehFmt(min,3)+', hoogste € '+ehFmt(max,3)+'.';}
  }else if(info&&Number.isFinite(info.currentHour)){
   state='hour';label='Uurprijs';nowTxt='€ '+ehFmt(info.currentHour,3);aria='Uurprijs: nu € '+ehFmt(info.currentHour,3)+' per kWh. Geen kwartierdata beschikbaar.';
  }
  const sig=state+'|'+nowTxt+'|'+at+'|'+bars.length+'|'+(day.length?day[0].t+day[day.length-1].t:'');
  if(el.dataset.sig===sig)return;
  el.dataset.sig=sig;el.dataset.state=state;el.setAttribute('aria-label',aria);
  const top=doc.createElement('div');top.className='eh-price-top';
  for(const [cls,txt,tag] of [['eh-price-label',label,'span'],['eh-price-now',nowTxt,'strong'],['eh-price-at',at,'span']]){if(!txt)continue;const n=doc.createElement(tag);n.className=cls;n.textContent=txt;top.appendChild(n);}
  el.replaceChildren(top);
  if(bars){const t=doc.createElement('template');t.innerHTML='<svg class="eh-price-bars" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true">'+bars+'</svg>';el.appendChild(t.content);}
 };
 /** Datum en buitentemperatuur voor de pil bovenaan de scène. Temperatuur: de optionele weer-entiteit (`weather`), anders de
  *  buitentemperatuur van de Cupra; alleen °C of °F en niet ouder dan 3 uur. Zonder bron: alleen de datum. */
 P._ehImmPillExtra=function(m){
  const c=this.config,h=this._hass,now=new Date();
  let date=now.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}).replace(/\.$/,'');
  const fresh=e=>{const t=Date.parse(e?.last_updated||e?.last_changed||'');return Number.isFinite(t)&&Date.now()-t<=3*3600000;};
  const fromUnit=(n,u)=>{u=String(u||'').trim().toLowerCase();return n===null?null:u==='°c'||u==='c'?n:u==='°f'||u==='f'?(n-32)*5/9:null;};
  let temp=null;
  const w=c?.weather&&h?.states?.[c.weather];
  if(w&&fresh(w)){
   if(String(c.weather).startsWith('weather.'))temp=fromUnit(ehNum(w.attributes?.temperature),w.attributes?.temperature_unit||'°C');
   else temp=fromUnit(ehNum(w.state),w.attributes?.unit_of_measurement);
  }
  if(temp===null){const e=c?.cupra_outside_temp&&h?.states?.[c.cupra_outside_temp];if(e&&fresh(e))temp=fromUnit(ehNum(e.state),e.attributes?.unit_of_measurement);}
  return date+(temp!==null&&temp>-60&&temp<70?' · '+Math.round(temp)+'°':'');
 };
 P._ehImmExtras=function(){
  if(!ehImmOn(this)||this._view!=='overview'||this._ehImmAll)return;
  this._ehImmPrice();this._ehImmLoadDay();
  // Dagregels bijwerken als een niet door de cockpit bewaakte bron (dagsensor, kosten, sessie) is gewijzigd.
  const ctl=this._ehLive?.ctl,m=ctl&&!ctl.debug.suspended?ctl.cockpit.model:null;
  if(m){
   const sig=['pv','house','cupra','net'].map(k=>(this._ehImmTileDay(k,m)||[]).join('|')).join('#')+'#'+this._ehImmPillExtra(m);
   if(sig!==this._ehImmSig){this._ehImmSig=sig;ctl.cockpit.rerender();}
  }
 };
 P._render=function(){
  const on=ehImmOn(this);
  // Opt-in uitgezet terwijl een immersive pagina open stond: veilig terug naar Home.
  if(!on&&EH_IMM_VIEWS[this._view]){this._view='overview';this._detail=null;}
  if(!on)this._ehImmAll=false;
  previous.call(this);
  if(!on||!this.config||!this._hass)return;
  const root=this.shadowRoot,shell=root?.querySelector?.('.shell');
  if(!shell)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EH-IMM */'))style.textContent+='\n'+ehImmCss();
  if(!this._ehImmEvents){
   this._ehImmEvents=true;
   root.addEventListener('click',e=>{
    if(!ehImmOn(this))return;
    if(e.target?.closest?.('[data-eh-imm-all]')){this._ehImmAll=true;this._ehImmFocus='page';this._schedule();return;}
    const page=e.target?.closest?.('[data-eh-page]');
    if(!page)return;
    const next=page.dataset.ehPage;
    if(Object.prototype.hasOwnProperty.call(EH_IMM_VIEWS,next)){this._ehImmNavigate(EH_IMM_VIEWS[next].route);return;}
    if(next==='overview'){
     // Terug naar Home: de originerende kaart krijgt de focus terug (alleen na een kaartnavigatie).
     this._ehImmAll=false;
     if(this._ehImmFrom)this._ehImmFocus='tile';
    }else this._ehImmAll=false;
   });
  }
  const view=this._view,live=!!this._ehLiveShown;
  if(view==='overview'&&live&&!this._ehImmAll){
   shell.classList.add('eh-imm-home');
   this._ehImmExtras();
  }else if(view==='overview'&&this._ehImmAll){
   // "Alle metingen": de oude Home-inhoud (metingen, grafiek, energiecoach) met een eigen kop; cockpit gepauzeerd.
   shell.classList.add('eh-imm-all');
   const ctl=this._ehLive?.ctl;
   if(ctl){ctl.suspend();ctl.host.remove();}
   const body=shell.querySelector(':scope > .body');
   const legacy=body?.querySelector('.eh26-legacy');
   if(legacy)legacy.open=true;
   if(body&&!body.querySelector('.eh-imm-allhead'))body.insertAdjacentHTML('afterbegin','<div class="eh-imm-allhead"><button type="button" class="eh-imm-back" data-eh-page="overview" aria-label="Terug naar Home">← Terug naar Home</button><h2 id="eh-imm-title" tabindex="-1">Alle metingen</h2></div>');
  }else if(EH_IMM_VIEWS[view]){
   // Bestemmingspagina: de kaart rendert voor onbekende views de Home-opmaak; vervang die door de pagina en
   // hergebruik het bestaande energiedetail (periodes, grafiek, historie) ongewijzigd.
   const hero=shell.querySelector(':scope > .hero'),body=shell.querySelector(':scope > .body');
   const pane=EH_IMM_VIEWS[view].reading?root.querySelector('.detail-panel'):null;
   const tpl=document.createElement('template');tpl.innerHTML=ehImmPageHtml(this,view);
   const main=tpl.content.firstElementChild;
   if(pane)main.appendChild(pane);
   hero?.remove();
   if(body)body.replaceWith(main);else shell.insertBefore(main,shell.querySelector(':scope > .nav'));
  }
  if(view!=='overview'){
   for(const b of root.querySelectorAll('.back-button[data-eh-page="overview"]'))b.setAttribute('aria-label','Terug naar Home');
   if(view==='cupra'){
    const head=root.querySelector('.cupra-page .cupra-head');
    if(head&&!root.querySelector('.eh-imm-follow'))head.insertAdjacentHTML('afterend','<button type="button" class="eh-imm-follow" data-eh-page="charge">Naar Slim laden →</button>');
   }
   // Pagina's zonder terugknop (bijv. Batterij, Kosten, Meer) krijgen een duidelijke "Terug naar Home".
   if(!EH_IMM_VIEWS[view]&&!root.querySelector('.back-button[data-eh-page="overview"],.eh-imm-back')){
    const head=root.querySelector('.subpage-head > div, .subpage-head');
    if(head)head.insertAdjacentHTML('afterbegin','<button type="button" class="eh-imm-back eh-imm-headback" data-eh-page="overview" aria-label="Terug naar Home">← Terug naar Home</button>');
   }
  }
  // Inzicht-menu: de meetgrafieken en de oude Home-inhoud blijven bereikbaar.
  const menu=root.querySelector('.eh26-insight-menu');
  if(menu&&!menu.querySelector('[data-eh-imm-menu]')){
   const item=(page,icon,title,sub,extra)=>'<button type="button" data-eh-imm-menu="1" data-eh-page="'+page+'"'+(extra||'')+'>'+ehIcon(icon)+'<span><strong>'+ehEsc(title)+'</strong><small>'+ehEsc(sub)+'</small></span></button>';
   menu.insertAdjacentHTML('beforeend',
    item('sun','sun','Zonnepanelen','Opwek en historie')+item('home','home','Huisverbruik','Exclusief Cupra, historie')+
    item('grid','grid','Net','Afname, teruglevering, historie')+item('practice','home','Praktijkruimte','Nog niet gekoppeld')+
    item('overview','chart','Alle metingen','Alle tegels, grafiek en energiecoach',' data-eh-imm-all="1"'));
  }
  // Focus: na navigatie naar de paginakop; na "Terug naar Home" naar de kaart waarmee de navigatie begon.
  const focus=this._ehImmFocus;this._ehImmFocus=null;
  if(focus==='page'){
   const h=root.querySelector('#eh-imm-title')||root.querySelector('.cupra-page h2, .subpage-head h2');
   if(h){if(!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}
  }else if(focus==='tile'&&view==='overview'&&live){
   const tile=this._ehLive?.ctl?.cockpit?.el?.querySelector('.tile[data-key="'+this._ehImmFrom+'"]');
   if(tile)tile.focus({preventScroll:true});
  }
 };
})();
