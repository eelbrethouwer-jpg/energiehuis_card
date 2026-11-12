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
 price:Object.freeze({view:'charge',detail:null}),
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
/* ===== Home-extra's: betrouwbare dagtotalen, laadsessie en kwartierprijzen (pure functies, testbaar zonder browser) =====
 * Alleen lezen. Geen aannames: ontbrekende of onvolledige data wordt als zodanig getoond (≥, "onvolledig", "niet beschikbaar"),
 * nooit als volledig gemeten feit. Lokale daggrens = lokale middernacht van het toestel (Europe/Amsterdam, DST-veilig: een dag duurt
 * 23, 24 of 25 uur; uren worden als echte tijdstippen geteld). */
const EH_IMM_HOUR=3600000,EH_IMM_COMPILE_LAG=10*60000,EH_IMM_IDLE_MAX=45*60000;
const ehImmUnitKwh=(n,unit)=>{const u=String(unit||'').trim().toLowerCase();return n===null||n===undefined?null:u==='kwh'?n:u==='wh'?n/1000:u==='mwh'?n*1000:null;};
/** Huidige stand van een cumulatieve teller als {kwh,t}, of null bij een onbekende eenheid, ontbrekende waarde of tijdstempel. */
function ehImmLiveCounter(h,id){
 const e=id&&h?.states?.[id];if(!e)return null;
 const kwh=ehImmUnitKwh(ehNum(e.state),e.attributes?.unit_of_measurement),t=Date.parse(e.last_updated||e.last_changed||'');
 return kwh===null||!Number.isFinite(t)?null:{kwh,t};
}
/** Uurraster van lokale middernacht tot nu. `full` = voltooide uren die al in de HA-statistieken horen te staan
 *  (einde ≥ 10 min geleden: HA compileert het vorige uur kort na het hele uur); de rest wordt met de live tellerstand gedekt. */
function ehImmDayPlan(now){
 const from=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),n=now.getTime();
 return {from,now:n,full:Math.max(0,Math.floor((n-from-EH_IMM_COMPILE_LAG)/EH_IMM_HOUR)),nextMidnight:new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()};
}
/** Dagtotaal (kWh) van een cumulatieve teller uit HA-uurstatistieken (`change`, `sum`, `state`) plus het live deel sinds het laatste
 *  voltooide uur. status: 'complete' (elk uur sinds middernacht aanwezig, geen reset of afwijking, live deel geldig),
 *  'partial' (ondergrens: er ontbreken uren, een reset of het live deel) of 'missing' (niets bruikbaars). */
function ehImmCounterDay(rows,plan,live){
 const H=EH_IMM_HOUR,by=new Map();
 for(const r of rows||[]){const t=ehStatTime(r.start);if(Number.isFinite(t))by.set(Math.floor(t/H)*H,r);}
 let sum=0,have=0,missing=0,bad=0,prevSum=null;
 const base=by.get(plan.from-H);if(base)prevSum=ehNum(base.sum);
 for(let i=0;i<plan.full;i++){
  const r=by.get(plan.from+i*H);
  if(!r){missing++;prevSum=null;continue;}
  let ch=ehNum(r.change);const s=ehNum(r.sum);
  if(ch===null&&s!==null&&prevSum!==null)ch=s-prevSum;
  prevSum=s;
  if(ch===null){missing++;continue;}
  if(ch<-0.00001||ch>50){bad++;continue;}   // tellerreset of onmogelijke uurwaarde: niet meetellen en niet als volledig tonen
  sum+=Math.max(0,ch);have++;
 }
 const anchorRow=plan.full===0?base:by.get(plan.from+(plan.full-1)*H),anchor=anchorRow?ehNum(anchorRow.state):null;
 const anchorEnd=plan.from+plan.full*H;
 let liveKwh=null;
 if(live&&anchor!==null&&plan.now-live.t<=30*60000){
  const d=live.kwh-anchor,limit=Math.max(0,(plan.now-anchorEnd)/H)*30+0.5;
  if(d>=-0.000001&&d<=limit)liveKwh=Math.max(0,d);
 }
 const total=sum+(liveKwh||0);
 const status=missing===0&&bad===0&&liveKwh!==null?'complete':(have>0||liveKwh!==null)?'partial':'missing';
 return {kwh:status==='missing'?null:total,status,hours:plan.full,have,missing,bad,live:liveKwh!==null};
}
/** Dagopbrengst rechtstreeks uit de dagsensor van de omvormer: alleen kWh/Wh, ≥ 0 en vandaag bijgewerkt. */
function ehImmPvSensorDay(h,c,now){
 const e=c.zonne_energie&&h?.states?.[c.zonne_energie];if(!e)return null;
 const v=ehImmUnitKwh(ehNum(e.state),e.attributes?.unit_of_measurement),t=Date.parse(e.last_updated||e.last_changed||'');
 if(v===null||v<0||!Number.isFinite(t)||ehDayKey(new Date(t))!==ehDayKey(now))return null;
 return {kwh:v,status:'complete',sensor:true};
}
/** Alle dagtotalen in één keer (één gedeelde gegevensaanvraag). Huis = bestaande definitie: eigen kWh-teller, anders
 *  afname − teruglevering + opwek − laden, alleen als alle vier volledig zijn. */
function ehImmDayMetrics(c,h,rowsById,now){
 const plan=ehImmDayPlan(now),ctr=id=>id?ehImmCounterDay(rowsById?.[id]||[],plan,ehImmLiveCounter(h,id)):{kwh:null,status:'missing'};
 const imp=ctr(c.import),exp=ctr(c.export),ev=ctr(c.laad_energie),pv=ehImmPvSensorDay(h,c,now)||ctr(c.zonne_energie);
 let home;
 if(c.huis_energie)home={...ctr(c.huis_energie),direct:true};
 else if([imp,exp,pv,ev].every(x=>x.status==='complete')){
  const v=imp.kwh-exp.kwh+pv.kwh-ev.kwh;
  home=v<-0.3?{kwh:null,status:'incomplete',why:'inconsistent'}:{kwh:Math.max(0,v),status:'complete',derived:true};
 }else home={kwh:null,status:[imp,exp,pv,ev].some(x=>x.status!=='missing')?'incomplete':'missing',why:'onvolledige bronnen'};
 return {plan,imp,exp,ev,pv,home};
}
/** Kosten van vandaag uit de bestaande Zonneplan-kostensensor: alleen een bedrag in euro dat vandaag is bijgewerkt. */
function ehImmCostToday(h,c,now){
 const e=c.cost_zonneplan_day&&h?.states?.[c.cost_zonneplan_day];if(!e)return null;
 const n=ehNum(e.state),u=String(e.attributes?.unit_of_measurement||'').trim().toLowerCase(),t=Date.parse(e.last_updated||e.last_changed||'');
 if(n===null||!['','€','eur'].includes(u)||!Number.isFinite(t)||ehDayKey(new Date(t))!==ehDayKey(now))return null;
 return n;
}
/** Huidige laadsessie uit de Alfen-teller (kWh): het aaneengesloten laadblok waarin pauzes ≤ 45 min nog bij dezelfde sessie horen.
 *  points = geschiedenis van de teller [{t,v,unit}], live = {kwh,t}. Geeft {ok:true,kwh,start} of {ok:false,reason}; een
 *  onzekere sessiestart (meetgat, reset, geschiedenis begint midden in de sessie) is nooit een geschatte waarde. */
function ehImmCurrentSession(points,live,nowMs){
 const no=reason=>({ok:false,reason});
 if(!live||nowMs-live.t>10*60000)return no('verouderd');
 const pts=[];
 for(const p of points||[]){const k=ehImmUnitKwh(p.v,p.unit);if(k===null||!Number.isFinite(p.t))return no('eenheid');pts.push({t:p.t,k});}
 pts.sort((a,b)=>a.t-b.t);
 if(pts.length<2)return no('geen historie');
 if(live.t>pts[pts.length-1].t)pts.push({t:live.t,k:live.kwh});
 let cur=null,breakT=null;
 for(let i=1;i<pts.length;i++){
  const prev=pts[i-1],next=pts[i],dt=next.t-prev.t;if(dt<=0)continue;
  const d=next.k-prev.k;
  if(d<-0.01){cur=null;breakT=next.t;continue;}                      // tellerreset of bronwissel
  if(d<=0.001)continue;                                              // pauze of stilstand
  // Bij change-only historie ontbreken vlakke punten tijdens stilstand. Een stijging na >45 min kan dus
  // een nieuwe sessie verbergen; zonder gemeten startstand geen bevestigd totaal, ook bij plausibel vermogen.
  if(d>dt/EH_IMM_HOUR*12+0.1||dt>EH_IMM_IDLE_MAX){cur=null;breakT=next.t;continue;}   // onzekere sessiegrens of onmogelijke sprong
  if(!cur||prev.t-cur.last>EH_IMM_IDLE_MAX){
   cur={start:prev.t,startK:prev.k,last:next.t,uncertain:breakT!==null&&prev.t-breakT<=EH_IMM_IDLE_MAX,first:i===1};
  }
  cur.last=next.t;
 }
 if(!cur)return no('geen sessie');
 if(nowMs-cur.last>EH_IMM_IDLE_MAX)return no('geen actieve sessie');
 if(cur.uncertain)return no('onderbroken meting');
 if(cur.first)return no('sessiestart buiten bereik');
 const kwh=live.kwh-cur.startK;
 if(!(kwh>=0&&kwh<=150))return no('inconsistent');
 return {ok:true,kwh,start:cur.start};
}
/** Kwartieren van vandaag op echte tijdstippen (92/96/100 per dag, bij zomer-/wintertijd). */
function ehImmQuarterModel(quarters,now){
 const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),dayEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();
 const slots=Math.round((dayEnd-dayStart)/900000),by=new Map();
 for(const q of quarters||[]){
  const t=Date.parse(q.t),p=Number(q.p);
  if(!Number.isFinite(t)||!Number.isFinite(p)||t<dayStart||t>=dayEnd)continue;
  const i=Math.floor((t-dayStart)/900000);by.set(i,{i,t,p});
 }
 const items=[...by.values()].sort((a,b)=>a.i-b.i),nowIdx=Math.floor((now.getTime()-dayStart)/900000),cur=by.get(nowIdx)||null;
 const ps=items.map(x=>x.p);
 return {dayStart,dayEnd,slots,items,nowIdx,cur,known:items.length,min:ps.length?Math.min(...ps):null,max:ps.length?Math.max(...ps):null};
}
/** SVG-staafjes met nulbasislijn (negatieve prijzen hangen eronder); geen interpolatie voor ontbrekende kwartieren. */
function ehImmQuarterBars(model){
 const {slots,items,nowIdx,min,max}=model,top=Math.max(0,max),bot=Math.min(0,min),range=Math.max(0.001,top-bot),H=22,y0=1+top/range*H;
 const span=Math.max(0.0001,max-min);
 let out=bot<0?'<line class="zero" x1="0" x2="'+slots+'" y1="'+y0.toFixed(2)+'" y2="'+y0.toFixed(2)+'"/>':'';
 if(nowIdx>=0&&nowIdx<slots)out+='<line class="nowline" x1="'+(nowIdx+.5)+'" x2="'+(nowIdx+.5)+'" y1="0" y2="24"/>';
 for(const it of items){
  const hh=Math.max(0.8,Math.abs(it.p)/range*H),y=it.p>=0?y0-hh:y0;
  const cls=it.i===nowIdx?'now':(it.p-min)<=span*.25?'cheap':it.i<nowIdx?'past':'';
  out+='<rect class="'+cls+'" x="'+(it.i+.08).toFixed(2)+'" y="'+y.toFixed(2)+'" width=".84" height="'+hh.toFixed(2)+'"/>';
 }
 return out;
}
function ehImmHash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16);}
const ehImmKwhTxt=n=>ehFmt(n,Math.abs(n)>=100?0:Math.abs(n)>=10?1:2);
/** Tekstregels per vakje, afhankelijk van de breedte van de scène (px): full ≥ 800, mid ≥ 560, small ≥ 330, tiny daaronder.
 *  Altijd ≥ 9 px in de CSS; op kleine schermen blijven de belangrijkste gegevens (korte vorm) staan in plaats van te verdwijnen.
 *  Geeft {lines, aria}: aria bevat altijd de volledige zin. */
function ehImmDayLines(key,d,extra,sw){
 const form=sw>=800?'full':sw>=560?'mid':sw>=330?'small':'tiny',L=[],A=[];
 const num=x=>ehImmKwhTxt(x.kwh);
 // Eén totaal: status ⇒ tekst. complete: "Vandaag: x kWh"; partial: ondergrens "≥"; incomplete: "onvolledig"; missing: niets.
 const one=(x,lab,what)=>{
  if(!x||x.status==='missing')return null;
  const ar=what+': '+(x.status==='complete'?num(x)+' kWh':x.status==='partial'?'gedeeltelijk gemeten, minstens '+num(x)+' kWh':'onvolledig, bronnen niet volledig beschikbaar')+'.';
  let t;
  if(x.status==='complete')t=form==='tiny'?num(x)+' kWh':lab[form]+' '+num(x)+' kWh';
  else if(x.status==='partial')t=form==='tiny'?'≥ '+num(x)+' kWh':lab[form]+' ≥ '+num(x)+' kWh'+(form==='full'?' (deels)':'');
  else t=form==='tiny'?'onvolledig':lab[form]+' onvolledig';
  return {t,ar};
 };
 const day={full:'Vandaag:',mid:'Vandaag:',small:'Dag'};
 if(key==='pv'||key==='house'){
  const r=one(d[key==='pv'?'pv':'home'],day,key==='pv'?'Zonnepanelen vandaag opgewekt':'Huis vandaag verbruikt (exclusief Cupra)');
  if(r){L.push(r.t);A.push(r.ar);}
 }else if(key==='cupra'){
  const r=one(d.ev,day,'Cupra vandaag geladen (Alfen)');
  const s=extra.session;   // {state:'ok'|'unavailable'|'loading'|'idle', kwh}
  let st=null,sa=null;
  if(s&&s.state==='ok'){st=(form==='tiny'?'':(form==='small'?'Sessie ':'Sessie: '))+ehImmKwhTxt(s.kwh)+' kWh';sa='Huidige laadsessie: '+ehImmKwhTxt(s.kwh)+' kWh.';}
  else if(s&&s.state==='unavailable'){st=form==='small'?'Sessie n.b.':form==='tiny'?null:'Sessie: niet beschikbaar';sa='Huidige laadsessie: niet beschikbaar, de sessiestart kan niet betrouwbaar worden vastgesteld.';}
  if(form==='small'||form==='tiny'){          // klein scherm: de sessie heeft voorrang, anders het dagtotaal
   if(st&&s.state==='ok'){L.push(st);A.push(sa);if(r)A.push(r.ar);}
   else{if(r){L.push(r.t);A.push(r.ar);}if(sa)A.push(sa);if(st)L.push(st);}
  }else{if(r){L.push(r.t);A.push(r.ar);}if(st){L.push(st);A.push(sa);}}
 }else if(key==='net'){
  const imp=d.imp,exp=d.exp,cost=extra.cost,mark=x=>x.status==='partial'?'≥ ':'';
  const ok=x=>x&&x.status!=='missing'&&x.kwh!==null;
  const costT=cost===null||cost===undefined?null:(cost<0?'−':'')+'€ '+ehFmt(Math.abs(cost),2);
  if(ok(imp))A.push('Afname vandaag: '+(imp.status==='partial'?'gedeeltelijk gemeten, minstens ':'')+num(imp)+' kWh.');
  if(ok(exp))A.push('Teruggeleverd vandaag: '+(exp.status==='partial'?'gedeeltelijk gemeten, minstens ':'')+num(exp)+' kWh.');
  if(costT)A.push('Kosten vandaag: '+costT+'.');
  if(form==='full'){
   if(ok(imp))L.push('Afname: '+mark(imp)+num(imp)+' kWh');
   if(ok(exp))L.push('Teruggeleverd: '+mark(exp)+num(exp)+' kWh');
   if(costT)L.push('Kosten: '+costT);
  }else if(form==='mid'){
   if(ok(imp)&&ok(exp))L.push('Af '+mark(imp)+num(imp)+' · Terug '+mark(exp)+num(exp)+' kWh');
   else if(ok(imp))L.push('Afname: '+mark(imp)+num(imp)+' kWh');else if(ok(exp))L.push('Terug: '+mark(exp)+num(exp)+' kWh');
   if(costT)L.push('Kosten: '+costT);
  }else if(form==='small'){
   const p=[];if(ok(imp))p.push('Af '+mark(imp)+num(imp));if(costT)p.push(costT);
   if(p.length)L.push(p.join(' · '));
  }else if(ok(imp))L.push(mark(imp)+num(imp)+' kWh');else if(costT)L.push(costT);
 }
 return {lines:L,aria:A};
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
 // ===== Home-extra's: gegevens laden (alleen lezen) =====
 // Dagtotalen: één gedeelde, gecachete recorder-statistiekvraag (uurperiode, vandaag) voor alle vakjes; per 5 minuten hooguit één
 // (2 minuten na een mislukking). De laadsessie komt uit de Alfen-tellerhistorie en wordt alleen tijdens het laden ververst (150 s).
 // Geen servicecalls, geen opslag, geen schrijfacties.
 const DAY_TTL_MS=5*60*1000,DAY_RETRY_MS=2*60*1000,SESSION_TTL_MS=150*1000;
 P._ehImmRefresh=function(){
  const ctl=this._ehLive?.ctl;
  if(ctl&&!ctl.debug.suspended&&ehImmOn(this)&&this._view==='overview'&&!this._ehImmAll){ctl.cockpit.rerender();this._ehImmPrice();}
 };
 P._ehImmLoadDay=async function(){
  const c=this.config,h=this._hass,st=this._ehImmDay||(this._ehImmDay={at:0,key:'',rows:null,error:false,loading:false});
  if(!h||typeof h.callWS!=='function'||!c||st.loading)return;
  const now=new Date(),key=ehDayKey(now);
  if(st.key===key&&Date.now()-st.at<(st.error?DAY_RETRY_MS:DAY_TTL_MS))return;
  st.loading=true;st.at=Date.now();
  try{
   const plan=ehImmDayPlan(now),ids=[...new Set([c.import,c.export,c.laad_energie,c.zonne_energie,c.huis_energie].filter(Boolean))];
   if(ids.length){
    const stats=await h.callWS({type:'recorder/statistics_during_period',start_time:new Date(plan.from-EH_IMM_HOUR).toISOString(),end_time:now.toISOString(),statistic_ids:ids,period:'hour',types:['change','sum','state'],units:{energy:'kWh'}});
    st.rows=stats&&typeof stats==='object'?stats:{};
   }else st.rows={};
   st.error=false;
  }catch(_){st.rows=null;st.error=true;}
  finally{st.loading=false;st.key=key;st.ver=(st.ver||0)+1;}
  this._ehImmRefresh();
 };
 /** Alle dagtotalen (per minuut en per wijziging van de bronnen gememoriseerd). */
 P._ehImmMetrics=function(){
  const st=this._ehImmDay,c=this.config,h=this._hass,now=new Date();
  const rows=st&&st.rows&&st.key===ehDayKey(now)?st.rows:{};
  const src=[c.import,c.export,c.laad_energie,c.zonne_energie,c.huis_energie].filter(Boolean).map(id=>(h?.states?.[id]?.state)+'@'+(h?.states?.[id]?.last_updated)).join('|');
  const key=(st?st.ver||0:0)+'|'+Math.floor(now.getTime()/60000)+'|'+src;
  if(this._ehImmMemo&&this._ehImmMemo.key===key)return this._ehImmMemo.v;
  const v=ehImmDayMetrics(c,h,rows,now);this._ehImmMemo={key,v};return v;
 };
 P._ehImmLoadSession=async function(){
  const c=this.config,h=this._hass,ss=this._ehImmSess;
  if(!ss||ss.loading||!h||typeof h.callWS!=='function'||!c?.laad_energie)return;
  if(ss.at&&Date.now()-ss.at<SESSION_TTL_MS)return;
  ss.loading=true;ss.at=Date.now();
  try{
   const now=Date.now();
   const data=await h.callWS({type:'history/history_during_period',start_time:new Date(now-36*EH_IMM_HOUR).toISOString(),end_time:new Date(now).toISOString(),entity_ids:[c.laad_energie],minimal_response:true,no_attributes:false,significant_changes_only:false});
   ss.points=ehNumericHistory(data,c.laad_energie,h);ss.error=false;
  }catch(_){ss.points=null;ss.error=true;}
  finally{ss.loading=false;}
  this._ehImmRefresh();
 };
 /** Huidige sessie: alleen tijdens het laden; onzeker ⇒ "niet beschikbaar", nooit een schatting. */
 P._ehImmSession=function(m){
  const c=this.config,h=this._hass,ss=this._ehImmSess||(this._ehImmSess={at:0,loading:false,points:null,error:false,was:false});
  if(!m?.tiles?.cupra?.charging){ss.was=false;return {state:'idle'};}
  if(!ss.was){ss.was=true;ss.at=0;ss.points=null;ss.error=false;}        // nieuwe laadperiode: historie opnieuw ophalen
  if(ss.error&&Date.now()-ss.at>DAY_RETRY_MS){ss.error=false;ss.at=0;}
  this._ehImmLoadSession();
  if(ss.error)return {state:'unavailable',reason:'historie'};
  if(!ss.points)return {state:'loading'};
  const r=ehImmCurrentSession(ss.points,ehImmLiveCounter(h,c.laad_energie),Date.now());
  return r.ok?{state:'ok',kwh:r.kwh}:{state:'unavailable',reason:r.reason};
 };
 /** Tekstregels onder de livewaarde van een vakje; breedte van de scène bepaalt de vorm (zie ehImmDayLines). */
 P._ehImmTileDay=function(key,m,sw){
  const c=this.config,h=this._hass,now=new Date();
  if(!c||!m||!m.connected||!['pv','house','cupra','net'].includes(key))return null;
  return ehImmDayLines(key,this._ehImmMetrics(),{cost:key==='net'?ehImmCostToday(h,c,now):null,session:key==='cupra'?this._ehImmSession(m):null},sw||0);
 };
 /** Kwartierprijs-knop (Zonneplan, bestaande prijssensoren; echte tijdstempels, 92/96/100 kwartieren; opent Slim laden). */
 P._ehImmPrice=function(){
  const ctl=this._ehLive?.ctl;if(!ctl||ctl.debug.suspended)return;
  const tiles=ctl.cockpit.el.querySelector('.ehm-tiles');if(!tiles)return;
  const doc=tiles.ownerDocument;
  let el=tiles.querySelector(':scope > .eh-price');
  if(!el){
   el=doc.createElement('button');el.type='button';el.className='eh-price';
   el.addEventListener('click',()=>this._ehImmNavigate('price'));      // één listener per element; het element leeft zolang de cockpit
   tiles.appendChild(el);
  }
  const now=new Date(),c=this.config,h=this._hass;
  let info=null;try{info=ehPricesForDay(h,c,now);}catch(_){}
  const model=ehImmQuarterModel(info?.quarters||[],now),cur=model.cur;
  let state='none',label='Kwartierprijs',nowTxt='geen data',at='',aria='Kwartierprijs: geen kwartierdata beschikbaar.',bars='';
  const eur=p=>(p<0?'−':'')+'€ '+ehFmt(Math.abs(p),3);
  if(model.known>=8){
   state='quarter';bars=ehImmQuarterBars(model);
   const range='Vandaag laagste '+eur(model.min)+', hoogste '+eur(model.max)+' per kWh ('+model.known+' van '+model.slots+' kwartieren bekend).';
   if(cur){nowTxt=eur(cur.p);at=ehClock(cur.t);aria='Kwartierprijs: nu '+eur(cur.p)+' per kWh (kwartier '+ehClock(cur.t)+' tot '+ehClock(cur.t+900000)+'). '+range;}
   else{nowTxt='nu onbekend';aria='Kwartierprijs: het huidige kwartier is niet beschikbaar. '+range;}
  }else if(info&&Number.isFinite(info.currentHour)){
   state='hour';label='Uurprijs';nowTxt=eur(info.currentHour);aria='Uurprijs: nu '+eur(info.currentHour)+' per kWh. Geen kwartierdata beschikbaar.';
  }
  // Handtekening over de ECHTE prijsdata (niet over de tekenlengte): elke gewijzigde prijs of tijdstip rendert opnieuw.
  const sig=ehImmHash(state+'|'+nowTxt+'|'+at+'|'+model.slots+'|'+model.nowIdx+'|'+model.items.map(x=>x.i+':'+Math.round(x.p*10000)).join(','));
  if(el.dataset.sig===sig)return;
  el.dataset.sig=sig;el.dataset.state=state;el.dataset.slots=String(model.slots);
  el.setAttribute('aria-label',aria+' Tik voor het prijsoverzicht.');
  const top=doc.createElement('span');top.className='eh-price-top';
  for(const [cls,txt,tag] of [['eh-price-label',label,'span'],['eh-price-now',nowTxt,'strong'],['eh-price-at',at,'span']]){if(!txt)continue;const n=doc.createElement(tag);n.className=cls;n.textContent=txt;top.appendChild(n);}
  el.replaceChildren(top);
  if(bars){const t=doc.createElement('template');t.innerHTML='<svg class="eh-price-bars" viewBox="0 0 '+model.slots+' 24" preserveAspectRatio="none" aria-hidden="true">'+bars+'</svg>';el.appendChild(t.content);}
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
  // Dagregels bijwerken als een niet door de cockpit bewaakte bron (dagsensor, kosten, sessie, dagtotalen) is gewijzigd.
  const ctl=this._ehLive?.ctl,m=ctl&&!ctl.debug.suspended?ctl.cockpit.model:null;
  if(m){
   const stage=ctl.cockpit.el.querySelector('.ehm-stage'),sw=stage?stage.getBoundingClientRect().width:0;
   const sig=['pv','house','cupra','net'].map(k=>{const r=this._ehImmTileDay(k,m,sw);return r?r.lines.join('|')+'~'+r.aria.join('|'):'';}).join('#')+'#'+this._ehImmPillExtra(m);
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
   const tile=this._ehLive?.ctl?.cockpit?.el?.querySelector(this._ehImmFrom==='price'?'.eh-price':'.tile[data-key="'+this._ehImmFrom+'"]');
   if(tile)tile.focus({preventScroll:true});
  }
 };
})();
