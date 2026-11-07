/* Laadbediening: uitsluitend via door gebruiker gecontroleerde Home Assistant-scripts.
 * Veiligheidskritische controle blijft in HA/Alfen. Nooit direct een Alfen-register wijzigen. */
function eh20ControlStatus(h,c,action,now=Date.now()){
 if(c?.charge_control_enabled!==true)return {ready:false,reason:'Laadbediening staat uit (standaard). Activeer pas na controle van de HA-scripts.'};
 const start=String(c.charge_start_script||''),pause=String(c.charge_pause_script||'');
 if(!/^script\.[a-z0-9_]+$/.test(start)||!/^script\.[a-z0-9_]+$/.test(pause)||start===pause)
  return {ready:false,reason:'Koppel twee verschillende, gecontroleerde Home Assistant-scripts voor starten en pauzeren.'};
 const id=action==='pause'?pause:start;
 const st=h?.states?.[id];
 if(!st||st.state==='unavailable'||st.state==='unknown')
  return {ready:false,reason:'Home Assistant-script niet beschikbaar: '+id};
 if(!h?.callService||h?.connection?.connected===false||(typeof window!=='undefined'&&window.navigator?.onLine===false))
  return {ready:false,reason:'Geen bevestigde verbinding met Home Assistant.'};
 if(action==='start'){
  for(const key of ['net','laden']){
   const sensor=h?.states?.[c[key]];
   const updated=Date.parse(sensor?.last_updated||sensor?.last_changed||'');
   if(ehRead(h,c[key])===null||!Number.isFinite(updated)||now-updated>60*1000||updated>now+60000)
    return {ready:false,reason:'Start geblokkeerd: geen recente meting van '+(key==='net'?'P1':'Alfen')+'.'};
  }
 }
 return {ready:true,script:id,reason:''};
}
function eh20ControlHtml(card,h,c){
 if(card._view!=='charge')return '';
 const enabled=c.charge_control_enabled===true;
 const start=eh20ControlStatus(h,c,'start'),pause=eh20ControlStatus(h,c,'pause');
 const pending=card._eh20Pending;
 const msg=card._eh20Message?'<p class="subtle" role="status">'+ehEsc(card._eh20Message)+'</p>':'';
 const confirmed=pending?'<div class="eh20-confirm" role="alertdialog" aria-label="Laadopdracht bevestigen"><strong>'+(pending==='start'?'Nu starten':'Laden pauzeren')+'?</strong><p>Je vraagt Home Assistant een gekoppeld script uit te voeren. Dit is geen garantie dat de auto daadwerkelijk gaat laden of pauzeren. Alfen Active Load Balancing blijft leidend.</p><div class="eh20-actions"><button type="button" data-eh20-cancel="1">Annuleren</button><button type="button" data-eh20-confirm="'+pending+'" '+(card._eh20Busy?'disabled':'')+'>Opdracht versturen</button></div></div>':'';
 return '<section class="cupra-card eh20-control"><div class="section-title">'+ehIcon('shield')+' Laadbediening <span class="eh20-state">'+(enabled?(start.ready&&pause.ready?'Scriptbediening gereed':'Configuratie onvolledig'):'Nog niet geactiveerd')+'</span></div>'+
 '<p class="subtle">De knoppen hieronder sturen alleen geconfigureerde Home Assistant-scripts aan. De simulatieknoppen en het laadplan worden niet automatisch uitgevoerd.</p>'+
 '<div class="eh20-actions"><button type="button" data-eh20-action="start" '+(!start.ready||card._eh20Busy?'disabled':'')+'>Nu laden</button><button type="button" data-eh20-action="pause" '+(!pause.ready||card._eh20Busy?'disabled':'')+'>Pauzeren</button></div>'+
 (!start.ready?'<p class="subtle">Starten: '+ehEsc(start.reason)+'</p>':'')+
 (!pause.ready?'<p class="subtle">Pauzeren: '+ehEsc(pause.reason)+'</p>':'')+
 confirmed+msg+'<p class="subtle">Voor volledige automatisering zijn aparte HA-planningsautomatiseringen nodig. 1×40A en de laadlimieten worden NIET door deze frontend afgedwongen.</p></section>';
}
(function eh20Install(){
 const P=EnergiehuisCard.prototype,previousCupra=P._cupraHtml,previousRender=P._render;
 P._cupraHtml=function(h,c){
  const html=previousCupra.call(this,h,c);
  if(this._view!=='charge')return html;
  const content=c.charge_control_enabled===true?html
   .replace('Alleen simulatie','Scriptmodus ingeschakeld')
   .replace('Er worden geen laadcommando’s verstuurd.','De simulator verstuurt geen laadcommando’s. Alleen de afzonderlijk bevestigde HA-scripts kunnen een opdracht versturen.')
   .replace('Geen laadopdrachten worden verzonden.','Dit laadplan verzendt geen opdrachten.'):html;
  return content.replace(/(<main\b[^>]*>)/,'$1'+eh20ControlHtml(this,h,c));
 };
 P._eh20Send=async function(action){
  if(this._eh20Busy||this._eh20Pending!==action)return;
  const status=eh20ControlStatus(this._hass,this.config,action);
  this._eh20Pending=null;
  if(!status.ready){this._eh20Message=status.reason;this._schedule();return;}
  this._eh20Busy=true;this._eh20Message='Opdracht verwerken…';this._schedule();
  try{
   await this._hass.callService('script','turn_on',{entity_id:status.script});
   this._eh20Message='Opdracht aan Home Assistant verzonden. Controleer het Alfen-laadvermogen voor de werkelijke uitvoering.';
  }catch(err){this._eh20Message='Laadopdracht mislukt: '+String(err?.message||'onbekende fout');}
  finally{this._eh20Busy=false;this._schedule();}
 };
 P._render=function(){
  previousRender.call(this);
  const root=this.shadowRoot;
  if(!root||!this.config||!this._hass)return;
  if(!this._eh20Ready){
   this._eh20Ready=true;
   root.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-eh20-action],[data-eh20-cancel],[data-eh20-confirm]');
    if(!btn)return;
    if(btn.dataset.eh20Cancel){this._eh20Pending=null;this._schedule();return;}
    const action=btn.dataset.eh20Confirm||btn.dataset.eh20Action;
    if(action!=='start'&&action!=='pause')return;
    if(btn.dataset.eh20Confirm){this._eh20Send(action);return;}
    const status=eh20ControlStatus(this._hass,this.config,action);
    this._eh20Message=status.ready?'':status.reason;
    this._eh20Pending=status.ready?action:null;
    this._schedule();
   });
  }
  const style=root.querySelector?.('style');
  if(style&&!style.textContent.includes('.eh20-control{'))style.textContent+=
   '\n.eh20-control{border:1px solid #4cae9660}.eh20-state{font-size:10px;padding:4px 8px;border-radius:20px;border:1px solid #8fbbba60;color:#b6e9dc}.eh20-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.eh20-actions button{font:inherit;font-size:12px;font-weight:700;min-height:44px;padding:10px 15px;background:#124636;color:#e8fff6;border:1px solid #5ed8ab;border-radius:10px;cursor:pointer}.eh20-actions button:disabled{opacity:.4;cursor:not-allowed}.eh20-confirm{padding:14px;border:1px solid #edbb77;background:#3a2d1e;border-radius:12px;font-size:12px}.eh20-confirm p{line-height:1.5}';
 };
})();


