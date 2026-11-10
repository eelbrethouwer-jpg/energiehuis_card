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
  '@media(max-width:720px){.eh-imm-page{padding:12px 10px 82px}.eh-imm-page .subpage-head h2{font-size:24px}.eh-imm-now strong{font-size:26px}}'
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
