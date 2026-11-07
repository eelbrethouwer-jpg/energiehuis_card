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
