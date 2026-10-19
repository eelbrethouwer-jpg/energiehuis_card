/* Energiehuis v1.0 — read-only Lovelace custom card. Geen API-tokens of laadcommando's. */
const DEFAULTS = {
  net: 'sensor.p1_meter_vermogen',
  zonnepanelen: 'sensor.goodwe_pv_power',
  laden: 'sensor.alfen_actief_vermogen_totaal',
  stroom: 'sensor.alfen_stroom_l1',
  prijs: 'sensor.zonneplan_current_hourly_electricity_tariff',
  huis: 'sensor.energiehuis_huisverbruik_exclusief_auto',
  import: 'sensor.p1_meter_energie_import',
  export: 'sensor.p1_meter_energie_export',
  cupra: ''
};
const fmt = (n,d=1) => Number(n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const safe = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = s => {const n=Number(String(s).replace(',','.'));return Number.isFinite(n)?n:null};
const read = (h,id) => id && h?.states?.[id] ? num(h.states[id].state) : null;
const pwr = w => w===null?'—':(Math.abs(w)>=1000?fmt(w/1000,2)+' kW':fmt(w,0)+' W');
const money = p => p===null?'—':'€ '+fmt(p,3)+'/kWh';
function priceFrom(e){
  let p=e?.price_tax_included??e?.price_incl_tax??e?.price??e?.tariff??e?.value??e;
  if(p && typeof p==='object') p=p.amount??p.value;
  const n=num(p);return n===null?null:Math.abs(n)>10?n/10000000:n;
}
function getPrices(h,id){
  const a=h?.states?.[id]?.attributes??{}; let data=a.forecast??a.prices??[];
  if(!Array.isArray(data)) return [];
  return data.map((e,i)=>({
    t:e?.start_date??e?.start??e?.datetime??e?.time??null,
    p:priceFrom(e), i
  })).filter(v=>v.p!==null&&v.p>-5&&v.p<5).slice(0,48);
}
function miniBars(values){
  if(!values.length) return `<div class="empty">Geen bruikbare uurforecast gevonden. De actuele prijs blijft zichtbaar.</div>`;
  const lo=Math.min(...values.map(x=>x.p),0),hi=Math.max(...values.map(x=>x.p));
  const span=Math.max(.01,hi-lo);
  const best=Math.min(...values.map(x=>x.p));
  const bars=values.map((x,i)=>{
    const height=Math.max(7,Math.min(100,Math.round((x.p-lo)/span*88)+8));
    const good=x.p===best; const title=x.t?new Date(x.t).toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Uur '+(i+1);
    return `<div class="barwrap" title="${safe(title)}: € ${fmt(x.p,3)}/kWh"><div class="bar ${good?'best':''}" style="height:${height}%"></div></div>`;
  }).join('');
  return `<div class="bars">${bars}</div><div class="barlegend"><span>Eerste uur</span><span><b class="swatch"></b> Goedkoopste uur: € ${fmt(best,3)}/kWh</span><span>Laatste uur</span></div>`;
}
class EnergiehuisCard extends HTMLElement {
  setConfig(config){this.config={...DEFAULTS,...config};this.attachIfNeeded();this.render();}
  attachIfNeeded(){if(!this.shadowRoot)this.attachShadow({mode:'open'});}
  set hass(hass){this._hass=hass;this.attachIfNeeded();this.render();}
  getCardSize(){return 8}
  static getStubConfig(){return {type:'custom:energiehuis-card'}}
  render(){
    if(!this.shadowRoot||!this.config)return;
    const h=this._hass,c=this.config;
    const net=read(h,c.net),sun=read(h,c.zonnepanelen),charging=read(h,c.laden),amps=read(h,c.stroom),price=read(h,c.prijs),house=read(h,c.huis);
    const imp=read(h,c.import),exp=read(h,c.export),soc=read(h,c.cupra);
    const stateNet=net===null?'Netvermogen niet beschikbaar':net>50?'Afname van het net':net< -50?'Teruglevering aan het net':'Bijna in balans';
    const missing=Object.entries({net:c.net,zonnepanelen:c.zonnepanelen,laden:c.laden,prijs:c.prijs}).filter(([k,v])=>read(h,v)===null).map(([k])=>k);
    const prices=getPrices(h,c.prijs);
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;color:var(--primary-text-color,#e9eef8);font-family:inherit}
      *{box-sizing:border-box} .shell{background:linear-gradient(145deg,#09192d,#142b46);color:#eef6ff;border-radius:21px;padding:24px;box-shadow:0 10px 35px #06142620;overflow:hidden}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:19px}
      h2{font-size:25px;letter-spacing:-.8px;margin:0}.sub{font-size:12px;color:#a8c5db;margin-top:5px}.tag{border:1px solid #32546a;background:#173448;border-radius:40px;padding:7px 11px;color:#a8e5da;font-size:11px;font-weight:700}
      .tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .tile{min-height:123px;background:#ffffff0b;border:1px solid #ffffff1b;border-radius:15px;padding:16px}
      .tile .name{color:#bad1e0;font-size:12px}.value{font-size:25px;line-height:1.3;font-weight:800;margin-top:17px;letter-spacing:-1px}.unit{font-size:11px;color:#93bed0;margin-top:2px}
      .green{color:#83edbd}.yellow{color:#ffd588}.sky{color:#93d3ff}
      .lower{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(200px,1fr);gap:12px;margin-top:12px}
      .panel{background:#ffffff09;border:1px solid #ffffff1a;padding:16px;border-radius:15px}.panel h3{font-size:13px;margin:0 0 14px;color:#deedfb}
      .bars{height:124px;display:flex;align-items:flex-end;gap:3px;border-bottom:1px solid #7895a15e;padding:8px 0 0}.barwrap{height:100%;display:flex;flex:1;align-items:flex-end;min-width:2px}.bar{width:100%;border-radius:3px 3px 0 0;background:#5c8dc2;min-height:3px}.bar.best{background:#61e0a0}
      .barlegend{display:flex;justify-content:space-between;gap:5px;color:#a9c3d8;font-size:10px;margin-top:8px;flex-wrap:wrap}.swatch{display:inline-block;background:#61e0a0;width:9px;height:9px;border-radius:2px}
      .summary{font-size:13px;line-height:1.85;color:#cfdeeb}.summary strong{color:#fff}.small{font-size:10px;color:#99b2c6;margin-top:10px}.empty{font-size:12px;color:#b0c7d7;padding:28px 0}
      .notice{border-left:3px solid #e9c36c;background:#ffffff0b;padding:10px 12px;font-size:11px;line-height:1.5;margin-top:14px;border-radius:4px;color:#e3dbbf}
      @media(max-width:700px){.shell{padding:15px;border-radius:13px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.value{font-size:21px}.lower{grid-template-columns:1fr}h2{font-size:22px}.tile{min-height:108px;padding:12px}}
    </style>
    <article class="shell">
      <header><div><h2>ENERGIEHUIS <span class="green">v1</span></h2><div class="sub">Jouw energiestromen — rechtstreeks uit Home Assistant</div></div><div class="tag">● Alleen uitlezen</div></header>
      <div class="tiles">
        <section class="tile"><div class="name">Netvermogen</div><div class="value sky">${safe(pwr(net))}</div><div class="unit">${safe(stateNet)}</div></section>
        <section class="tile"><div class="name">Zonnepanelen</div><div class="value green">${safe(pwr(sun))}</div><div class="unit">Huidige PV-opwek</div></section>
        <section class="tile"><div class="name">Auto laden</div><div class="value">${safe(pwr(charging))}</div><div class="unit">${amps===null?'Laadstroom onbekend':fmt(amps,1)+' A op L1'}</div></section>
        <section class="tile"><div class="name">Stroomprijs</div><div class="value yellow">${safe(money(price))}</div><div class="unit">Actuele Zonneplan-sensor</div></section>
      </div>
      <div class="lower">
        <div class="panel"><h3>Zonneplan — komende uren</h3>${miniBars(prices)}<p class="small">Grafiek volgt de forecast van je HA-sensor. Controleer eenheid, tijdzone en belastingcomponenten in de integratie.</p></div>
        <div class="panel"><h3>Overzicht & controle</h3><div class="summary">Huis excl. auto: <strong>${safe(pwr(house))}</strong><br>Net importmeter: <strong>${imp===null?'—':fmt(imp,2)}</strong><br>Net exportmeter: <strong>${exp===null?'—':fmt(exp,2)}</strong>${c.cupra?`<br>Cupra-statuswaarde: <strong>${soc===null?'—':safe(fmt(soc,0))}</strong>`:''}</div><div class="small">Meterstanden tonen bronwaarden; eenheid volgens HA-sensor.</div></div>
      </div>
      ${missing.length?`<p class="notice">Niet beschikbaar: ${safe(missing.join(', '))}. Controleer de entiteitsnamen in de kaartconfiguratie. Onbekende waarden worden niet als nul getoond.</p>`:''}
      <div class="small">Energiehuis v1.0 • read-only • geen laadcommando's • Alfen Active Load Balancing blijft leidend</div>
    </article>`;
  }
}
if(!customElements.get('energiehuis-card'))customElements.define('energiehuis-card',EnergiehuisCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(e=>e.type==='energiehuis-card'))window.customCards.push({type:'energiehuis-card',name:'Energiehuis v1',description:'Read-only dashboard voor zonnepanelen, net, Alfen en Zonneplan'});
