// Energiehuis 3.1 — vijf tabs met segmenten (alleen presentatie, geen nieuwe HA-aanroepen).
// De bestaande pagina's blijven ongewijzigd renderen; dit fragment groepeert ze per tab, toont per segment alleen de
// bijbehorende onderdelen en vervangt het Inzicht-uitklapmenu door een vaste onderbalk met vijf tabs.
// Home (overview en de detailpagina's vanuit Home) wordt hier niet aangeraakt.
const EHNV_HOME_VIEWS=Object.freeze(['overview','sun','home','grid','practice']);
const EHNV_TABS=Object.freeze([
 {id:'overview',label:'Home',icon:'home'},
 {id:'energy',label:'Energie',icon:'bolt'},
 {id:'auto',label:'Auto',icon:'car'},
 {id:'money',label:'Geld',icon:'euro'},
 {id:'more',label:'Meer',icon:'dots'}
]);
// show(el,heading,isHead): welke kinderen van <main> zichtbaar zijn in dit segment.
const ehNvHeading=el=>String(el.querySelector?.('h2,h3,h4,.section-title')?.textContent||'').replace(/\s+/g,' ').trim();
const ehNvIsHead=el=>!!el.matches?.('.subpage-head,.cupra-head');
const ehNvIsGas=(el,h)=>!!el.matches?.('.utility-grid')||/Gas Insights/.test(h);
const ehNvIsSun=(el,h)=>/Zonne-energie Insights/.test(h);
const ehNvIsPlan=(el,h)=>/Jouw laadscenario|Planningsmodus|Verwachte laadplanning/.test(h)||!!el.matches?.('.eh17-panel,details');
const EHNV_SEGMENTS=Object.freeze({
 energy:Object.freeze([
  {id:'balance',label:'Balans',view:'balance',mode:'main',show:(el,h)=>!/Meetcontrole/.test(h),folds:[[(el,h)=>/Wat het kost/.test(h),'Wat het kost']]},
  {id:'sun',label:'Zon',view:'more',title:['Zon','Opbrengst, eigen gebruik en historie'],show:(el,h)=>ehNvIsSun(el,h)||ehNvIsHead(el)},
  {id:'battery',label:'Batterij',view:'battery',show:()=>true},
  {id:'gas',label:'Gas & water',view:'more',show:(el,h)=>ehNvIsGas(el,h)||ehNvIsHead(el)}
 ]),
 auto:Object.freeze([
  {id:'status',label:'Status',view:'cupra',show:()=>true,folds:[[(el,h)=>!!el.matches?.('.cupra-insights')||/Cupra Insights/.test(h),'Cupra Insights en ritten'],[(el,h)=>!!el.matches?.('.eh17-panel'),'Laadsessies en kosten']]},
  {id:'charge',label:'Laadbediening',view:'charge',show:(el,h)=>!ehNvIsPlan(el,h)},
  {id:'plan',label:'Planning',view:'charge',show:(el,h)=>ehNvIsPlan(el,h)||ehNvIsHead(el)}
 ]),
 money:Object.freeze([
  {id:'costs',label:'Kosten',view:'costs',show:(el,h)=>!el.matches?.('.ehcmp'),folds:[[(el,h)=>!!el.matches?.('.eh18-panel'),'Databronnen en aannames']]},
  {id:'contracts',label:'Contracten',view:'costs',show:(el,h)=>!!el.matches?.('.ehcmp')||ehNvIsHead(el)}
 ]),
 more:Object.freeze([
  {id:'sources',label:'Bronnen & data',view:'more',folds:[[(el,h)=>/Datakwaliteit/.test(h),'Datakwaliteit en extra controles']],title:['Bronnen & data','Welke sensoren gekoppeld zijn en hoe actueel ze zijn'],show:(el,h)=>ehNvIsHead(el)||(!ehNvIsGas(el,h)&&!ehNvIsSun(el,h))},
  {id:'check',label:'Meetcontrole',view:'balance',mode:'check',show:(el,h)=>/Meetcontrole/.test(h)||!!el.matches?.('.eh3-foot')},
  {id:'details',label:'Home-details',view:'more',links:true,title:['Home-details','Detailpagina\'s vanuit Home'],show:(el)=>ehNvIsHead(el)}
 ])
});
const EHNV_DEFAULT_BY_VIEW=Object.freeze({cupra:['auto','status'],charge:['auto','plan'],battery:['energy','battery'],balance:['energy','balance'],costs:['money','costs'],more:['more','sources']});
const EHNV_HOME_LINKS=Object.freeze([
 ['sun','sun','Zonnepanelen','Opwek en historie',''],
 ['home','home','Huisverbruik','Exclusief Cupra, historie',''],
 ['grid','grid','Net','Afname, teruglevering, historie',''],
 ['practice','home','Praktijkruimte','Live vermogen en maandkosten',''],
 ['overview','chart','Alle metingen','Alle tegels, grafiek en energiecoach',' data-eh-imm-all="1"']
]);

function ehNvSegment(tab,seg){return (EHNV_SEGMENTS[tab]||[]).find(s=>s.id===seg)||null;}
function ehNvWhere(card){
 const v=card._view||'overview';
 if(EHNV_HOME_VIEWS.includes(v)||!EHNV_DEFAULT_BY_VIEW[v])return {tab:'overview',seg:null};
 const cur=card._ehNvCur,s=cur&&ehNvSegment(cur.tab,cur.seg);
 if(s&&s.view===v)return cur;
 const d=EHNV_DEFAULT_BY_VIEW[v];
 return {tab:d[0],seg:d[1]};
}
function ehNvNavigation(where){
 return EHNV_TABS.map(t=>{
  const active=where.tab===t.id;
  const action=t.id==='overview'?'data-eh-page="overview"':'data-ehnv-tab="'+t.id+'"';
  return '<button type="button" class="navitem eh26-navitem'+(active?' active':'')+'" '+action+' aria-label="'+t.label+'" '+(active?'aria-current="page"':'')+'>'+ehIcon(t.icon)+'<span>'+t.label+'</span></button>';
 }).join('');
}
function ehNvSegmentBar(tab,seg){
 const list=EHNV_SEGMENTS[tab]||[];
 if(list.length<2)return '';
 const label=(EHNV_TABS.find(t=>t.id===tab)||{}).label||'';
 return '<div class="ehnv-seg" role="group" aria-label="Onderdelen van '+ehEsc(label)+'">'+list.map(s=>'<button type="button" data-ehnv-seg="'+tab+':'+s.id+'" aria-pressed="'+(s.id===seg)+'" class="'+(s.id===seg?'chosen':'')+'">'+ehEsc(s.label)+'</button>').join('')+'</div>';
}
function ehNvLinksHtml(){
 return '<section class="subsection ehnv-links"><div class="section-title">'+ehIcon('home')+' Home-details</div><p class="subtle">Dezelfde detailpagina\'s als vanuit de tegels op Home.</p><div class="ehnv-linklist">'+EHNV_HOME_LINKS.map(([page,icon,title,sub,extra])=>'<button type="button" data-eh-imm-menu="1" data-eh-page="'+page+'"'+extra+'>'+ehIcon(icon)+'<span><strong>'+ehEsc(title)+'</strong><small>'+ehEsc(sub)+'</small></span></button>').join('')+'</div></section>';
}
function ehNvCss(){
 return [
  '/* EHNV NAVIGATIE */',
  '[hidden]{display:none!important}',
  '.ehnv-seg{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;margin:2px 0 12px;padding:2px 1px 4px;-webkit-overflow-scrolling:touch}',
  '.ehnv-seg::-webkit-scrollbar{display:none}',
  '.ehnv-seg button{flex:none;appearance:none;border:1px solid #6d99b53d;background:#0b2132;color:#a9c5d6;border-radius:999px;padding:9px 14px;min-height:40px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
  '.ehnv-seg button.chosen{background:#0f4d45;border-color:#38e8a199;color:#eafff7}',
  '.ehnv-seg button:focus-visible{outline:2px solid #38e8a1;outline-offset:2px}',
  '.ehnv-linklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin-top:10px}',
  '.ehnv-linklist button{appearance:none;display:flex;align-items:center;gap:11px;text-align:left;border:1px solid #6d99b53d;background:#0b2132;color:inherit;border-radius:15px;padding:11px 13px;min-height:52px;font:inherit;cursor:pointer}',
  '.ehnv-linklist button svg{flex:none;width:22px;height:22px}',
  '.ehnv-linklist strong{display:block;font-size:13px}.ehnv-linklist small{display:block;color:#a9c5d6;font-size:11px}',
  '.ehnv-fold{border:1px solid #6d99b53d;border-radius:18px;background:#0a2234;padding:0;margin:0 0 12px}',
  '.ehnv-fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:9px;padding:14px 16px;font-weight:800;min-height:48px}',
  '.ehnv-fold>summary::-webkit-details-marker{display:none}',
  '.ehnv-fold>summary:after{content:"▾";margin-left:auto;color:#a9c5d6}.ehnv-fold[open]>summary:after{content:"▴"}',
  '.ehnv-fold>*:not(summary){margin:0;border:0;background:none;box-shadow:none;border-radius:0}',
  '@media(max-width:360px){.ehnv-seg button{padding:8px 11px;font-size:11px}}'
 ].join('\n');
}
(function ehNvInstall(){
 const P=EnergiehuisCard.prototype,previous=P._render;
 P._ehNvGo=function(tab,seg){
  const list=EHNV_SEGMENTS[tab];
  if(!list)return;
  const s=ehNvSegment(tab,seg)||ehNvSegment(tab,(this._ehNvSeg&&this._ehNvSeg[tab]))||list[0];
  this._ehNvSeg=Object.assign(this._ehNvSeg||{},{[tab]:s.id});
  this._ehNvCur={tab,seg:s.id};
  this._view=s.view;this._detail=null;
  if(s.view==='costs'){this._ehcmpInit?.();this._ehcmpLoad?.();}
  if(s.view==='balance')this._loadBalance?.();
  if(s.view==='cupra')this._loadCupraInsights?.();
  this._schedule();
  requestAnimationFrame(()=>{if(this.isConnected)this.scrollIntoView({behavior:'smooth',block:'start'});});
 };
 P._render=function(){
  previous.call(this);
  if(!this.config||!this._hass)return;
  const root=this.shadowRoot,nav=root?.querySelector?.('.shell > .nav');
  if(!nav)return;
  const style=root.querySelector('style');
  if(style&&!style.textContent.includes('/* EHNV NAVIGATIE */'))style.textContent+='\n'+ehNvCss();
  const where=ehNvWhere(this);
  nav.innerHTML=ehNvNavigation(where);
  if(!this._ehNvEvents){
   this._ehNvEvents=true;
   root.addEventListener('click',e=>{
    const tab=e.target?.closest?.('[data-ehnv-tab]');
    if(tab){e.preventDefault();const t=tab.dataset.ehnvTab;this._ehNvGo(t,this._ehNvSeg&&this._ehNvSeg[t]);return;}
    const seg=e.target?.closest?.('[data-ehnv-seg]');
    if(seg){e.preventDefault();const [t,s]=String(seg.dataset.ehnvSeg).split(':');this._ehNvGo(t,s);return;}
    // Terug naar Home: de eigen tabkeuze hoeft niet te blijven hangen.
    const home=e.target?.closest?.('[data-eh-page]');
    if(home&&home.dataset.ehPage==='overview')this._ehNvCur=null;
   });
  }
  if(where.tab==='overview'||this._ehNvOff)return;
  const main=root.querySelector('.shell main');
  if(!main||main.dataset.ehnv)return;
  main.dataset.ehnv='1';
  const s=ehNvSegment(where.tab,where.seg);
  if(!s)return;
  let shown=0;
  for(const el of [...main.children]){
   const keep=!!s.show(el,ehNvHeading(el));
   if(!keep)el.hidden=true;else shown++;
  }
  // Uitklappers: de sectie blijft ongewijzigd (klassen, knoppen, listeners) en wordt alleen in <details> gewikkeld.
  for(const [test,title] of (s.folds||[])){
   for(const el of [...main.children]){
    if(el.hidden||el.tagName==='DETAILS'||!test(el,ehNvHeading(el)))continue;
    const det=document.createElement('details');
    det.className='ehnv-fold';
    det.open=!!(this._ehNvFold&&this._ehNvFold[title]);
    det.addEventListener('toggle',()=>{this._ehNvFold=Object.assign(this._ehNvFold||{},{[title]:det.open});});
    const sum=document.createElement('summary');sum.textContent=title;
    el.replaceWith(det);det.append(sum,el);
    el.querySelector(':scope > .section-title')?.setAttribute('hidden','');
   }
  }
  if(s.title){
   const head=main.querySelector(':scope > .subpage-head h2');
   if(head){head.textContent=s.title[0];const p=head.parentElement?.querySelector('p');if(p)p.textContent=s.title[1];const ey=head.parentElement?.querySelector('.eyebrow');if(ey)ey.textContent='ENERGIEHUIS';}
  }
  if(s.links){const head=main.querySelector(':scope > .subpage-head');head?head.insertAdjacentHTML('afterend',ehNvLinksHtml()):main.insertAdjacentHTML('afterbegin',ehNvLinksHtml());}
  main.insertAdjacentHTML('afterbegin',ehNvSegmentBar(where.tab,where.seg));
  if(!s.links&&!shown)main.insertAdjacentHTML('beforeend','<p class="subtle">Voor dit onderdeel is nu niets om te tonen.</p>');
 };
})();
