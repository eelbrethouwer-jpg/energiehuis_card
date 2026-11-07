/* Energiehuis v1.9.0 RC — mobile-first Lovelace shell.
 * PWA authentication and offline caching are deliberately NOT implemented.
 */
const EH19_UI_STORAGE='energiehuis.ui.density';
function eh19ReadDensity(){
 try{return window.localStorage?.getItem(EH19_UI_STORAGE)==='roomy'?'roomy':'compact';}
 catch(_){return 'compact';}
}
function eh19SaveDensity(value){
 try{window.localStorage?.setItem(EH19_UI_STORAGE,value);}catch(_){}
}
function eh19ConnectionState(h,win){
 return win?.navigator?.onLine===false||h?.connection?.connected===false?'offline':'unknown';
}
function eh19Toolbar(card,h){
 const names={overview:'Overzicht',cupra:'Cupra',charge:'Slim laden',battery:'Batterij',costs:'Kosten',more:'Meer'};
 const compact=card._eh19Density!=='roomy';
 const offline=eh19ConnectionState(h,window)==='offline';
 return '<header class="eh19-appbar" aria-label="Mobiele Energiehuis-werkbalk">'+
  '<div class="eh19-appname" aria-label="'+ehEsc(names[card._view]||'Overzicht')+'"><small>ENERGIEHUIS</small></div>'+
  '<span aria-live="polite" class="eh19-connection'+(offline?' eh19-offline':'')+'">'+
  (offline?'Offline · mogelijk oude meetwaarden':(card._view==='charge'&&card.config?.charge_control_enabled===true?'HA-scriptbediening':card._view==='charge'?'Simulatie':'Alleen uitlezen'))+'</span>'+
  '<button type="button" data-eh19-density="toggle" class="eh19-density" aria-pressed="'+compact+
  '" aria-label="'+(compact?'Schakel naar ruime weergave':'Schakel naar compacte weergave')+'">'+
  'Weergave: '+(compact?'Compact':'Ruim')+'</button></header>';
}
function eh19Css(){
 return '.eh19-appbar{display:none}.eh19-density:focus-visible{outline:2px solid #8edcff;outline-offset:2px}'+
 '@media(max-width:720px){'+
 '.eh19-appbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #b7daef22;background:#071e2d;color:#f0fbff;border-radius:20px 20px 0 0}'+
 '.eh19-appname{display:flex;flex-direction:column;gap:2px;min-width:0}.eh19-appname small{font-size:9px;letter-spacing:.11em;color:#74dfb1;font-weight:800}.eh19-appname strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
 '.eh19-connection{max-width:112px;text-align:right;font-size:10px;color:#b7d4e2;line-height:1.25}.eh19-offline{color:#ffcd8a;font-weight:750}'+
 '.eh19-density{min-height:40px;padding:9px 10px;font:inherit;font-size:11px;font-weight:750;white-space:nowrap;border:1px solid #86b2c16c;border-radius:10px;background:#183a4c;color:#f1fbff;cursor:pointer}'+
 '.shell.eh19-float-nav .nav{position:fixed;bottom:0;left:0;right:0;width:100%;max-width:620px;margin:0 auto;border-radius:15px 15px 0 0;z-index:1000;padding:8px 4px max(9px,env(safe-area-inset-bottom))}'+
 '.shell.eh19-float-nav.eh19-outside .nav{visibility:hidden;pointer-events:none}'+
 '.shell.eh19-float-nav .body{padding-bottom:calc(104px + env(safe-area-inset-bottom))}'+
 '.shell.eh19-float-nav .subpage,.shell.eh19-float-nav .cupra-page{padding-bottom:calc(116px + env(safe-area-inset-bottom))}'+
 '.shell.eh19-float-nav .navitem{min-height:46px;font-size:10px;padding:6px 3px}'+
 '.shell:not(.eh19-roomy) .hero{height:150px;border-radius:0}.shell:not(.eh19-roomy) .hero-inner{padding:17px 13px 0}.shell:not(.eh19-roomy) .title{font-size:26px}.shell:not(.eh19-roomy) .subtitle{display:none}'+
 '.shell:not(.eh19-roomy) .body{margin-top:-10px;padding-left:9px!important;padding-right:9px!important}'+
 '.shell:not(.eh19-roomy) .metrics{gap:6px}.shell:not(.eh19-roomy) .metric{min-height:72px;padding:9px 7px;gap:6px;border-radius:12px}'+
 '.shell:not(.eh19-roomy) .metric-symbol{width:25px;height:25px}.shell:not(.eh19-roomy) .metric-symbol .icon{width:22px;height:22px}'+
 '.shell:not(.eh19-roomy) .metric-label{font-size:10px}.shell:not(.eh19-roomy) .metric-value{font-size:16px;margin-top:3px}.shell:not(.eh19-roomy) .metric-sub,.shell:not(.eh19-roomy) .metric-chevron{display:none}'+
 '.shell:not(.eh19-roomy) .chart-panel{margin-top:9px;padding:12px 10px}'+
 '.shell:not(.eh19-roomy) .subpage{padding-left:10px;padding-right:10px}.shell:not(.eh19-roomy) .subpage-head{margin-bottom:9px;padding:8px 2px}.shell:not(.eh19-roomy) .subpage-head h2{font-size:25px}'+
 '.shell:not(.eh19-roomy) .subgrid,.shell:not(.eh19-roomy) .subgrid.three{gap:6px}.shell:not(.eh19-roomy) .subcard{padding:10px;min-height:96px;border-radius:13px}.shell:not(.eh19-roomy) .subcard strong{font-size:18px}.shell:not(.eh19-roomy) .subcard small{margin-top:6px}'+
 '.shell:not(.eh19-roomy) .subcard .sub-icon{width:29px;height:29px;border-radius:9px}.shell:not(.eh19-roomy) .subcard .sub-icon .icon{width:18px;height:18px}'+
 '.shell:not(.eh19-roomy) .subsection{padding:12px;margin-top:9px;border-radius:13px}.shell:not(.eh19-roomy) .subrows>div{padding:9px 2px;font-size:12px}'+
 '.shell:not(.eh19-roomy) .cupra-page{padding:11px 9px}.shell:not(.eh19-roomy) .cupra-hero{min-height:144px;padding:13px}.shell:not(.eh19-roomy) .cupra-card{padding:12px;border-radius:14px}'+
 '}'+
 '@media(max-width:355px){.eh19-connection:not(.eh19-offline){display:none}.eh19-density{padding:9px 8px}.shell.eh19-float-nav .navitem{font-size:9px}}';
}
(function eh19Install(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._render=function(){
  previous.call(this);
  const root=this.shadowRoot,shell=root?.querySelector?.('.shell');
  if(!shell||!this.config||!this._hass)return;
  if(!this._eh19Density)this._eh19Density=eh19ReadDensity();
  if(!this._eh19HandlersReady){
   this._eh19HandlersReady=true;
   root.addEventListener('click',event=>{
    if(!event.target?.closest?.('[data-eh19-density]'))return;
    this._eh19Density=this._eh19Density==='compact'?'roomy':'compact';
    eh19SaveDensity(this._eh19Density);
    this._schedule();
   });
  }
  // Disabling floating navigation must also stop an observer already running.
  if(this.config.mobile_fixed_navigation===false&&this._eh19Observer){
   this._eh19Observer.disconnect();
   this._eh19Observer=null;
   this._eh19Visible=true;
  }
  // Fixed bottom bar only while the host card intersects the viewport.
  // Browsers without IntersectionObserver keep the existing sticky nav.
  if(this.isConnected&&this.config.mobile_fixed_navigation!==false&&
     typeof window.IntersectionObserver==='function'&&!this._eh19Observer){
   try{
    this._eh19Observer=new window.IntersectionObserver(entries=>{
     this._eh19Visible=!!entries[0]?.isIntersecting;
     this.shadowRoot?.querySelector?.('.shell')?.classList?.toggle?.('eh19-outside',!this._eh19Visible);
    },{threshold:0});
    this._eh19Observer.observe(this);
   }catch(_){this._eh19Observer?.disconnect?.();this._eh19Observer=null;}
  }
  shell.classList?.toggle?.('eh19-roomy',this._eh19Density==='roomy');
  shell.classList?.toggle?.('eh19-float-nav',!!this._eh19Observer);
  shell.classList?.toggle?.('eh19-outside',this._eh19Visible===false);
  shell.insertAdjacentHTML?.('afterbegin',eh19Toolbar(this,this._hass));
  const style=root.querySelector?.('style');
  if(style&&!style.textContent.includes('.eh19-appbar{'))style.textContent+='\n'+eh19Css();
 };
})();

