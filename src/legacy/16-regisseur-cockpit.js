/* EnergieRegisseur v2.0 PR4 — read-only cockpit above the existing overview.
 * No new HA calls, mutation of state, storage keys or charging controls.
 */
function eh40AgeLabel(ageMs){
 if(!Number.isFinite(ageMs)||ageMs<0)return 'tijd onbekend';
 const minutes=Math.floor(ageMs/60000);
 if(minutes<1)return 'zojuist';
 if(minutes<60)return minutes+' min geleden';
 const hours=Math.floor(minutes/60);
 if(hours<24)return hours+' uur geleden';
 const days=Math.floor(hours/24);
 return days+' '+(days===1?'dag':'dagen')+' geleden';
}
function eh40Fresh(h,id,kind,limitMinutes,now,stable=false){
 const state=id&&h?.states?.[id];
 if(!state)return {ok:false,reason:id?'Niet beschikbaar':'Niet gekoppeld',value:null};
 // HA last_reported advances for unchanged readings, unlike last_updated.
 const stamp=Date.parse(state.last_reported||state.last_updated||state.last_changed||'');
 const age=now-stamp;
 const recent=Number.isFinite(stamp)&&age>=-120000&&age<=limitMinutes*60000;
 const value=kind==='power'?ehW(h,id):kind==='price'?ehCurrentPrice(h,id):ehRead(h,id);
 if(!Number.isFinite(value))return {ok:false,reason:'Geen geldige waarde',value:null};
 if(!recent){
  // Stable zero-power and vehicle SOC can be displayed only as LAST-KNOWN,
  // never counted as current or silently substituted for a live measurement.
  if(stable&&Number.isFinite(stamp)&&age>=0)return {ok:false,retained:true,reason:'Laatste stand · niet recent bevestigd · '+eh40AgeLabel(age),value,ageMs:age};
  return {ok:false,reason:Number.isFinite(stamp)?'Verouderd':'Tijd onbekend',value:null};
 }
 return {ok:true,reason:'Actueel',value};
}
function eh40History(card,id){
 const day=ehDayKey(new Date()),hist=card._historyKey?.startsWith(day+'|')?card._history:null;
 if(!id||!hist?.samples?.length||!Number.isFinite(hist.start)||!Number.isFinite(hist.dayEnd)||hist.dayEnd<=hist.start)return null;
 const all=hist.samples.filter(p=>Number.isFinite(p?.t)&&Number.isFinite(p[id]));
 if(all.length<2)return null;
 const values=all.map(p=>p[id]),min=Math.min(0,...values),max=Math.max(0,...values);
 const span=Math.max(1,max-min),width=300,height=64;
 // Missing samples form separate segments; no joining across unknown data.
 const segments=[],paths=[];let current=[];
 for(const p of hist.samples){
  if(!Number.isFinite(p?.t)||!Number.isFinite(p[id])){if(current.length>1)segments.push(current);current=[];continue;}
  const x=Math.max(0,Math.min(width,(p.t-hist.start)/(hist.dayEnd-hist.start)*width));
  const y=height-3-(p[id]-min)/span*(height-6);
  current.push([x,y]);
 }
 if(current.length>1)segments.push(current);
 for(const segment of segments){
  paths.push('<path d="'+segment.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join(' ')+'" fill="none" stroke="#5fe7bd" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');
 }
 if(!paths.length)return null;
 const zero=(height-3-(0-min)/span*(height-6)).toFixed(1);
 return '<svg viewBox="0 0 300 64" role="img" aria-label="Netvermogen vandaag, beschikbare historiewaarden. Open de uitgebreide vermogensgrafiek."><line x1="0" x2="300" y1="'+zero+'" y2="'+zero+'" stroke="#7695a5" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>'+paths.join('')+'</svg>';
}
function eh40Cockpit(card,h,c){
 const now=Date.now();
 const sources=[
  {key:'net',name:'P1',id:c.net,type:'power',ttl:5},
  {key:'pv',name:'GoodWe',id:c.zonnepanelen,type:'power',ttl:35,stable:true},
  {key:'home',name:'Huis',id:c.huis,type:'power',ttl:5},
  {key:'ev',name:'Alfen',id:c.laden,type:'power',ttl:35,stable:true},
  {key:'soc',name:'Cupra',id:c.cupra,type:'number',ttl:90,stable:true},
  {key:'price',name:'Zonneplan',id:c.prijs,type:'price',ttl:95}
 ];
 const v=Object.fromEntries(sources.map(s=>[s.key,eh40Fresh(h,s.id,s.type,s.ttl,now,!!s.stable&&(s.type!=='power'||ehW(h,s.id)===0))]));
 const ready=sources.filter(s=>v[s.key].ok).length;
 const count=sources.length;
 const status=ready===count?'Alle bronnen actueel':ready+' van '+count+' bronnen actueel';
 const text=(key,format)=>(v[key].ok||v[key].retained)?format(v[key].value):'—';
 const direction=v.net.ok?(v.net.value < -50?'Teruglevering':v.net.value>50?'Netafname':'In balans'):'Niet vastgesteld';
 const tile=(label,key,format,subtitle,link)=>{
  const reading=v[key],value=text(key,format);
  const state=reading.ok?subtitle:reading.reason;
  const destination=link.startsWith('detail:')?'data-eh-detail="'+link.slice(7)+'" aria-expanded="'+(card._detail===link.slice(7))+'"':'data-eh-page="'+link+'"';
  return '<button type="button" class="eh40-kpi'+(reading.ok?'':' eh40-unavailable')+'" '+destination+' aria-label="'+ehEsc(label+': '+value+'. '+state)+'. Bekijk details">'+
   '<span class="eh40-kpi-label">'+ehEsc(label)+'</span><strong>'+ehEsc(value)+'</strong><small>'+ehEsc(state)+'</small></button>';
 };
 const spark=eh40History(card,c.net);
 const maxPower=Math.max(100,...['pv','home','ev'].map(k=>v[k].ok?Math.max(0,v[k].value):0));
 const bars=[['Zon','pv'],['Huis','home'],['Auto','ev']].map(([label,key])=>{
  const reading=v[key],known=reading.ok||reading.retained,w=known?Math.max(0,reading.value):0;
  const percent=Math.max(0,Math.min(100,w/maxPower*100));
  const note=reading.retained?'<small>Laatste · '+ehEsc(eh40AgeLabel(reading.ageMs))+'</small>':'';
  return '<div class="eh40-flow-row'+(reading.retained?' eh40-flow-old':'')+'"><span>'+ehEsc(label)+'</span><div class="eh40-flow-track"><i style="width:'+percent.toFixed(1)+'%"></i></div><strong>'+ehEsc(known?ehPower(reading.value):'—')+note+'</strong></div>';
 }).join('');
 return '<section class="eh40-cockpit" aria-label="EnergieRegisseur cockpit">'+
  '<header class="eh40-top"><div><span class="eh40-kicker">ENERGIEREGISSEUR · LIVE INZICHT</span><h3>Jouw energie, nu</h3><p>Actuele metingen, geen voorspelde besparing of laadopdracht.</p></div>'+
  '<span class="eh40-status'+(ready===count?' eh40-status-ok':'')+'" role="status">'+ehEsc(status)+'</span></header>'+
  '<div class="eh40-kpis">'+
   tile('Net','net',ehPower,direction,'detail:grid')+
   tile('Zon','pv',ehPower,'PV-opwek','detail:sun')+
   tile('Huis','home',ehPower,'Exclusief Cupra','detail:home')+
   tile('Cupra','soc',n=>ehFmt(n,0)+'%','Accustand','cupra')+
   tile('Alfen','ev',ehPower,'Laadvermogen','charge')+
   tile('Tarief','price',n=>ehMoney(n)+'/kWh','Actuele stroomprijs','costs')+'</div>'+
  '<div class="eh40-visuals">'+
   '<div class="eh40-trend"><div class="eh40-panel-head"><strong>Netvermogen vandaag</strong><span>Historische metingen</span></div>'+
   (spark?'<button type="button" class="eh40-trend-button" data-eh-detail="grid" aria-expanded="'+(card._detail==='grid')+'" aria-label="Open netvermogendetails">'+spark+'<span>Open uitgebreide grafiek</span></button>':
    '<p class="eh40-empty">Nog geen bruikbare daghistorie. De bestaande grafiek blijft hieronder beschikbaar.</p>')+'</div>'+
   '<div class="eh40-flows"><div class="eh40-panel-head"><strong>'+(['pv','home','ev'].some(key=>v[key].retained)?'Vermogen en laatste standen':'Vermogen nu')+'</strong><span>Geen energiebalans</span></div>'+bars+'</div></div>'+
  '<div class="eh40-footer"><span>Bronnen: '+sources.map(s=>ehEsc(s.name)+' '+(v[s.key].ok?'✓':'·')).join('  ')+'</span>'+
   '<nav aria-label="Cockpit snelkoppelingen"><button type="button" data-eh-page="charge">Slim laden</button><button type="button" data-eh-page="battery">Batterij</button><button type="button" data-eh-page="costs">Kosten</button></nav></div>'+
  '</section>';
}
function eh40Css(){
 return '.eh40-cockpit{margin:0 0 12px;padding:16px;border:1px solid #64baa68c;background:linear-gradient(145deg,#113e49,#0b2738 55%,#0b2032);border-radius:20px;box-shadow:0 8px 26px #0003;min-width:0}.eh40-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.eh40-kicker{font-size:9px;letter-spacing:.13em;font-weight:850;color:#6befc6}.eh40-top h3{font-size:23px;letter-spacing:-.6px;margin:5px 0}.eh40-top p{font-size:11px;line-height:1.45;color:#b2cbd5;margin:0}.eh40-status{border:1px solid #ebbf8070;color:#f4ca86;background:#9a6b241a;padding:6px 10px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap}.eh40-status-ok{border-color:#71e3bf66;color:#91ebca;background:#12624330}.eh40-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.eh40-kpi{font:inherit;color:#edfaff;text-align:left;border:1px solid #7198ad45;background:#0a2234bd;border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:5px;min-width:0;min-height:100px;cursor:pointer}.eh40-kpi-label{font-size:11px;color:#a6c8d3}.eh40-kpi strong{font-size:21px;letter-spacing:-.5px;line-height:1.2;overflow-wrap:anywhere}.eh40-kpi small{font-size:10px;color:#a9c5d2;line-height:1.35}.eh40-kpi.eh40-unavailable strong{color:#9db4be}.eh40-cockpit button:focus-visible{outline:2px solid #6beec9;outline-offset:2px}.eh40-cockpit button:hover{border-color:#76edc0}.eh40-visuals{display:grid;grid-template-columns:1.1fr 1fr;gap:8px}.eh40-trend,.eh40-flows{min-width:0;background:#071e30bd;border:1px solid #7799aa40;border-radius:13px;padding:12px}.eh40-panel-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px}.eh40-panel-head strong{font-size:12px}.eh40-panel-head span{font-size:10px;color:#a0bdcc}.eh40-trend-button{font:inherit;color:#a6d8e4;cursor:pointer;background:transparent;border:0;padding:6px 0 0;display:block;width:100%;text-align:left}.eh40-trend-button svg{display:block;width:100%;height:72px}.eh40-trend-button span{font-size:10px;color:#79d9c0}.eh40-empty{font-size:11px;color:#a8beca;line-height:1.6;min-height:75px}.eh40-flow-row{display:grid;grid-template-columns:36px minmax(0,1fr) 65px;align-items:center;gap:7px;margin:12px 0;font-size:11px}.eh40-flow-row strong{text-align:right;font-size:11px;white-space:nowrap}.eh40-flow-row.eh40-flow-old strong{white-space:normal}.eh40-flow-old strong small{display:block;font-size:9px;line-height:1.3;color:#f5c883;font-weight:650;overflow-wrap:anywhere}.eh40-flow-track{height:8px;border-radius:99px;background:#294657;overflow:hidden}.eh40-flow-track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#28a6cb,#60e6b7)}.eh40-footer{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;font-size:10px;color:#9cbac7;line-height:1.5}.eh40-footer nav{display:flex;flex-wrap:wrap;gap:6px}.eh40-footer button{font:inherit;cursor:pointer;border:1px solid #75d3b47a;background:#163f47;color:#e5fcf6;padding:7px 9px;border-radius:9px;min-height:44px;font-size:11px}@media(max-width:720px){.eh40-cockpit{padding:11px;border-radius:14px}.eh40-top h3{font-size:20px}.eh40-top{flex-wrap:wrap}.eh40-status{font-size:9px;padding:5px 7px}.eh40-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:11px 0}.eh40-kpi{padding:9px;min-height:83px}.eh40-kpi strong{font-size:18px}.eh40-visuals{grid-template-columns:minmax(0,1fr)}.eh40-footer{gap:8px}}@media(max-width:360px){.eh40-cockpit{padding:9px}.eh40-kpi strong{font-size:16px}.eh40-flow-row{grid-template-columns:32px minmax(0,1fr) 58px;gap:5px}.eh40-footer button{font-size:10px}}';
}
(function eh40Install(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._render=function(){
  previous.call(this);
  if(this._view!=='overview'||!this.config||!this._hass)return;
  const root=this.shadowRoot,metrics=root?.querySelector?.('.body .metrics');
  if(!metrics)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('.eh40-cockpit{'))style.textContent+='\n'+eh40Css();
  metrics.insertAdjacentHTML('beforebegin',eh40Cockpit(this,this._hass,this.config));
  // Keep a cockpit-opened detail directly under the cockpit on subsequent renders.
  const pane=this._eh40PinnedDetail===this._detail&&this._detail?
   root.querySelector('.body > .detail-panel'):null;
  if(pane){
   const cockpit=root.querySelector('.eh40-cockpit');
   if(cockpit)cockpit.insertAdjacentElement('afterend',pane);
   if(this._eh40RevealPending&&typeof pane.scrollIntoView==='function'){
    this._eh40RevealPending=false;
    pane.scrollIntoView({block:'start',behavior:'auto'});
   }
  }
  if(!this._eh40EventsReady){
   this._eh40EventsReady=true;
   root.addEventListener('click',event=>{
    const trigger=event.target?.closest?.('.eh40-cockpit [data-eh-detail]');
    if(trigger){
     // Existing controller's click handler has already updated _detail.
     this._eh40PinnedDetail=this._detail===trigger.dataset.ehDetail?this._detail:null;
     this._eh40RevealPending=!!this._eh40PinnedDetail;
    }else if(event.target?.closest?.('[data-eh-detail],[data-eh-page],[data-eh-close]')){
     this._eh40PinnedDetail=null;this._eh40RevealPending=false;
    }
   });
  }
 };
})();

/* v1.26.0-rc Visual Experience: presentation only, no data or charging changes.
 * Four visible navigation destinations; secondary views remain available in Inzicht.
 * This appends to the final source fragment, preserving deterministic HACS assembly.
 */
function eh26Navigation(view,open){
 const chosen=['cupra','battery','costs'].includes(view);
 const tabs=[
  ['Home','home','overview'],
  ['Laden','bolt','charge'],
  ['Inzicht','chart',null],
  ['Meer','dots','more']
 ];
 const buttons=tabs.map(([name,icon,page])=>{
  const active=page?view===page:chosen;
  const action=page?'data-eh-page="'+page+'"':'data-eh26-insights="1" aria-expanded="'+(open?'true':'false')+'" aria-controls="eh26-insight-menu"';
  return '<button type="button" class="navitem eh26-navitem'+(active?' active':'')+'" '+action+' aria-label="'+name+'" '+(active?'aria-current="page"':'')+'>'+ehIcon(icon)+'<span>'+name+'</span></button>';
 }).join('');
 const menu=open?'<div class="eh26-insight-menu" id="eh26-insight-menu" role="group" aria-label="Inzicht onderdelen">'+
  '<span class="eh26-menu-label">Verdiep je inzicht</span>'+
  '<button type="button" data-eh-page="cupra">'+ehIcon('car')+'<span><strong>Cupra inzichten</strong><small>Ritten, efficiëntie en laden</small></span></button>'+
  '<button type="button" data-eh-page="battery">'+ehIcon('battery')+'<span><strong>Thuisbatterij</strong><small>Simulatie en rendement</small></span></button>'+
  '<button type="button" data-eh-page="costs">'+ehIcon('euro')+'<span><strong>Kosten & vergelijken</strong><small>Budget, leveranciers en historie</small></span></button>'+
  '</div>':'';
 return buttons+menu;
}
function eh26Css(){
 return [
  '/* EH26 VISUAL: mobile-first presentation, retained original controls and readings. */',
  ':host{--eh26-ink:#f1fbff;--eh26-border:#ffffff19;--eh26-surface:#0a2234;--eh26-muted:#a1bece}',
  '.shell{background:radial-gradient(ellipse 80% 28% at 60% 0%,#18456055,transparent 92%),linear-gradient(180deg,#071725,#091d2c 55%,#071522);border-color:#ffffff10;box-shadow:0 18px 46px #0004}',
  '.shell>.eh19-appbar{padding:11px 16px;background:#071b2be8;border-bottom:1px solid #ffffff12}',
  '.shell .hero{height:66px!important;min-height:66px;border-radius:0;overflow:hidden}',
  '.shell .hero:before{background:linear-gradient(90deg,#071a29dc,#13354b55);z-index:0}',
  '.shell .hero-inner{padding:16px 18px;position:relative;z-index:1}',
  '.shell .hero .title{font-size:24px;letter-spacing:-.7px;text-shadow:none}',
  '.shell .body{padding:12px 16px 20px;margin:0}',
  '.eh40-cockpit{padding:3px 0 10px;margin:0 0 6px;background:none;border:0;box-shadow:none;border-radius:0}',
  '.eh40-top{align-items:center;gap:10px;padding:2px 2px 8px}',
  '.eh40-top h3{font-size:24px;letter-spacing:-.8px;margin:4px 0;line-height:1.15}',
  '.eh40-top p{font-size:11px;color:var(--eh26-muted)}',
  '.eh40-kicker{color:#7cf0c6;font-size:9px;letter-spacing:.15em}',
  '.eh40-status{background:#5f421b24;border:1px solid #ebc07952;line-height:1.4}',
  '.eh40-status-ok{background:#114a3b6b;border-color:#63dab174}',
  '.eh40-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin:12px 0 14px}',
  '.eh40-kpi{grid-column:span 2;min-height:93px;background:linear-gradient(148deg,#123149,#0c2233);border:1px solid var(--eh26-border);border-radius:16px;box-shadow:0 6px 18px #0002;position:relative;overflow:hidden;padding:13px;gap:4px}',
  '.eh40-kpi:before{content:"";position:absolute;right:-30px;top:-30px;width:105px;height:105px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#ffffff08,transparent 70%)}',
  '.eh40-kpi:nth-child(1){grid-column:span 6;min-height:108px;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-content:center;background:radial-gradient(ellipse at 95% 20%,#19756055,transparent 65%),linear-gradient(120deg,#11413f,#103347 64%,#0e2637);border-color:#57cdaa64;padding:17px 19px}',
  '.eh40-kpi:nth-child(1) .eh40-kpi-label{grid-column:1;grid-row:1;align-self:end}',
  '.eh40-kpi:nth-child(1) strong{grid-column:2;grid-row:1/3;font-size:32px;align-self:center;color:#7ff0c1;white-space:nowrap}',
  '.eh40-kpi:nth-child(1) small{grid-column:1;grid-row:2}',
  '.eh40-kpi:nth-child(2) strong{color:#ffda70}',
  '.eh40-kpi:nth-child(3) strong{color:#86c9ff}',
  '.eh40-kpi:nth-child(4) strong{color:#c0a6ff}',
  '.eh40-kpi:nth-child(6) strong{color:#87d8ff}',
  '.eh40-kpi-label{color:#b6cfda;font-size:12px;font-weight:650}',
  '.eh40-kpi strong{font-size:20px;letter-spacing:-.5px;font-variant-numeric:tabular-nums}',
  '.eh40-kpi small{font-size:10px;color:#a2bdc9}',
  '.eh40-visuals{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:10px}',
  '.eh40-trend,.eh40-flows{background:linear-gradient(160deg,#102c42,#0a2031);border:1px solid #ffffff16;border-radius:17px;padding:16px}',
  '.eh40-panel-head strong{font-size:14px;letter-spacing:-.2px}',
  '.eh40-trend-button svg{height:132px;filter:drop-shadow(0 4px 10px #24d6a52d)}',
  '.eh40-trend-button span{display:block;text-align:right;font-size:11px;margin-top:5px}',
  '.eh40-flow-track{height:9px;background:#243d50}',
  '.eh40-footer{padding:13px 2px 2px;color:#91b5c7;border-top:1px solid #ffffff13}',
  '.eh40-footer button{border-radius:12px;background:#143a47;border-color:#ffffff26}',
  '.eh26-legacy{background:#092235;border:1px solid #ffffff1a;border-radius:16px;margin:8px 0 10px;padding:0 12px}',
  '.eh26-legacy>summary{cursor:pointer;min-height:50px;padding:15px 1px;color:#d9f0f4;font-size:13px;font-weight:760;list-style:none;display:flex;align-items:center;justify-content:space-between}',
  '.eh26-legacy>summary::-webkit-details-marker{display:none}',
  '.eh26-legacy>summary:after{content:"+";font-size:23px;font-weight:450;color:#6de3bb}',
  '.eh26-legacy[open]>summary:after{content:"−"}',
  '.eh26-legacy .metrics{margin:4px 0 12px}',
  '.eh26-legacy .chart-panel{margin-bottom:12px}',
  '.eh26-legacy button:focus-visible,.eh26-legacy>summary:focus-visible{outline:2px solid #67d9b8;outline-offset:2px}',
  '.shell .cupra-card,.shell .subsection,.shell .subcard,.shell .utility-card{border-radius:18px;border-color:#ffffff21;box-shadow:0 6px 20px #0001}',
  '.shell .cupra-page{gap:11px}',
  '.shell .cupra-head h2,.shell .subpage-head h2{font-size:27px;letter-spacing:-.7px}',
  '.shell .cupra-hero{background:radial-gradient(ellipse at 75% 10%,#1c5771,#103248 60%,#0b2232);border-color:#83b9cf50}',
  '.shell .section-title,.shell .eh17-title{letter-spacing:-.25px}',
  '.nav{gap:8px;padding:9px 12px max(12px,env(safe-area-inset-bottom));background:#061522f5;border-top:1px solid #ffffff1c;box-shadow:0 -11px 26px #0009;justify-content:space-between;position:sticky}',
  '.eh26-navitem{min-height:55px;flex:1;max-width:none;border-radius:13px;padding:7px 5px;gap:5px;font-weight:650;font-size:11px}',
  '.eh26-navitem .icon{width:23px;height:23px}',
  '.eh26-navitem.active{background:linear-gradient(155deg,#11634e8a,#0a392fd9);color:#79f5c5;border:1px solid #47cda269}',
  '.eh26-insight-menu{position:absolute;right:12px;bottom:calc(100% + 10px);width:min(350px,calc(100% - 24px));z-index:90;padding:9px;border:1px solid #64aeaa66;border-radius:19px;background:linear-gradient(155deg,#16364c,#071c2b);box-shadow:0 16px 40px #000b;display:grid;gap:6px}',
  '.eh26-menu-label{font-size:10px;letter-spacing:.12em;color:#87e6c9;font-weight:800;text-transform:uppercase;padding:9px 8px 4px}',
  '.eh26-insight-menu button{font:inherit;min-height:62px;text-align:left;color:#f1f9ff;display:flex;align-items:center;gap:12px;background:#ffffff08;border:1px solid #ffffff15;border-radius:12px;padding:10px 12px;cursor:pointer}',
  '.eh26-insight-menu button .icon{height:23px;width:23px;color:#72e0c6;flex:none}',
  '.eh26-insight-menu button span{display:grid;gap:4px}',
  '.eh26-insight-menu button strong{font-size:13px}',
  '.eh26-insight-menu button small{font-size:10px;color:#adc5d2}',
  '.eh26-insight-menu button:focus-visible,.eh26-navitem:focus-visible{outline:2px solid #87e4dc;outline-offset:2px}',
  '@media(max-width:720px){.shell .body{padding:9px 11px 15px}.eh40-top{flex-wrap:wrap}.eh40-top h3{font-size:23px}.eh40-status{font-size:9px}.eh40-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.eh40-kpi{grid-column:span 1;min-height:88px;padding:12px}.eh40-kpi:nth-child(1){grid-column:1/-1;min-height:99px;padding:14px 15px}.eh40-kpi:nth-child(1) strong{font-size:30px}.eh40-kpi:nth-child(6){grid-column:1/-1;min-height:72px;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-content:center}.eh40-kpi:nth-child(6) .eh40-kpi-label{grid-column:1;grid-row:1}.eh40-kpi:nth-child(6) strong{grid-column:2;grid-row:1/3;align-self:center}.eh40-kpi:nth-child(6) small{grid-column:1;grid-row:2}.eh40-visuals{grid-template-columns:1fr}.eh40-trend,.eh40-flows{padding:13px}.eh40-trend-button svg{height:120px}.eh40-footer nav{width:100%}.eh40-footer nav button{flex:1}.shell .cupra-page{padding:11px}.shell .hero .title{font-size:22px}.eh26-legacy{padding:0 10px}.eh26-navitem{font-size:11px}.shell .cupra-hero{min-height:128px}}',
  '@media(max-width:360px){.eh40-kpi:nth-child(1) strong{font-size:26px}.eh40-kpi strong{font-size:17px}.eh40-kpi:nth-child(6) strong{font-size:17px}.eh26-navitem{padding:5px 2px;font-size:10px}.nav{gap:4px;padding-left:7px;padding-right:7px}.eh40-trend-button svg{height:100px}}',
  '.eh26-insight-menu{scroll-behavior:auto}'
 ].join('\n');
}
(function eh26Install(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._render=function(){
  previous.call(this);
  if(!this.config||!this._hass)return;
  const root=this.shadowRoot,nav=root?.querySelector?.('.shell > .nav');
  if(!nav)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EH26 VISUAL'))style.textContent+='\n'+eh26Css();
  nav.innerHTML=eh26Navigation(this._view,this._eh26MenuOpen===true);
  if(this._view==='overview'){
   const hero=root.querySelector('.shell > .hero');
   if(hero&&!this.config.hero_image)hero.style.backgroundImage='radial-gradient(ellipse at 80% 0%,#1b526a,#0c293d 55%,#091c2b)';
   const body=root.querySelector('.shell > .body'),metrics=body?.querySelector('.metrics');
   if(metrics){
    const legacy=document.createElement('details');
    legacy.className='eh26-legacy';
    legacy.open=!!this._eh26LegacyOpen;
    const summary=document.createElement('summary');
    summary.textContent='Alle metingen en uitgebreide grafiek';
    legacy.appendChild(summary);
    metrics.insertAdjacentElement('beforebegin',legacy);
    legacy.appendChild(metrics);
    const chart=body.querySelector(':scope > .chart-panel');
    if(chart)legacy.appendChild(chart);
    // Details.open is read before each render; no asynchronous toggle-state race.
   }
  }
  if(!this._eh26Events){
   this._eh26Events=true;
   root.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-eh26-insights]')){
     this._eh26MenuOpen=!this._eh26MenuOpen;
     this._schedule();
     return;
    }
    if(this._eh26MenuOpen&&e.target?.closest?.('[data-eh-page]'))this._eh26MenuOpen=false;
    else if(this._eh26MenuOpen&&!e.target?.closest?.('.eh26-insight-menu')){
     this._eh26MenuOpen=false;this._schedule();
    }
   });
   root.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&this._eh26MenuOpen){
     this._eh26MenuOpen=false;this._schedule();
    }
   });
  }
 };
})();

/* v1.26 RC2: independent-review fixes. Presentation and accessibility only. */
function eh26ReviewCss(){
 return [
  '.eh40-kpis{grid-template-columns:repeat(10,minmax(0,1fr))}',
  '.eh40-kpi:nth-child(1){grid-column:span 10}',
  '@media(max-width:720px){.eh40-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.eh40-kpi:nth-child(1){grid-column:1/-1}}',
  '.shell .eh40-kicker,.shell .eh40-status,.shell .eh40-panel-head span,.shell .eh40-footer,.shell .eh40-flow-row,.shell .eh26-menu-label,.shell .eh26-navitem{font-size:11px}',
  '.shell .eh40-kpi small,.shell .eh40-top p,.shell .eh26-insight-menu button small{font-size:12px}',
  '.eh26-legacy .detail-panel{scroll-margin-top:95px}',
  '.eh40-trend-button svg{aspect-ratio:300 / 64}',
  '@media(max-width:360px){.shell .eh26-navitem{font-size:11px}}'
 ].join('\n');
}
(function eh26ReviewInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render,disconnect=P.disconnectedCallback;
 P.disconnectedCallback=function(){
  if(this._eh26DocumentHandlers){
   const {pointer,focus,key}=this._eh26DocumentHandlers;
   document.removeEventListener('pointerdown',pointer,true);
   document.removeEventListener('focusin',focus,true);
   document.removeEventListener('keydown',key,true);
   this._eh26DocumentHandlers=null;
  }
  this._eh26MenuOpen=false;
  if(typeof disconnect==='function')disconnect.call(this);
 };
 P._render=function(){
  const prior=this.shadowRoot,active=prior?.activeElement;
  const oldLegacy=prior?.querySelector('.eh26-legacy');
  if(oldLegacy)this._eh26LegacyOpen=oldLegacy.open;
  const remembered=active?.matches?.('[data-eh26-insights]')?'trigger':
   active?.matches?.('.eh26-insight-menu [data-eh-page]')?'menu:'+active.dataset.ehPage:
   active?.matches?.('.eh26-navitem[data-eh-page]')?'nav:'+active.dataset.ehPage:null;
  previous.call(this);
  if(!this.config||!this._hass)return;
  const root=this.shadowRoot,nav=root?.querySelector('.shell > .nav');
  if(!nav)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EH26 REVIEW */'))style.textContent+='\n/* EH26 REVIEW */\n'+eh26ReviewCss();
  const trigger=nav.querySelector('[data-eh26-insights]');
  trigger?.setAttribute('aria-haspopup','dialog');
  const menu=nav.querySelector('.eh26-insight-menu');
  if(menu)menu.setAttribute('role','dialog');
  root.querySelector('.eh40-trend-button svg')?.setAttribute('preserveAspectRatio','xMidYMid meet');
  if(this._view==='overview'){
   const body=root.querySelector('.shell > .body'),legacy=body?.querySelector('.eh26-legacy');
   const pane=body?.querySelector(':scope > .detail-panel');
   if(legacy&&pane&&this._detail&&this._eh40PinnedDetail!==this._detail){
    const metricList=legacy.querySelector('.metrics');
    metricList?.insertAdjacentElement('afterend',pane);
    if(this._eh26LegacyReveal===this._detail){
     this._eh26LegacyReveal=null;
     pane.scrollIntoView?.({block:'start',behavior:'auto'});
    }
   }
  }
  let key=this._eh26RestoreFocus||remembered;
  this._eh26RestoreFocus=null;
  if(key){
   let target=key==='trigger'?trigger:
    key==='first'?menu?.querySelector('[data-eh-page]'):
    key.startsWith('menu:')?menu?.querySelector('[data-eh-page="'+key.slice(5)+'"]'):
    key.startsWith('nav:')?nav.querySelector('.eh26-navitem[data-eh-page="'+key.slice(4)+'"]'):null;
   if(!target&&key.startsWith('menu:'))target=trigger;
   target?.focus({preventScroll:true});
  }
  if(!this._eh26ReviewEvents){
   this._eh26ReviewEvents=true;
   root.addEventListener('click',e=>{
    const meter=e.target?.closest?.('.eh26-legacy .metric[data-eh-detail]');
    if(meter){
     this._eh26LegacyOpen=true;
     this._eh26LegacyReveal=this._detail===meter.dataset.ehDetail?this._detail:null;
    }
    if(e.target?.closest?.('[data-eh26-insights]')){
     this._eh26RestoreFocus=this._eh26MenuOpen?'first':'trigger';
    }else if(e.target?.closest?.('.eh26-insight-menu [data-eh-page]')){
     this._eh26RestoreFocus='trigger';
    }
   });
  }
  if(!this._eh26DocumentHandlers&&this.isConnected){
   const pointer=e=>{
    if(this._eh26MenuOpen&&!e.composedPath().includes(this)){
     this._eh26MenuOpen=false;this._schedule();
    }
   };
   const focus=e=>{
    if(!this._eh26MenuOpen)return;
    if(!e.composedPath().some(x=>x?.matches?.('.eh26-insight-menu,[data-eh26-insights]'))){
     this._eh26MenuOpen=false;this._schedule();
    }
   };
   const key=e=>{
    if(e.key!=='Escape'||!this._eh26MenuOpen)return;
    e.preventDefault();
    this._eh26MenuOpen=false;
    this._eh26RestoreFocus='trigger';
    this._schedule();
   };
   this._eh26DocumentHandlers={pointer,focus,key};
   document.addEventListener('pointerdown',pointer,true);
   document.addEventListener('focusin',focus,true);
   document.addEventListener('keydown',key,true);
  }
 };
})();
