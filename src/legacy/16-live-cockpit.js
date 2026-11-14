/* v1.27 Live Cockpit als Home (integratie van de goedgekeurde PVE-04/HA-01-preview, branch
 * preview/claude-premium-pve04 @ be0b2999571c479ebf8bde3180c675319e609eea). Alleen-lezen; standaard UIT
 * (config `live_cockpit: true`). Bevat de ongewijzigde modules model.js, master-scene.js, master.js,
 * ha/contract.js en ha/adapter.js (alleen `globalThis` → lokale `scope`, zodat er GEEN nieuwe globals ontstaan),
 * met twee gedocumenteerde integratiefixes in master.js (LIVE-alt-tekst; composedPath voor klikken buiten het
 * detailpaneel in een shadow root). Geen DEMO-fixtures worden gebruikt: de kaart draait uitsluitend in LIVE-modus.
 * Deze fragmentvolgorde ligt vóór 16-regisseur-cockpit.js; die slaat zijn cockpit over als de Live Cockpit actief is.
 */
const EhLiveCockpit=(function(){
 'use strict';
 const scope={};
 (function(module,require){
 /* ---- model.js (preview/pve-04/model.js @ be0b299, sha256 aabf9c06ea7130727a30d04ac8349a41fb9f9db68d87c8016f7eb4f9cfc25565) ---- */
/* Energiehuis PVE-04 · model.js — pure, testbare cockpitlogica voor DEMO én LIVE (HA-01).
 *
 * De regels (eenheden, tekenrichting, versheid, integriteit, routes) gelden voor beide modi. De fictieve meetwaarden
 * (SCENARIOS/fixtures) zijn uitsluitend voor DEMO. LIVE-invoer komt van ha/adapter.js (input.live = true, input.specs
 * per bron) en bevat nooit fixtures. Er is GEEN Home Assistant-aanroep in dit bestand: geen callService, geen callWS,
 * geen fetch, geen opslag.
 *
 * Gebaseerd op de leeslogica van de Claude F2-referentie (reference/claude-f2-standalone.html),
 * met één bewuste afwijking: F2 hield een route na een ongeldige update nog tot 10 s `active`
 * (graceMs). Hier wordt een route bij een ontbrekende, verouderde of ongeldige waarde
 * ONMIDDELLIJK inactief. Alleen de weergave mag passief uitfaden (zie flows.js).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhPve04Model = api;
})(scope, function () {
  'use strict';

  const T = Object.freeze({
    zeroW: 30,          // |P| < 30 W telt als 0 W
    routeMinW: 30,      // een route vraagt minstens 30 W
    dirEnterW: 80,      // netrichting wisselt pas boven 80 W (dode band, geen tijdsvertraging)
    dirExitW: 40,       // onder 40 W: net in balans
    crossDiffW: 150,    // max. afwijking net + zon − Cupra t.o.v. huissensor
    houseNegW: -50,     // huissensor onder −50 W is ongeldig
    maxW: 9200,         // 1×40 A ≈ 9,2 kW: schaal voor intensiteit
    evMaxW: 11500,      // laadmeting boven ~11,5 kW (3×16 A) is fysiek onwaarschijnlijk voor 1×40 A
    // Tijdstempels tot 120 s in de toekomst worden geaccepteerd (klokverschil tussen bron en
    // weergave). Meer dan 120 s in de toekomst ⇒ 'stale' ("Tijdstempel onbekend"): nooit actief.
    futureToleranceMs: 120000,
    // RC1-B: balanscontrole alleen als de vier bron-tijdstempels (P1, PV, Alfen, huis) binnen deze spreiding liggen
    // (LIVE: instelbaar via de HA-adapter, balance_max_skew_s). VOORLOPIGE waarde (RC2), niet gemeten in een echte HA ...
    balanceMaxSkewMs: 10000,
    // ... en de huissensor niet méér dan deze marge ouder is dan de nieuwste invoermeting (de huiswaarde wordt
    // afgeleid van de andere meters; is zij ouder, dan heeft zij de laatste invoerwijziging mogelijk nog niet verwerkt).
    houseLagTolMs: 2000
  });

  const UNAVAILABLE = new Set(['', 'unknown', 'unavailable', 'none', 'null', 'nan']);

  // Leesbare HA-achtige entiteitsnamen, uitsluitend als label in de DEMO.
  const SPECS = Object.freeze({
    net: { key: 'net', entity: 'sensor.p1_meter_vermogen', kind: 'power', ttlS: 60 },
    pv: { key: 'pv', entity: 'sensor.goodwe_pv_power', kind: 'power', ttlS: 60 },
    house: { key: 'house', entity: 'sensor.energiehuis_huisverbruik_exclusief_auto', kind: 'power', ttlS: 60 },
    ev: { key: 'ev', entity: 'sensor.alfen_actief_vermogen_totaal', kind: 'power', ttlS: 60 },
    soc: { key: 'soc', entity: 'sensor.garage_cupra_born_accuniveau', kind: 'percent', ttlS: 1800 },
    battery: { key: 'battery', entity: 'sensor.virtuele_batterij_soc', kind: 'percent', ttlS: 1800 },
    practice: { key: 'practice', entity: null, kind: 'power', ttlS: 60 }
  });

  const ROUTES = Object.freeze(['sun-home', 'grid-home', 'home-grid', 'home-ev', 'home-practice']);
  const LABEL = Object.freeze({ net: 'P1', pv: 'zon', ev: 'laadpaal', house: 'huis' });

  function parseNumber(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (UNAVAILABLE.has(s.toLowerCase())) return null;
    if (!/^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/.test(s)) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function ageLabel(ms) {
    if (!Number.isFinite(ms) || ms < 0) return 'tijd onbekend';
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'zojuist';
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    return h < 24 ? h + ' uur' : Math.floor(h / 24) + ' d';
  }

  function asyncWhy(late, skewTxt) {
    return late.length ? 'niet live bevestigd: ' + late.map(k => LABEL[k]).join(', ') + ' (spreiding ' + skewTxt + ')' : 'HA-bronmeldingen lopen ' + skewTxt + ' uiteen';
  }
  /** "40 s geleden", "5 min geleden" (voor vertraagde metingen). */
  function agoLabel(ms) {
    if (!Number.isFinite(ms) || ms < 0) return 'tijd onbekend';
    return ms < 60000 ? Math.round(ms / 1000) + ' s geleden' : ageLabel(ms) + ' geleden';
  }

  /** Leest één HA-achtig state-object. Geeft altijd een bevroren Reading terug. */
  function readEntity(st, spec, now) {
    const base = { key: spec.key, entity: spec.entity, kind: spec.kind, value: null, ageMs: null, simulated: false, reason: '' };
    const done = (state, extra) => Object.freeze({ ...base, ...extra, state });
    if (!spec.entity && !(st && st.simulated)) return done('unlinked', { reason: 'Nog niet gekoppeld' });
    if (!st) return done('unknown', { reason: 'Geen meting' });
    if (st.missing) return done('unknown', { reason: 'Entiteit niet gevonden' });
    const unitRaw = String((st.attributes && st.attributes.unit_of_measurement) || '').trim();
    // Ruwe brontekst (ondertekend, zoals HA hem levert) uitsluitend voor diagnose in het detailpaneel; nooit gerekend.
    base.raw = Object.freeze({ state: String(st.state), unit: unitRaw });
    const value = parseNumber(st.state);
    if (value === null) return done('unknown', { reason: 'Geen geldige waarde' });
    const unit = unitRaw.toLowerCase();
    let v = value;
    if (spec.kind === 'power') {
      if (unit === 'kw') v = value * 1000;
      else if (unit !== 'w') return done('invalid-unit', { reason: unit ? 'Onbekende eenheid “' + unitRaw + '”' : 'Eenheid ontbreekt' });
    } else if (spec.kind === 'percent') {
      if (unit !== '%') return done('invalid-unit', { reason: unit ? 'Onbekende eenheid “' + unitRaw + '”' : 'Eenheid ontbreekt' });
      if (value < 0 || value > 100) return done('unknown', { reason: 'Buiten 0–100 %' });
    }
    // Versheid: de meest recente BRON-tijdstempel (last_reported ≥ last_updated ≥ last_changed). Nooit een eigen
    // tijdstempel verzinnen: ontbreekt er een, dan is de meting niet actueel.
    const stamp = freshness(st), t = stamp.t;
    if (!Number.isFinite(t) || now - t < -T.futureToleranceMs) return done('stale', { reason: 'Tijdstempel onbekend', stampSource: stamp.source });
    const ageMs = Math.max(0, now - t);
    if (ageMs > spec.ttlS * 1000) {
      // Stabiele bronnen (bijv. PV 's nachts op 0 W, Cupra-SOC): laatste stand tonen, nooit als actueel of als route.
      const keep = spec.stable && (spec.kind !== 'power' || Math.abs(v) < T.zeroW);
      return done('stale', { ageMs, stampMs: t, stampSource: stamp.source, retained: keep ? v : null, reason: keep ? 'Laatste stand · ' + ageLabel(ageMs) + ' · niet recent bevestigd' : 'Verouderd · ' + ageLabel(ageMs) });
    }
    // RC1-A: tussen route-TTL en toon-TTL mag de waarde zichtbaar blijven ("vertraagd"), maar ze is NIET actueel genoeg
    // voor een actieve route, bewegende lichtpunten, een netrichting of de balanscontrole.
    const routeTtlS = Number.isFinite(spec.routeTtlS) ? Math.min(spec.routeTtlS, spec.ttlS) : spec.ttlS;
    if (ageMs > routeTtlS * 1000) return done('recent', { shown: v, ageMs, stampMs: t, stampSource: stamp.source, reason: 'Niet live · bevestigd ' + agoLabel(ageMs) });
    const simulated = !!st.simulated;
    if (spec.kind === 'power' && Math.abs(v) < T.zeroW) return done('live-zero', { value: v, ageMs, stampMs: t, simulated, stampSource: stamp.source, reason: 'Actueel' });
    return done('live', { value: v, ageMs, stampMs: t, simulated, stampSource: stamp.source, reason: 'Actueel' });
  }

  /** Meest recente geldige bron-tijdstempel van een HA-state (geen eigen tijd). */
  function freshness(st) {
    let best = { t: NaN, source: null };
    for (const k of ['last_reported', 'last_updated', 'last_changed']) {
      const v = Date.parse((st && st[k]) || '');
      if (Number.isFinite(v) && !(v <= best.t)) best = { t: v, source: k };
    }
    return best;
  }

  const cur = r => !!r && (r.state === 'live' || r.state === 'live-zero');
  /** Waarde die getoond mag worden: actueel, vertraagd (RC1-A) of een stabiele laatste stand. Nooit voor routes. */
  const shownOf = r => !r ? null : cur(r) ? r.value : r.state === 'recent' ? r.shown : r.retained != null ? r.retained : null;

  /** Vermogen als NL-tekst, altijd zonder minteken (richting staat in het label). */
  function formatPower(w) {
    if (!Number.isFinite(w)) return '—';
    const a = Math.abs(w);
    if (a < T.zeroW) return '0 W';
    if (a < 1000) return String(Math.round(a / 10) * 10) + ' W';
    if (a < 10000) return (a / 1000).toFixed(2).replace('.', ',') + ' kW';
    return (a / 1000).toFixed(1).replace('.', ',') + ' kW';
  }
  /** Netvermogen met teken: teruglevering krijgt een minteken (−), afname geen teken. */
  function formatNet(importW, direction) {
    if (!Number.isFinite(importW)) return '—';
    const s = formatPower(importW);
    return direction === 'export' && s !== '0 W' ? '\u2212' + s : s;
  }
  const formatPct = p => Number.isFinite(p) ? Math.round(p) + ' %' : '—';

  function gridDirection(importW, prevDir) {
    if (importW === null) return null;
    const a = Math.abs(importW);
    if (a < T.dirExitW) return 'balance';
    if (importW >= T.dirEnterW) return 'import';
    if (importW <= -T.dirEnterW) return 'export';
    // dode band 40–80 W: alleen dezelfde richting vasthouden, nooit de tegengestelde claimen
    if (prevDir === 'import' && importW > 0) return 'import';
    if (prevDir === 'export' && importW < 0) return 'export';
    return 'balance';
  }

  const intensityOf = w => Math.max(0.15, Math.min(1, Math.sqrt(Math.max(0, w) / T.maxW)));

  /**
   * input: { now, connected, config:{p1Sign}, states:{key: HA-like state}, cupra:{plug, label} }
   * prev:  vorig model (alleen voor de netrichting in de dode band)
   */
  function computeModel(input, prev) {
    const now = input.now;
    const connected = input.connected !== false;
    const p1Sign = (input.config && input.config.p1Sign) === 'export_positive' ? 'export_positive' : 'import_positive';
    const states = input.states || {};
    const live = input.live === true;
    // Bronspecificaties: standaard SPECS (DEMO); LIVE levert via de HA-adapter entiteit, TTL en stabiliteit per bron.
    const specs = {};
    for (const k of Object.keys(SPECS)) specs[k] = Object.freeze({ ...SPECS[k], ...((input.specs && input.specs[k]) || {}), key: k, kind: SPECS[k].kind });
    const r = {};
    for (const k of Object.keys(specs)) r[k] = readEntity(states[k], specs[k], now);
    if (!connected) for (const k of Object.keys(r)) if (r[k].state !== 'unlinked') r[k] = Object.freeze({ ...r[k], state: 'offline', value: null, shown: null, retained: null, raw: null, reason: 'Offline' });

    const net = cur(r.net) ? r.net.value : null;
    const importW = net === null ? null : (p1Sign === 'export_positive' ? -net : net);
    const prevDir = prev && prev.grid ? prev.grid.direction : null;
    const direction = gridDirection(importW, prevDir);

    // ---- integriteit
    const warnings = [];
    const house = cur(r.house) ? r.house.value : null;
    let houseInvalid = false;
    if (house !== null && house < T.houseNegW) {
      houseInvalid = true;
      warnings.push({ code: 'house-negative', critical: true, text: 'Huissensor is negatief: P1-richting of huisformule controleren.' });
    }
    const pv = cur(r.pv) ? r.pv.value : null;
    // Laadmeting: negatief (< −30 W) of onwaarschijnlijk hoog is ongeldig. Nooit als positief
    // laadvermogen of als actieve laadsessie tonen; |P| < 30 W telt als 0 W.
    let evInvalid = null;
    if (cur(r.ev) && r.ev.value < -T.zeroW) evInvalid = 'Ongeldige laadmeting (negatief)';
    else if (cur(r.ev) && r.ev.value > T.evMaxW) evInvalid = 'Ongeldige laadmeting (te hoog)';
    if (evInvalid) warnings.push({ code: 'ev-invalid', critical: false, text: evInvalid + ': Cupra-route en balans uitgeschakeld.' });
    const ev = cur(r.ev) && !evInvalid ? Math.max(0, r.ev.value) : null;
    // ---- balans (RC1-B): alleen een keten met VOLDOENDE SYNCHRONE bronmeldingen mag als tegenstrijdig (kritiek) gelden.
    // Let op (RC2): de tijdstempels zijn die van de HA-statusmelding (last_reported/last_updated), NIET de fysieke
    // meettijd in de meter of omvormer. Synchroniciteit is dus een benadering tot echte HA-data is onderzocht.
    let balance = 'onbekend', balanceInfo = 'Niet alle vier meetwaarden zijn actueel: balans niet te controleren', hold = null;
    const chainKeys = ['net', 'pv', 'ev', 'house'];
    // Invoer: actuele waarden, en ook vertraagde/laatst bekende (RC1-A) — die kunnen een tegenstrijdigheid wel
    // ZICHTBAAR maken (routes pauzeren), maar nooit een kritieke melding of een "sluit" opleveren.
    const netB = importW !== null ? importW : r.net.state === 'recent' ? (p1Sign === 'export_positive' ? -r.net.shown : r.net.shown) : null;
    const pvB = shownOf(r.pv), evRaw = shownOf(r.ev), houseB = shownOf(r.house);
    const evB = evRaw === null || evRaw < -T.zeroW || evRaw > T.evMaxW ? null : Math.max(0, evRaw);
    if (netB !== null && pvB !== null && evB !== null && houseB !== null && !houseInvalid && houseB >= T.houseNegW && !evInvalid) {
      const allLive = chainKeys.every(k => cur(r[k]));
      const calc = netB + pvB - evB, diff = Math.abs(calc - houseB);
      const stamps = chainKeys.map(k => r[k].stampMs);
      const skewMs = Math.max(...stamps) - Math.min(...stamps);
      const newestInput = Math.max(r.net.stampMs, r.pv.stampMs, r.ev.stampMs);
      const houseLagMs = Math.max(0, newestInput - r.house.stampMs);
      const maxSkewMs = Number.isFinite(input.balanceMaxSkewS) ? input.balanceMaxSkewS * 1000 : T.balanceMaxSkewMs;
      const late = chainKeys.filter(k => !cur(r[k]));
      const sync = allLive && skewMs <= maxSkewMs && houseLagMs <= T.houseLagTolMs;
      const skewTxt = skewMs < 60000 ? (skewMs / 1000).toFixed(skewMs < 10000 ? 1 : 0).replace('.', ',') + ' s' : ageLabel(skewMs);
      if (diff <= T.crossDiffW) {
        balance = sync ? 'sluit' : 'niet vergelijkbaar';
        balanceInfo = sync ? 'Sluit (spreiding bronmeldingen ' + skewTxt + ') — dit bewijst niet dat de meetketen is geverifieerd' : 'Rekenkundig binnen 150 W, maar ' + asyncWhy(late, skewTxt) + ': niet als bevestiging te gebruiken';
      } else if (sync) {
        balance = 'wijkt af';
        balanceInfo = 'Wijkt ' + formatPower(diff) + ' af bij synchrone meting (spreiding ' + skewTxt + ')';
        warnings.push({ code: 'crosscheck', critical: true, text: 'Net + zon − Cupra wijkt meer dan 150 W af van de huissensor.' });
      } else {
        // Niet synchroon én afwijkend: niet aantoonbaar tegenstrijdig, maar ook niet te vertrouwen. Geen kritieke
        // melding; wel alle routes pauzeren, want welke meting achterloopt is niet te bepalen.
        balance = 'niet vergelijkbaar';
        hold = 'Gepauzeerd: meetketen niet synchroon';
        balanceInfo = 'Wijkt ' + formatPower(diff) + ' af, maar ' + asyncWhy(late, skewTxt) + (houseLagMs > T.houseLagTolMs ? ' (huissensor loopt ' + agoLabel(houseLagMs).replace(' geleden', '') + ' achter op de invoer)' : '') + ': niet vergelijkbaar';
        warnings.push({ code: 'chain-async', critical: false, text: 'De HA-bronmeldingen lopen in tijd uiteen en de waarden sluiten niet: stroomroutes gepauzeerd tot een synchrone melding.' });
      }
    }
    if (pv !== null && pv < -T.routeMinW) warnings.push({ code: 'pv-negative', critical: false, text: 'Negatieve zonne-opwek genegeerd.' });
    const critical = warnings.some(w => w.critical);
    const blocked = !connected ? 'Offline' : critical ? 'Gestopt: meetketen tegenstrijdig' : hold;

    // ---- routes (geen grace: ongeldig = direct inactief)
    const practiceSim = cur(r.practice) && r.practice.simulated && r.practice.value >= 0;
    const practiceLive = live && cur(r.practice) && !r.practice.simulated && r.practice.value >= 0;
    const practiceFlow = practiceSim || practiceLive;
    const cand = {
      'sun-home': { ok: pv !== null && pv >= T.routeMinW, w: pv, why: cur(r.pv) ? 'Onder 30 W' : r.pv.reason },
      'grid-home': { ok: direction === 'import', w: importW, why: cur(r.net) ? 'Geen netafname' : r.net.reason },
      'home-grid': { ok: direction === 'export', w: importW === null ? null : -importW, why: cur(r.net) ? 'Geen teruglevering' : r.net.reason },
      'home-ev': { ok: ev !== null && ev >= T.routeMinW, w: ev, why: evInvalid || (cur(r.ev) ? 'Cupra laadt niet' : r.ev.reason) },
      'home-practice': { ok: practiceFlow && r.practice.value >= T.routeMinW, w: practiceFlow ? r.practice.value : null, why: r.practice.state === 'unlinked' ? 'Nog niet gekoppeld' : r.practice.reason || 'Geen actuele meting' }
    };
    const routes = {};
    for (const id of ROUTES) {
      const c = cand[id];
      const active = !blocked && c.ok && c.w !== null && c.w >= T.routeMinW;
      routes[id] = Object.freeze({
        id, active,
        watts: active ? c.w : null,
        intensity: active ? intensityOf(c.w) : 0,
        simulated: id === 'home-practice' && practiceSim,
        reason: blocked || (active ? (live ? 'Actief' : 'Actief (DEMO)') : c.why)
      });
    }

    // ---- tegels
    const val = (rd, fmt) => { const v = shownOf(rd); return v === null ? '—' : fmt(v); };
    const tone = rd => rd.state === 'live' || rd.state === 'live-zero' ? 'ok' : rd.state === 'unlinked' ? 'muted' : 'warn';
    const pvShown = shownOf(r.pv), evShown = shownOf(r.ev), houseShown = shownOf(r.house);
    const tiles = {};
    tiles.pv = { title: 'Zonnepanelen', value: pvShown !== null && pvShown >= 0 ? formatPower(pvShown) : '—', sub: cur(r.pv) ? (pv >= T.routeMinW ? 'Opwek' : 'Geen opwek') : r.pv.reason, tone: tone(r.pv), entity: specs.pv.entity };
    tiles.battery = { title: 'Virtuele batterij', value: val(r.battery, formatPct), sub: cur(r.battery) || r.battery.state === 'unlinked' ? 'Geen fysieke opslag' : 'Geen fysieke opslag · ' + r.battery.reason, tone: 'sim', entity: specs.battery.entity };
    tiles.house = { title: 'Huis', value: houseInvalid ? '—' : (houseShown !== null && houseShown >= T.houseNegW ? formatPower(houseShown) : '—'), sub: houseInvalid ? 'Ongeldige meting' : (cur(r.house) ? 'Verbruik excl. Cupra' : r.house.reason), tone: houseInvalid ? 'bad' : tone(r.house), entity: specs.house.entity };
    const netSub = importW === null ? r.net.reason : direction === 'import' ? 'Afname van het net' : direction === 'export' ? 'Teruglevering aan het net' : 'In balans';
    // Vertraagde P1 (RC1-A): alleen de grootte tonen, zonder teken of richting (de richting is niet actueel bevestigd).
    const netShown = importW === null && r.net.state === 'recent' ? formatPower(r.net.shown) : null;
    tiles.net = { title: 'Net', value: importW === null ? (netShown || '—') : formatNet(importW, direction), sub: netSub, tone: tone(r.net), direction, entity: specs.net.entity, p1Sign };
    tiles.practice = practiceFlow
      ? { title: 'Praktijkruimte', value: formatPower(r.practice.value), sub: practiceSim ? 'SIMULATIE · niet gemeten' : 'Actueel verbruik', tone: practiceSim ? 'sim' : tone(r.practice), entity: specs.practice.entity || '—' }
      : { title: 'Praktijkruimte', value: '—', sub: r.practice.state === 'unlinked' ? 'Nog niet gekoppeld' : r.practice.reason || 'Meting niet beschikbaar', tone: r.practice.state === 'unlinked' ? 'muted' : 'warn', entity: specs.practice.entity || '—' };
    const charging = routes['home-ev'].active;
    const cu = input.cupra || {};
    const cupraLabel = charging ? (cu.label || 'Laden') : (cu.idleLabel || 'Niet aan het laden');
    tiles.cupra = { title: 'Cupra Born', value: evInvalid ? '—' : (ev !== null ? formatPower(ev) : evShown !== null && evShown >= -T.zeroW && evShown <= T.evMaxW ? formatPower(Math.max(0, evShown)) : '—'), soc: val(r.soc, formatPct), socReason: cur(r.soc) ? 'Actueel' : r.soc.reason, sub: evInvalid || (cur(r.ev) ? cupraLabel : r.ev.reason), tone: evInvalid ? 'bad' : tone(r.ev), charging, entity: specs.ev.entity, socEntity: specs.soc.entity };

    // ---- status en samenvatting
    let status;
    if (!connected) status = { text: 'Offline', tone: 'bad' };
    else if (critical) status = { text: 'Controle nodig', tone: 'bad' };
    else if (hold) status = { text: 'Meetketen niet synchroon', tone: 'warn' };
    else {
      const keys = ['net', 'pv', 'house', 'ev', 'soc'];
      const n = keys.filter(k => cur(r[k])).length, late = keys.filter(k => r[k].state === 'recent').length;
      status = { text: n + '/' + keys.length + (live ? ' meetwaarden actueel' : ' fictieve meetwaarden actueel') + (late ? ' · ' + late + ' vertraagd' : ''), tone: n === keys.length ? 'ok' : 'warn' };
    }
    const late = ['pv', 'ev', 'net'].filter(k => r[k].state === 'recent').map(k => LABEL[k]);
    const summary = summarize({ connected, critical, hold, routes, direction, importW, live, late });

    return Object.freeze({
      demo: !live, live, now, connected, p1Sign,
      readings: Object.freeze(r),
      grid: Object.freeze({ direction, importW }),
      balance, balanceInfo, hold, warnings: Object.freeze(warnings), critical,
      routes: Object.freeze(routes),
      tiles: Object.freeze(Object.fromEntries(Object.entries(tiles).map(([k, v]) => [k, Object.freeze(v)]))),
      status: Object.freeze(status), summary
    });
  }

  /**
   * RC2: presentatie van de Net-kaart. Alleen bij een ACTIEVE netroute een richting (teken, pijl, kleur). Is er een
   * actuele P1-waarde maar staat de netroute stil (meetketen tegenstrijdig of niet synchroon), dan het ABSOLUTE
   * gemeten vermogen zonder teken of pijl, met het label "P1-meting · richting niet bevestigd". Verandert niets aan de
   * sensorwaarde of de P1-berekening (model.grid blijft ongewijzigd).
   */
  function netPresentation(m) {
    const t = m.tiles.net, active = !!(m.routes['grid-home'].active || m.routes['home-grid'].active);
    if (active && (t.direction === 'import' || t.direction === 'export')) return Object.freeze({ value: t.value, sub: t.sub, direction: t.direction, confirmed: true });
    if (m.grid.importW !== null && (t.direction === 'import' || t.direction === 'export')) {
      const why = m.critical ? 'meetketen tegenstrijdig' : m.hold ? 'meetketen niet synchroon' : 'netroute staat stil';
      return Object.freeze({ value: formatPower(m.grid.importW), sub: 'Richting niet bevestigd', badge: 'P1-meting', badgeCompact: 'P1 · richting onbevestigd', reason: why, label: 'P1-meting · richting niet bevestigd (' + why + ')', direction: 'unconfirmed', confirmed: false, unconfirmed: true });
    }
    return Object.freeze({ value: t.value, sub: t.sub, direction: 'none', confirmed: false });
  }

  function summarize({ connected, critical, hold, routes, direction, importW, live, late = [] }) {
    if (!connected) return 'Geen verbinding met Home Assistant. Er worden geen meetwaarden of stroomrichtingen getoond.';
    if (critical) return (live ? 'De meetketen' : 'De fictieve meetketen') + ' is tegenstrijdig. Stroomroutes staan stil.';
    if (hold) return 'De HA-bronmeldingen lopen in tijd uiteen en de waarden sluiten niet. Stroomroutes zijn gepauzeerd tot een synchrone melding.';
    const p = [];
    if (routes['sun-home'].active) p.push('de zon levert ' + formatPower(routes['sun-home'].watts));
    if (direction === 'export') p.push(formatPower(importW) + ' gaat terug naar het net');
    else if (direction === 'import') p.push(formatPower(importW) + ' komt van het net');
    else if (direction === 'balance') p.push('het net is in balans');
    if (routes['home-ev'].active) p.push('de Cupra laadt met ' + formatPower(routes['home-ev'].watts));
    const s = p.length ? p.join(', ') : 'geen actuele vermogensmeting';
    const tail = late.length ? ' Niet live bevestigd (' + late.join(', ') + '): daar wordt geen stroom getoond.' : '';
    return s.charAt(0).toUpperCase() + s.slice(1) + '.' + tail;
  }

  // ---------------------------------------------------------------- DEMO-fixtures
  const W = (v, ageS, now, unit = 'W') => ({ state: String(v), attributes: { unit_of_measurement: unit }, last_updated: new Date(now - ageS * 1000).toISOString() });
  const PCT = (v, ageS, now) => ({ state: String(v), attributes: { unit_of_measurement: '%' }, last_updated: new Date(now - ageS * 1000).toISOString() });

  // Elk “normaal” scenario sluit: huis = afname + zon − Cupra.
  const SCENARIOS = Object.freeze([
    { id: 'zon-export', label: 'Zon & teruglevering', make: now => ({ states: { net: W(-1880, 2, now), pv: W(4820, 2, now), house: W(1460, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden op zonne-overschot' } }) },
    { id: 'net-laden', label: 'Netafname & laden', make: now => ({ states: { net: W(7600, 2, now), pv: W(120, 2, now), house: W(520, 3, now), ev: W(7200, 2, now), soc: PCT(38, 120, now), battery: PCT(15, 60, now) }, cupra: { label: 'Laden (goedkoop uurtarief)' } }) },
    { id: 'zon-huis', label: 'Zon dekt huis', make: now => ({ states: { net: W(-300, 2, now), pv: W(2100, 2, now), house: W(1800, 3, now), ev: W(0, 2, now), soc: PCT(81, 120, now), battery: PCT(90, 60, now) }, cupra: { idleLabel: 'Verbonden, niet aan het laden' } }) },
    { id: 'nacht', label: 'Nacht', make: now => ({ states: { net: W(420, 2, now), pv: W(0, 2, now), house: W(420, 3, now), ev: W(0, 2, now), soc: PCT(80, 300, now), battery: PCT(22, 60, now) }, cupra: { idleLabel: 'Niet verbonden' } }) },
    { id: 'nul-watt', label: '0 W (alles stil)', make: now => ({ states: { net: W(0, 2, now), pv: W(0, 2, now), house: W(0, 3, now), ev: W(0, 2, now), soc: PCT(80, 300, now), battery: PCT(22, 60, now) }, cupra: { idleLabel: 'Verbonden, niet aan het laden' } }) },
    { id: 'offline', label: 'Offline', make: now => ({ connected: false, states: { net: W(420, 2, now), pv: W(0, 2, now), house: W(420, 3, now), ev: W(0, 2, now), soc: PCT(80, 300, now), battery: PCT(22, 60, now) } }) },
    { id: 'verouderd', label: 'Verouderde P1', make: now => ({ states: { net: W(-1880, 900, now), pv: W(4820, 2, now), house: W(1460, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden' } }) },
    { id: 'onbekende-eenheid', label: 'Onbekende eenheid', make: now => ({ states: { net: W(-1880, 2, now), pv: W(4820, 2, now, 'Wh'), house: W(1460, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden' } }) },
    { id: 'p1-omgekeerd', label: 'P1 omgekeerd (gecorrigeerd)', make: now => ({ config: { p1Sign: 'export_positive' }, states: { net: W(1880, 2, now), pv: W(4820, 2, now), house: W(1460, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden op zonne-overschot' } }) },
    { id: 'p1-fout', label: 'P1 omgekeerd (niet gecorrigeerd)', make: now => ({ config: { p1Sign: 'import_positive' }, states: { net: W(1880, 2, now), pv: W(4820, 2, now), house: W(1460, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden' } }) },
    { id: 'huis-negatief', label: 'Negatieve huissensor', make: now => ({ states: { net: W(-1880, 2, now), pv: W(4820, 2, now), house: W(-350, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden' } }) },
    { id: 'praktijk-sim', label: 'Praktijk (simulatie)', make: now => ({ states: { net: W(-1230, 2, now), pv: W(4820, 2, now), house: W(2110, 3, now), ev: W(1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now), practice: { state: '650', attributes: { unit_of_measurement: 'W' }, last_updated: new Date(now - 2000).toISOString(), simulated: true } }, cupra: { label: 'Laden op zonne-overschot' } }) },
    { id: 'grote-waarden', label: 'Grote waarden & lange labels', make: now => ({ states: { net: W(-9870, 2, now), pv: W(12345, 2, now), house: W(2475, 3, now), ev: W(0, 2, now), soc: PCT(100, 120, now), battery: PCT(100, 60, now) }, cupra: { idleLabel: 'Laden gepauzeerd door laadpaal — wacht op goedkoper tarief en voldoende zonne-overschot' } }) },
    { id: 'ev-negatief', label: 'Negatieve laadmeting', make: now => ({ states: { net: W(-1880, 2, now), pv: W(4820, 2, now), house: W(1460, 3, now), ev: W(-1480, 2, now), soc: PCT(64, 120, now), battery: PCT(72, 60, now) }, cupra: { label: 'Laden' } }) }
  ]);
  const SCENARIO_IDS = Object.freeze(SCENARIOS.map(s => s.id));

  /** Kleine, deterministische schommeling zodat de DEMO “leeft” (blijft binnen de balans). */
  function jitter(fixture, tick) {
    const st = fixture.states;
    const f = (seed) => Math.round(Math.sin(tick * 0.9 + seed) * 60);
    const out = JSON.parse(JSON.stringify(fixture));
    const num = k => parseNumber(st[k] && st[k].state);
    const pv = num('pv'), house = num('house'), ev = num('ev'), net = num('net');
    if (pv !== null && pv > 200 && house !== null && net !== null && out.states.pv.attributes.unit_of_measurement === 'W') {
      const d = f(1);
      out.states.pv.state = String(pv + d);
      // houd de balans sluitend: extra opwek gaat naar het net (in de geconfigureerde tekenrichting)
      const sign = fixture.config && fixture.config.p1Sign === 'export_positive' ? 1 : -1;
      out.states.net.state = String(net + sign * d);
    }
    if (ev !== null && ev > 200) out.states.ev.state = String(ev); // laadvermogen stabiel
    return out;
  }

  function scenarioInput(id, now, tick = 0) {
    const s = SCENARIOS.find(x => x.id === id) || SCENARIOS[0];
    const fx = s.make(now);
    const j = tick ? jitter(fx, tick) : fx;
    return { now, connected: j.connected !== false, config: j.config || {}, states: j.states, cupra: j.cupra || {} };
  }

  return Object.freeze({ T, SPECS, ROUTES, SCENARIOS, SCENARIO_IDS, parseNumber, readEntity, freshness, formatPower, formatNet, formatPct, gridDirection, computeModel, netPresentation, scenarioInput, ageLabel, agoLabel });
});
 /* ---- master-scene.js (preview/pve-04/master-scene.js @ be0b299, sha256 37ae9f085d3855f880b3f76f18d2ac433b8fcbcc55523787dae770e151ef91b2) ---- */
/* GEGENEREERD door tools/build-master-scene.cjs uit cleanplate/overlay-map.json — niet met de hand bewerken.
 * Energiehuis PVE-04 · goedgekeurde master als vaste achtergrond: afdekvlakken voor de ingebakken kaarten en
 * de geometrie van de ingebakken stroomlijnen (genormaliseerde beeldcoördinaten). Puur data, geen netwerk. */
(function (root) {
  'use strict';
  const SCENE = {
    "schema": "energiehuis.master-scene/1",
    "status": "approved",
    "approvedBy": "eigenaar, 9 november 2026 (definitieve visuele referentie, ingebakken kaarten/stromen geaccepteerd)",
    "coordinateSystem": "normalized-image (0..1 van natural w/h, oorsprong linksboven)",
    "image": {
      "file": "../pve-03/reference/approved-visual-20261109.webp",
      "type": "image/webp",
      "natural": {
        "w": 1330,
        "h": 748
      },
      "bytes": 176622,
      "sha256": "932d0e745f8e8a415f6aab4e87091366a32d5a68d7363b908f55445fcccc7ee6"
    },
    "margin": {
      "x": 6,
      "top": 6,
      "bottom": 8
    },
    "covers": {
      "pill": {
        "overlay": "datetime-pill",
        "baked": {
          "x": 0.6887,
          "y": 0.0134,
          "w": 0.2992,
          "h": 0.0775
        },
        "x": 0.6842,
        "y": 0.0054,
        "w": 0.3082,
        "h": 0.0962
      },
      "pv": {
        "overlay": "card-pv",
        "baked": {
          "x": 0.1383,
          "y": 0.1511,
          "w": 0.1654,
          "h": 0.1417
        },
        "x": 0.1338,
        "y": 0.1431,
        "w": 0.1744,
        "h": 0.1604
      },
      "practice": {
        "overlay": "card-practice",
        "baked": {
          "x": 0.0759,
          "y": 0.4278,
          "w": 0.1406,
          "h": 0.1123
        },
        "x": 0.0714,
        "y": 0.4198,
        "w": 0.1496,
        "h": 0.131
      },
      "house": {
        "overlay": "card-house",
        "baked": {
          "x": 0.4368,
          "y": 0.4118,
          "w": 0.1632,
          "h": 0.1417
        },
        "x": 0.4323,
        "y": 0.4038,
        "w": 0.1722,
        "h": 0.1604
      },
      "cupra": {
        "overlay": "card-cupra",
        "baked": {
          "x": 0.8068,
          "y": 0.2861,
          "w": 0.1632,
          "h": 0.1497
        },
        "x": 0.8023,
        "y": 0.2781,
        "w": 0.1722,
        "h": 0.1684
      },
      "battery": {
        "overlay": "card-battery",
        "baked": {
          "x": 0.0444,
          "y": 0.738,
          "w": 0.1729,
          "h": 0.1444
        },
        "x": 0.0399,
        "y": 0.73,
        "w": 0.1819,
        "h": 0.1631
      },
      "net": {
        "overlay": "card-net",
        "baked": {
          "x": 0.4331,
          "y": 0.7366,
          "w": 0.185,
          "h": 0.1457
        },
        "x": 0.4286,
        "y": 0.7286,
        "w": 0.194,
        "h": 0.1644
      }
    },
    "flows": [
      {
        "id": "flow-pv",
        "group": "pv",
        "routes": {
          "sun-home": false
        },
        "particles": true,
        "color": "#FFC83D",
        "width": 0.0226,
        "glow": 2.8,
        "points": [
          [
            0.2992,
            0.2166
          ],
          [
            0.3308,
            0.2179
          ],
          [
            0.3534,
            0.2273
          ],
          [
            0.3684,
            0.246
          ],
          [
            0.3835,
            0.2594
          ],
          [
            0.406,
            0.2567
          ],
          [
            0.4323,
            0.2513
          ],
          [
            0.4511,
            0.254
          ],
          [
            0.4662,
            0.2674
          ],
          [
            0.4752,
            0.2941
          ],
          [
            0.4797,
            0.3342
          ],
          [
            0.4812,
            0.3743
          ],
          [
            0.482,
            0.4225
          ]
        ]
      },
      {
        "id": "flow-practice",
        "group": "practice",
        "routes": {
          "home-practice": true
        },
        "particles": true,
        "color": "#F4F1EA",
        "width": 0.0105,
        "glow": 2.4,
        "points": [
          [
            0.2143,
            0.5187
          ],
          [
            0.2331,
            0.5294
          ],
          [
            0.2556,
            0.5294
          ],
          [
            0.2782,
            0.516
          ],
          [
            0.297,
            0.5134
          ],
          [
            0.3083,
            0.5241
          ],
          [
            0.3233,
            0.5401
          ],
          [
            0.3383,
            0.5455
          ],
          [
            0.3571,
            0.5374
          ],
          [
            0.3759,
            0.5241
          ],
          [
            0.3985,
            0.5134
          ],
          [
            0.4211,
            0.508
          ],
          [
            0.4398,
            0.5053
          ]
        ]
      },
      {
        "id": "flow-net",
        "group": "net",
        "routes": {
          "home-grid": false,
          "grid-home": true
        },
        "particles": true,
        "color": "#3FE6F2",
        "width": 0.0211,
        "glow": 2.4,
        "points": [
          [
            0.5188,
            0.5508
          ],
          [
            0.5105,
            0.5882
          ],
          [
            0.5203,
            0.6283
          ],
          [
            0.512,
            0.6684
          ],
          [
            0.5188,
            0.7086
          ],
          [
            0.5158,
            0.7393
          ]
        ]
      },
      {
        "id": "flow-car",
        "group": "ev",
        "routes": {
          "home-ev": false
        },
        "particles": true,
        "color": "#7CFF4A",
        "width": 0.0211,
        "glow": 2.4,
        "points": [
          [
            0.5985,
            0.5053
          ],
          [
            0.6316,
            0.516
          ],
          [
            0.6617,
            0.5321
          ],
          [
            0.6902,
            0.5468
          ],
          [
            0.7143,
            0.5628
          ],
          [
            0.7233,
            0.5722
          ]
        ]
      },
      {
        "id": "flow-card-car",
        "group": "ev",
        "routes": {
          "home-ev": false
        },
        "particles": false,
        "color": "#7CFF4A",
        "width": 0.0135,
        "glow": 2.2,
        "points": [
          [
            0.8368,
            0.4332
          ],
          [
            0.8346,
            0.4612
          ],
          [
            0.8391,
            0.4893
          ],
          [
            0.8451,
            0.516
          ]
        ]
      }
    ],
    "keep": [
      "header-logo",
      "header-title",
      "car-plate",
      "car-logo"
    ]
  };
  const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
  if (typeof module === 'object' && module.exports) module.exports = deepFreeze(SCENE);
  else root.EhPve04MasterScene = deepFreeze(SCENE);
})(scope);
 /* ---- master.js (preview/pve-04/master.js @ be0b299, sha256 95631aec58f8d86a34e3f8e487a008e02a18b6e91642edf9708b3a6f4b2fb27d) ---- */
/* Energiehuis PVE-04 · master.js — interactieve cockpit op de goedgekeurde master (DEMO, RC2).
 *
 * DEMO ONLY: geen Home Assistant, geen netwerk (behalve de master uit dezelfde map), geen opslag.
 * De goedgekeurde afbeelding blijft EXACT en ongewijzigd de achtergrond (geen rustlagen, geen retouche: RC2-besluit).
 *   - De ingebakken lichtlijnen in het beeld zijn DECORATIEF en geen actuele stroomindicator. De actuele stroom wordt
 *     getoond met bewegende lichtpunten (alleen bij een geldige, actuele, actieve route volgens model.js), met
 *     routekleur en stroomrichting, en met de kaarten (waarde, kleur, pijl, tekst).
 *   - Glaskaarten liggen exact over de ingebakken kaarten. Hun basisvlak is ondoorzichtig (getint met de kleuren rond
 *     de kaart), zodat oude waarden nooit doorschijnen; daarboven een halfdoorzichtige glaslaag, gekleurde rand en gloed.
 *   - Weergaven: 'overlay' (≥ 900 px), 'compact' (mobiel/tablet: alleen kaarten op het beeld, geen dubbele set) en
 *     'list' (zeer smal of vergrote tekst: leesbare lijst onder het beeld, lege glasvlakken op het beeld).
 */
(function (root) {
  'use strict';
  const M = root.EhPve04Model;
  const OVERLAY_MIN = 900;      // containerbreedte (px) vanaf waar de volledige kaarten op de master staan
  const LIST_MAX_EM = 21;       // smaller dan 21 × de tekstgrootte ⇒ lijstweergave
  const TEXT_SCALE_MAX = 1.25;  // tekst groter dan 125 % ⇒ lijstweergave (kaarttekst op het beeld schaalt niet mee)
  const KEYS = ['pv', 'battery', 'house', 'practice', 'net', 'cupra'];
  const ICON = {
    pv: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    battery: '<rect x="6" y="4" width="12" height="18" rx="2.2"/><path d="M10 2h4"/><path d="M9 15h6M9 18h6M9 12h6"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    net: '<path d="M12 2l-4 20M12 2l4 20M7 8h10M6 13h12M9 3h6"/>',
    practice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    cupra: '<path d="M4 6l8 13 8-13-4 0-4 6.5L8 6z"/>'
  };
  // Modelroute → ingebakken lijn (alleen als pad voor de lichtpunten), richting en kleur van de lichtpunten.
  const ROUTE = {
    'sun-home': { flow: 'flow-pv', dir: 1, color: '#FFC83D', label: 'Zon → huis' },
    'home-practice': { flow: 'flow-practice', dir: -1, color: '#F4F1EA', label: 'Huis → praktijk' },
    'home-grid': { flow: 'flow-net', dir: 1, color: '#3FE6F2', label: 'Huis → net (teruglevering)' },
    'grid-home': { flow: 'flow-net', dir: -1, color: '#FF8A3D', label: 'Net → huis (afname)' },
    'home-ev': { flow: 'flow-car', dir: 1, color: '#7CFF4A', label: 'Huis → Cupra' }
  };
  const NET_DIR = { import: { arrow: '↑', text: 'van net', name: 'afname' }, export: { arrow: '↓', text: 'naar net', name: 'teruglevering' } };
  const DECOR_NOTE = 'De lichtlijnen in de afbeelding zijn decoratief en tonen geen actuele stroom. Actuele stroom: bewegende lichtpunten en de kaarten.';
  let seq = 0;

  function el(doc, tag, cls, attrs) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function setText(node, text) {
    const t = node.firstChild;
    if (t && t.nodeType === 3 && !t.nextSibling) { if (t.data !== text) t.data = text; }
    else if (node.textContent !== text) node.textContent = text;
  }
  const setData = (node, key, v) => { if (node.dataset[key] !== v) node.dataset[key] = v; };
  /** "1,46 kW" → ["1,46", " kW"]; "—" → ["—", ""]. */
  const hms = t => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join(':'); };
  function splitValue(v) { const m = /^(.*\S)(\s\S+)$/.exec(v); return m ? [m[1], m[2]] : [v, '']; }

  /** Gemiddelde kleuren net buiten een kaartvlak (boven/onder), voor het ondoorzichtige glasbasisvlak. Gooit nooit. */
  function sampleTints(img, S, doc) {
    try {
      const W = S.image.natural.w, H = S.image.natural.h;
      const c = doc.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
      const out = {};
      for (const [key, r] of Object.entries(S.covers)) {
        const x0 = Math.max(0, Math.round(r.x * W)), x1 = Math.min(W, Math.round((r.x + r.w) * W));
        const band = (ya, yb) => {
          ya = Math.max(0, Math.min(H - 1, ya)); yb = Math.max(ya + 1, Math.min(H, yb));
          const d = g.getImageData(x0, ya, Math.max(1, x1 - x0), yb - ya).data; let R = 0, G = 0, B = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
          return [R / n, G / n, B / n].map(v => Math.round(v));
        };
        const top = band(Math.round(r.y * H) - 14, Math.round(r.y * H) - 4), bot = band(Math.round((r.y + r.h) * H) + 4, Math.round((r.y + r.h) * H) + 14);
        out[key] = { top, bot };
      }
      return out;
    } catch (e) { return null; }
  }

  function createMasterCockpit(host, options = {}) {
    const doc = host.ownerDocument, win = doc.defaultView;
    const S = options.scene !== undefined ? options.scene : root.EhPve04MasterScene;
    const id = 'ehm' + (++seq);
    let scenario = M.SCENARIO_IDS.includes(options.scenario) ? options.scenario : 'zon-export';
    let tick = 0, model = null, offlineSince = null, ticker = 0, destroyed = false, openKey = null, opener = null, geoRaf = 0, layout = null, suspended = false, liveInput = null, imgRetry = 0, imgJob = 0, imgInFlight = false, imgPending = false;
    // DEMO (standaard): fictieve scenario's. LIVE: invoer uitsluitend via setInput() (HA-adapter); geen DEMO-labels,
    // geen scenario's, geen schommeling, geen fictieve waarden.
    const LIVE = options.mode === 'live';
    // v1.28-integratie (immersive Home): één tik op een kaart navigeert via de kaartcontroller i.p.v. het detailpaneel.
    const NAV = LIVE && typeof options.onTileNavigate === 'function';
    const listeners = [];
    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); listeners.push(() => t.removeEventListener(type, fn, o)); };
    const sceneOk = !!(S && S.image && S.image.natural && Array.isArray(S.flows) && S.covers && KEYS.every(k => S.covers[k]));
    const base = options.base || '';

    // ---------------- bouw (één keer)
    const rootEl = el(doc, 'section', 'ehc ehc--master', { 'aria-labelledby': id + '-title', 'data-layout': 'overlay', 'data-scene': sceneOk ? 'loading' : 'missing', 'data-tint': 'none' });
    const head = el(doc, 'header', 'ehc-head');
    head.innerHTML = `<div class="ehc-brand"><h1 class="ehc-title" id="${id}-title">Energiehuis <span>Live Cockpit</span></h1></div>`;
    const badge = el(doc, 'p', LIVE ? 'ehc-demo ehc-live' : 'ehc-demo'); badge.textContent = LIVE ? 'LIVE · alleen-lezen' : 'DEMO — fictieve meetwaarden';
    const sceneNote = el(doc, 'p', 'ehc-scene-note', { role: 'note' }); sceneNote.hidden = true;
    const status = el(doc, 'p', 'ehc-status', { role: 'status' });
    head.append(badge, sceneNote, status);

    const frame = el(doc, 'div', 'ehm-frame');
    const stage = el(doc, 'div', 'ehm-stage');
    const img = el(doc, 'img', 'ehm-scene', { alt: 'Goedgekeurde avondscène: woning met zonnepanelen, houten praktijkruimte links en een groene Cupra bij de laadpaal rechts. De lichtlijnen in het beeld zijn decoratief; de ingebakken voorbeeldkaarten zijn afgedekt door ' + (LIVE ? 'live kaarten met actuele meetwaarden.' : 'live DEMO-kaarten.'), decoding: 'async', fetchpriority: 'high', draggable: 'false' });
    const particles = el(doc, 'canvas', 'ehm-particles', { 'aria-hidden': 'true' });
    const covers = el(doc, 'div', 'ehm-covers', { 'aria-hidden': 'true' });
    const pill = el(doc, 'div', 'ehm-cover ehm-pill', { 'data-key': 'pill' }); pill.innerHTML = LIVE ? '<span class="p-demo p-live">LIVE</span><span class="p-text">alleen-lezen</span><span class="p-time"></span>' + (typeof options.pillExtra === 'function' ? '<span class="p-extra" hidden></span>' : '') : '<span class="p-demo">DEMO</span><span class="p-text">fictieve meetwaarden</span><span class="p-time"></span>';
    const pillExtra = pill.querySelector('.p-extra'), pillTime = pill.querySelector('.p-time'), pillLabel = pill.querySelector('.p-demo'), pillText = pill.querySelector('.p-text');
    covers.appendChild(pill);
    const PL = {};   // lege glasvlakken (alleen in de lijstweergave zichtbaar; de lijst eronder toont de waarden)
    for (const k of KEYS) { const p = el(doc, 'div', 'ehm-cover ehm-plate', { 'data-key': k }); p.innerHTML = `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`; covers.appendChild(p); PL[k] = p; }
    stage.append(img, particles, covers);

    const tiles = el(doc, 'div', 'ehm-tiles');
    const T = {};
    for (const k of KEYS) {
      const b = el(doc, 'button', 'tile', NAV ? { type: 'button', 'data-key': k } : { type: 'button', 'data-key': k, 'aria-haspopup': 'dialog', 'aria-controls': id + '-detail', 'aria-expanded': 'false' });
      b.innerHTML = `<span class="t-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><span class="t-body"><span class="t-title"></span><span class="t-value"><span class="t-num"></span><span class="t-unit"></span></span>${typeof options.tileDay === 'function' ? '<span class="t-day" hidden></span>' : ''}<span class="t-extra"></span><span class="t-sub"></span></span>`;
      tiles.appendChild(b);
      T[k] = { b, title: b.querySelector('.t-title'), value: b.querySelector('.t-value'), num: b.querySelector('.t-num'), unit: b.querySelector('.t-unit'), day: b.querySelector('.t-day'), extra: b.querySelector('.t-extra'), sub: b.querySelector('.t-sub') };
    }
    frame.append(stage, tiles);

    const legend = el(doc, 'p', 'ehm-legend'); legend.textContent = DECOR_NOTE;
    const summary = el(doc, 'p', 'ehc-summary', { 'aria-live': 'polite' });
    const warn = el(doc, 'p', 'ehc-warn', { role: 'alert' }); warn.hidden = true;
    const controls = el(doc, 'details', 'ehc-controls');
    const cLabel = el(doc, 'summary', 'ehc-controls-title'); cLabel.textContent = 'DEMO-scenario’s';
    const group = el(doc, 'div', 'ehc-scenarios', { role: 'group', 'aria-label': 'DEMO-scenario’s' });
    const SB = {};
    for (const s of M.SCENARIOS) { const b = el(doc, 'button', 'chip', { type: 'button', 'data-scenario': s.id, 'aria-pressed': 'false' }); b.textContent = s.label; group.appendChild(b); SB[s.id] = b; }
    const play = el(doc, 'button', 'chip chip-play', { type: 'button', 'aria-pressed': 'true' }); play.textContent = 'Schommeling aan';
    controls.append(cLabel, group, play);
    const detail = el(doc, 'div', 'ehc-detail', { id: id + '-detail', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': id + '-dt' });
    detail.hidden = true;
    detail.innerHTML = `<div class="d-head"><h2 class="d-title" id="${id}-dt"></h2><button type="button" class="d-close" aria-label="Sluiten">×</button></div><p class="d-value"></p><dl class="d-list"></dl><p class="d-note">${LIVE ? 'Alleen-lezen: geen bediening, geen servicecalls, geen opslag.' : 'DEMO: fictieve meetwaarden. Geen verbinding met Home Assistant, geen bediening.'}</p>`;
    const D = { title: detail.querySelector('.d-title'), value: detail.querySelector('.d-value'), list: detail.querySelector('.d-list'), close: detail.querySelector('.d-close') };
    rootEl.append(head, frame, legend, summary, warn, ...(LIVE ? [] : [controls]), detail);
    if (LIVE) rootEl.dataset.mode = 'live';
    host.appendChild(rootEl);

    // posities (percentages van de master) — één keer zetten
    const setBox = (node, c) => { for (const [k, v] of [['--x', c.x], ['--y', c.y], ['--w', c.w], ['--h', c.h]]) node.style.setProperty(k, String(v)); };
    if (sceneOk) {
      for (const k of KEYS) { setBox(T[k].b, S.covers[k]); setBox(PL[k], S.covers[k]); }
      if (S.covers.pill) setBox(pill, S.covers.pill); else pill.hidden = true;
      img.setAttribute('width', S.image.natural.w); img.setAttribute('height', S.image.natural.h);
    }
    function sceneState(state, text) { rootEl.dataset.scene = state; sceneNote.hidden = !text; setText(sceneNote, text || ''); }
    function onImageLoad() {
      if (destroyed || !sceneOk) return;
      sceneState('ok', '');
      const t0 = win.performance.now();
      const tints = sampleTints(img, S, doc);
      rootEl.dataset.tintMs = String(Math.round(win.performance.now() - t0));
      if (tints) {
        const css = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        for (const [k, t] of Object.entries(tints)) {
          const node = k === 'pill' ? pill : T[k] && T[k].b; if (!node) continue;
          for (const n of k === 'pill' ? [pill] : [node, PL[k]]) { n.style.setProperty('--tint-top', css(t.top)); n.style.setProperty('--tint-bot', css(t.bot)); }
        }
        rootEl.dataset.tint = 'ok';
      } else rootEl.dataset.tint = 'fallback';
      scheduleGeo();
    }

    // ---------------- lichtpunten (alleen actieve routes, in stroomrichting en routekleur)
    const pctx = particles.getContext('2d');
    const reduced = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {}, removeEventListener() {} };
    const FLOWS = sceneOk ? Object.fromEntries(S.flows.map(f => [f.id, f])) : {};
    const PF = Object.values(ROUTE).map(r => r.flow).filter((f, i, a) => a.indexOf(f) === i && FLOWS[f])
      .map(fid => ({ id: fid, points: FLOWS[fid].points, poly: null, route: null, active: false, dir: 1, color: '#ffffff', intensity: 0, alpha: 0, phase: Array.from({ length: 7 }, (_, i) => i / 7) }));
    let sw = 0, sh = 0, dpr = 1, raf = 0, last = 0, paused = false;
    const sprites = {};
    function sprite(color) {
      if (sprites[color]) return sprites[color];
      const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, color); gr.addColorStop(0.5, color + '66'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[color] = c);
    }
    function poly(points) {
      const pts = points.map(p => ({ x: p[0] * sw, y: p[1] * sh })), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      return { pts, cum, length: cum[cum.length - 1] };
    }
    function at(pl, f) {
      const d = f * pl.length; let lo = 0, hi = pl.cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pl.cum[m] < d) lo = m; else hi = m; }
      const span = pl.cum[hi] - pl.cum[lo] || 1, t = (d - pl.cum[lo]) / span, a = pl.pts[lo], b = pl.pts[hi];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    const animating = () => !paused && !suspended && !reduced.matches && !doc.hidden && !destroyed;
    function kick() { if (!raf && animating() && PF.some(p => p.active || p.alpha > 0.01)) { last = 0; raf = win.requestAnimationFrame(frameFn); } else if (!animating()) draw(0); }
    function frameFn(ts) {
      raf = 0;
      if (!animating()) return;
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      draw(dt);
      if (PF.some(p => p.active || p.alpha > 0.01)) raf = win.requestAnimationFrame(frameFn);
    }
    function draw(dt) {
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, sw, sh);
      const still = !animating();
      const u = Math.max(0.35, Math.min(1.4, sw / (sceneOk ? S.image.natural.w : 1330)));
      for (const p of PF) {
        p.alpha += ((p.active ? 1 : 0) - p.alpha) * Math.min(1, dt * (p.active ? 4 : 6));   // passieve fade, geen claim
        if (still) p.alpha = p.active ? 1 : 0;
        if (!p.poly || p.alpha < 0.01) continue;
        if (still) {                                       // reduced motion / verborgen: richting via drie pijlen
          pctx.strokeStyle = p.color; pctx.lineWidth = 2.6 * u + 0.8; pctx.globalAlpha = 0.95;
          for (let i = 1; i <= 3; i++) {
            const q = at(p.poly, p.dir > 0 ? i / 4 : 1 - i / 4), a = q.angle + (p.dir > 0 ? 0 : Math.PI), s = 8 * u + 3;
            pctx.beginPath(); pctx.moveTo(q.x - s * Math.cos(a - 0.6), q.y - s * Math.sin(a - 0.6)); pctx.lineTo(q.x, q.y); pctx.lineTo(q.x - s * Math.cos(a + 0.6), q.y - s * Math.sin(a + 0.6)); pctx.stroke();
          }
          pctx.globalAlpha = 1;
          continue;
        }
        const speed = (40 + 140 * p.intensity) * Math.max(0.5, u) / Math.max(120, p.poly.length);
        const spr = sprite(p.color), s = (12 + 12 * p.intensity) * u + 4;
        pctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < p.phase.length; i++) {
          // Alleen een actieve route beweegt; bij inactief staan de lichtpunten onmiddellijk stil en doven ze uit.
          if (p.active) p.phase[i] = (p.phase[i] + dt * speed) % 1;
          const f = p.dir > 0 ? p.phase[i] : 1 - p.phase[i];
          const q = at(p.poly, f), fade = Math.min(1, p.phase[i] * 6, (1 - p.phase[i]) * 6);
          pctx.globalAlpha = p.alpha * fade * (p.id === 'flow-practice' ? 0.6 : 0.95);
          pctx.drawImage(spr, q.x - s / 2, q.y - s / 2, s, s);
        }
        pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1;
      }
    }
    function applyRoutes() {
      const R = model.routes;
      for (const p of PF) {
        const rid = Object.keys(ROUTE).find(r => ROUTE[r].flow === p.id && R[r] && R[r].active) || null;
        p.active = !!rid; p.route = rid;
        if (rid) { p.dir = ROUTE[rid].dir; p.color = ROUTE[rid].color; p.intensity = R[rid].intensity; }
        const key = 'route' + p.id.replace('flow-', '').replace(/^./, c => c.toUpperCase());
        if (rootEl.dataset[key] !== (rid || 'off')) rootEl.dataset[key] = rid || 'off';
      }
      kick();
    }

    // ---------------- layout en geometrie
    function geometry() {
      geoRaf = 0;
      if (destroyed) return;
      const rw = rootEl.getBoundingClientRect().width;
      const fs = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
      const sceneShown = sceneOk && rootEl.dataset.scene !== 'error';
      // Integratie: in de immersive Home kan de scène smaller zijn dan de container (contain) ⇒ kleinste breedte telt.
      const stw = stage.getBoundingClientRect().width || rw;
      // Immersive portret (smal en hoog): leesbare routekaarten onder een volle-breedte scène (zie HOST_CSS).
      const portrait = typeof options.preferList === 'function' && options.preferList();
      const next = !sceneShown || portrait || fs / 16 > TEXT_SCALE_MAX || rw / fs < LIST_MAX_EM ? 'list' : Math.min(rw, stw) >= OVERLAY_MIN ? 'overlay' : 'compact';
      if (next !== layout) {
        layout = next; rootEl.dataset.layout = next;
        if (!controls.dataset.touched) controls.open = next === 'overlay';   // mobiel: scenario's standaard ingeklapt
        if (model) render();                                               // RC2: kaartteksten per weergave
      }
      const r = stage.getBoundingClientRect();
      sw = r.width; sh = r.height;
      const dens = sw >= 560 ? 'mid' : sw >= 330 ? 'small' : 'xs';
      rootEl.dataset.density = dens;   // xs: zeer kleine scène (bijv. liggend in de immersive Home)
      // De dagregels hebben vier vormen (≥ 800, ≥ 560, ≥ 330 en kleiner): bij een andere vorm de kaartteksten opnieuw bepalen.
      if (typeof options.tileDay === 'function') {
        const form = String(sw >= 800 ? 3 : sw >= 560 ? 2 : sw >= 330 ? 1 : 0);
        const formChanged = rootEl.dataset.dform !== form;
        rootEl.dataset.dform = form;
        if (formChanged && model) render();
      }
      rootEl.style.setProperty('--u', (sw / (sceneOk ? S.image.natural.w : 1330)).toFixed(4));
      dpr = Math.min(2, win.devicePixelRatio || 1);
      particles.width = Math.max(1, Math.round(sw * dpr)); particles.height = Math.max(1, Math.round(sh * dpr));
      particles.style.width = sw + 'px'; particles.style.height = sh + 'px';
      for (const p of PF) p.poly = sw > 0 ? poly(p.points) : null;
      draw(0); kick();
    }
    const scheduleGeo = () => { if (!geoRaf && !destroyed && !suspended) geoRaf = win.requestAnimationFrame(geometry); };
    const ro = new win.ResizeObserver(scheduleGeo); ro.observe(rootEl); ro.observe(stage);
    on(cLabel, 'click', () => { controls.dataset.touched = '1'; });   // alleen een gebruikerskeuze telt

    // ---------------- render (alleen patchen)
    function render() {
      const m = model;
      setText(status, m.status.text); setData(status, "tone", m.status.tone);
      setText(summary, (LIVE ? '' : 'DEMO · ') + m.summary);
      const w = m.warnings.map(x => x.text).join(' ');
      warn.hidden = !w; setText(warn, w);
      setData(warn, 'tone', m.critical ? 'bad' : 'warn');   // RC1-B: niet-kritieke melding (bijv. niet synchroon) oranje, niet rood
      // Netrichting (pijl, kaartkleur, lichtpunten) alleen tonen bij een ACTIEVE netroute: zo kloppen tekst, kleur en
      // richting altijd. Bij een tegenstrijdige meetketen staat de route stil en is de richting niet bevestigd.
      // RC2: zonder bevestigde richting toont de Net-kaart het absolute P1-vermogen, zonder teken of pijl.
      const NP = M.netPresentation(m), netActive = NP.confirmed;
      for (const k of KEYS) {
        const d = m.tiles[k], N = T[k];
        setText(N.title, d.title);
        const shown = k === 'net' ? NP.value : d.value;
        const [num, unit] = splitValue(shown); setText(N.num, num); setText(N.unit, unit);
        const sub = k === 'net' ? NP.sub : d.sub, dir = k === 'net' ? NP.direction : 'none';
        setText(N.sub, sub);
        // Dagtotalen (immersive Home): korte tweede regel onder de livewaarde; leeg ⇒ verborgen. Alleen tekst, geen aannames.
        const dr = N.day ? options.tileDay(k, m, layout === 'list' ? 1000 : sw) : null;              // {lines, aria} (of null)
        const dl = dr && Array.isArray(dr.lines) ? dr.lines : [], da = dr && Array.isArray(dr.aria) ? dr.aria : dl;
        const dayKey = dl.length ? dl.join('\n') : '';
        if (N.day && (N.day.dataset.k || '') !== dayKey) {
          N.day.dataset.k = dayKey;
          N.day.replaceChildren(...dl.map(t => { const sp = doc.createElement('span'); sp.textContent = t; return sp; }));
          N.day.hidden = !dayKey;
        }
        let extra = k === 'cupra' ? 'Accu ' + d.soc : k === 'battery' ? 'Simulatie' : (d.tone === 'sim' ? 'Simulatie' : '');
        if (k === 'net') { const nd = netActive ? NET_DIR[d.direction] : null; extra = nd ? nd.arrow + ' ' + nd.text : (layout === 'compact' ? NP.badgeCompact : NP.badge) || ''; }
        setText(N.extra, extra); N.extra.hidden = !extra;
        setData(N.b, 'tone', d.tone); setData(PL[k], 'tone', d.tone);
        if (k === 'net') { setData(N.b, 'direction', dir); setData(PL[k], 'direction', dir); }
        const nd = k === 'net' && netActive && NET_DIR[d.direction] ? ', ' + NET_DIR[d.direction].name + ' (' + NET_DIR[d.direction].text + ')' : '';
        const al = k === 'net' && NP.unconfirmed ? `${d.title}: ${shown}, ${NP.label}. ${NAV ? 'Pagina openen.' : 'Details openen.'}` : `${d.title}: ${shown}${nd}${k === 'cupra' ? ', accu ' + d.soc : ''}${k === 'battery' ? ', simulatie' : ''}. ${sub}. ${NAV ? 'Pagina openen.' : 'Details openen.'}`;
        const alDay = da.length ? al.replace(/ (Pagina openen|Details openen)\.$/, ' ' + da.join(' ') + ' $1.') : al;
        if (N.b.getAttribute('aria-label') !== alDay) N.b.setAttribute('aria-label', alDay);
      }
      const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
      if (LIVE) {
        // RC1-C: één ondubbelzinnige verbindingsstatus in kop én pil. Offline = rood, nooit een groene LIVE-markering;
        // verbonden maar niet alles actueel = oranje; alleen verbonden én alles actueel = groen.
        if (!m.connected) { if (offlineSince === null) offlineSince = m.now; } else offlineSince = null;
        const state = !m.connected ? 'offline' : m.status.tone === 'ok' ? 'live' : 'degraded';
        setText(badge, !m.connected ? 'OFFLINE · geen verbinding met Home Assistant' : 'LIVE · alleen-lezen');
        setData(badge, 'state', state); setData(pill, 'state', state); setData(rootEl, 'link', state);
        setText(pillLabel, m.connected ? 'LIVE' : 'OFFLINE');
        setText(pillText, m.connected ? 'alleen-lezen' : 'geen verbinding');
        setText(pillTime, m.connected ? hhmm(m.now) : 'sinds ' + hhmm(offlineSince));
      } else setText(pillTime, hhmm(m.now));
      // Datum en buitentemperatuur naast de tijd (immersive Home; alleen met verbinding en alleen echte waarden).
      if (pillExtra) { const t = m.connected ? options.pillExtra(m) : ''; setText(pillExtra, t || ''); pillExtra.hidden = !t; }
      for (const [sid, b] of Object.entries(SB)) if (b.getAttribute('aria-pressed') !== String(sid === scenario)) b.setAttribute('aria-pressed', String(sid === scenario));
      setData(rootEl, 'activeScenario', scenario);
      applyRoutes();
      if (openKey) fillDetail(openKey);
    }
    function compute() {
      const input = LIVE ? (liveInput || { now: Date.now(), live: true, connected: true, states: {}, specs: options.specs }) : M.scenarioInput(scenario, Date.now(), tick);
      model = M.computeModel(input, model); render();
    }

    // ---------------- detailpaneel
    const ROUTES_FOR = { pv: ['sun-home'], battery: [], house: ['sun-home', 'grid-home', 'home-grid', 'home-ev'], practice: ['home-practice'], net: ['grid-home', 'home-grid'], cupra: ['home-ev'] };
    function fillDetail(key) {
      const d = model.tiles[key];
      setText(D.title, d.title);
      setText(D.value, (key === 'net' ? M.netPresentation(model).value : d.value) + (key === 'cupra' ? ' · accu ' + d.soc : ''));
      const rows = [['Status', d.sub], [LIVE ? 'Entiteit' : 'Bron (DEMO-label)', d.entity || '—']];
      if (key === 'cupra' && LIVE) rows.push(['Accuniveau', d.soc + (d.socReason && d.socReason !== 'Actueel' ? ' · ' + d.socReason : '') + (d.socEntity ? ' (' + d.socEntity + ')' : '')]);
      if (LIVE && model.readings) { const rk = { pv: 'pv', house: 'house', net: 'net', cupra: 'ev', battery: 'battery', practice: 'practice' }[key]; const rd = rk && model.readings[rk]; if (rd && rd.stampSource) rows.push(['Tijdstempel', rd.stampSource + (Number.isFinite(rd.stampMs) ? ' · ' + hms(rd.stampMs) : '') + (Number.isFinite(rd.ageMs) ? ' · ' + M.ageLabel(rd.ageMs) : '') + ' — tijdstip van de HA-statusmelding, geen bewezen fysieke meettijd']); }
      if (key === 'net') {
        const na = model.routes['grid-home'].active || model.routes['home-grid'].active;
        rows.push(['Richting', !na && (d.direction === 'import' || d.direction === 'export') ? 'Niet bevestigd: netroute staat stil (' + model.routes['home-grid'].reason + ')' : d.direction === 'import' ? '↑ Afname van het net (oranje lichtpunten, net → huis)' : d.direction === 'export' ? '↓ Teruglevering aan het net (cyaan lichtpunten, huis → net)' : d.direction === 'balance' ? 'In balans: geen stroomrichting' : 'Onbekend: geen stroomrichting']);
        rows.push(['P1-tekenconfiguratie', model.p1Sign === 'export_positive' ? 'Export positief (gecorrigeerd)' : 'Import positief']);
        // RC2: de ondertekende ruwe sensortekst blijft zichtbaar voor diagnose, ook als de kaart geen richting toont.
        const raw = model.readings && model.readings.net && model.readings.net.raw;
        rows.push(['Ruwe P1-sensorwaarde', raw ? (raw.state + (raw.unit ? ' ' + raw.unit : '') + ' (zoals de bron meldt, vóór tekenconfiguratie)') : '—']);
      }
      if (key === 'battery') rows.push(['Let op', 'Virtuele batterij: rekensimulatie, geen fysieke opslag en geen stroomroute.']);
      if (key === 'practice') rows.push(['Let op', d.tone === 'sim' ? 'Gesimuleerde waarde, niet gemeten.' : 'Echte submeter; al onderdeel van het huisverbruik, niet dubbel opgeteld.']);
      if (key === 'house') rows.push(['Balans (rekenkundig)', model.balanceInfo || model.balance]);
      for (const rid of ROUTES_FOR[key]) { const r = model.routes[rid]; rows.push([ROUTE[rid].label, r.active ? 'Actief · ' + M.formatPower(r.watts) : 'Inactief · ' + r.reason]); }
      if (ROUTES_FOR[key].length) rows.push(['Lichtlijn in beeld', 'Decoratief — geen actuele stroomindicator']);
      const frag = doc.createDocumentFragment();
      for (const [k, v] of rows) { const dt = doc.createElement('dt'); dt.textContent = k; const dd = doc.createElement('dd'); dd.textContent = v; frag.append(dt, dd); }
      D.list.replaceChildren(frag);
    }
    function openDetail(key, btn) {
      if (openKey) T[openKey].b.setAttribute('aria-expanded', 'false');
      openKey = key; opener = btn; fillDetail(key);
      detail.hidden = false; detail.dataset.key = key; btn.setAttribute('aria-expanded', 'true'); D.close.focus();
    }
    function closeDetail(restore = true) {
      if (!openKey) return;
      T[openKey].b.setAttribute('aria-expanded', 'false'); detail.hidden = true; openKey = null;
      if (restore && opener && opener.isConnected) opener.focus();
      opener = null;
    }
    on(tiles, 'click', e => { const b = e.target.closest('.tile'); if (!b) return; const k = b.dataset.key; if (NAV) { closeDetail(false); options.onTileNavigate(k); return; } if (openKey === k) closeDetail(); else openDetail(k, b); });
    // Immersive portret: de glasvlakken op de master zijn óók aantikbaar (pointer/touch). Toetsenbord en schermlezer
    // gebruiken de routekaarten eronder (zelfde bestemming); de vlakken blijven aria-hidden.
    if (NAV) on(covers, 'click', e => { if (layout !== 'list') return; const p = e.target.closest('.ehm-plate'); if (p && KEYS.includes(p.dataset.key)) options.onTileNavigate(p.dataset.key); });
    on(D.close, 'click', () => closeDetail());
    on(rootEl, 'keydown', e => { if (e.key === 'Escape' && openKey) { e.preventDefault(); e.stopPropagation(); closeDetail(); } });
    const docListeners = [['pointerdown', e => { if (!openKey) return; const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target]; if (!path.includes(detail) && !path.some(n => n && n.classList && n.classList.contains('tile'))) closeDetail(false); }]];
    on(group, 'click', e => { const b = e.target.closest('[data-scenario]'); if (!b) return; scenario = b.dataset.scenario; tick = 0; model = null; compute(); });
    on(play, 'click', () => { const onNow = play.getAttribute('aria-pressed') !== 'true'; play.setAttribute('aria-pressed', String(onNow)); play.textContent = onNow ? 'Schommeling aan' : 'Schommeling uit'; setTicker(); });
    const onVis = () => { setTicker(); kick(); };
    docListeners.push(['visibilitychange', onVis]);
    const attachDoc = () => docListeners.forEach(([ty, fn]) => doc.addEventListener(ty, fn));
    const detachDoc = () => docListeners.forEach(([ty, fn]) => doc.removeEventListener(ty, fn));
    attachDoc();
    const onReduced = () => kick();
    if (reduced.addEventListener) { reduced.addEventListener('change', onReduced); listeners.push(() => reduced.removeEventListener('change', onReduced)); }
    function setTicker() {
      const want = !LIVE && !destroyed && !suspended && options.ticker !== false && play.getAttribute('aria-pressed') === 'true' && !doc.hidden;
      if (want && !ticker) ticker = win.setInterval(() => { tick++; compute(); }, options.intervalMs || 2500);
      if (!want && ticker) { win.clearInterval(ticker); ticker = 0; }
    }

    // ---------------- start
    // Beeldbron: DEMO = master uit de repository; LIVE = options.resolveImage() (bijv. een geauthenticeerde,
    // tijdelijk getekende Media Source-URL). Bij een laadfout één keer opnieuw oplossen (verlopen handtekening),
    // daarna veilige terugval: alleen interface.
    // RC2: ontkoppeld (suspend) ⇒ geen nieuwe aanvraag en geen vervolgactie op een lopende aanvraag; die wordt bij
    // resume() opnieuw gestart als het beeld toen nog niet geladen was.
    function loadImage() {
      if (destroyed) return;
      if (suspended && options.resolveImage) { imgPending = true; return; }
      imgPending = false;
      const job = ++imgJob;
      if (!options.resolveImage) { img.src = base + S.image.file; return; }
      imgInFlight = true;
      Promise.resolve().then(() => options.resolveImage()).then(url => {
        if (destroyed || job !== imgJob) return;
        imgInFlight = false;
        if (!url) { sceneState('error', options.imageMissingText || 'Geen beeld beschikbaar — alleen interface'); scheduleGeo(); return; }
        img.src = url;
      }, () => { if (destroyed || job !== imgJob) return; imgInFlight = false; sceneState('error', 'Beeld kon niet worden opgehaald — alleen interface'); scheduleGeo(); });
    }
    if (sceneOk) {
      on(img, 'load', () => { imgRetry = 0; onImageLoad(); if (options.onImageLoad) { try { options.onImageLoad(img); } catch (e) { /* alleen presentatie */ } } });
      on(img, 'error', () => {
        if (destroyed) return;
        if (options.resolveImage && imgRetry < 1) { imgRetry++; loadImage(); return; }
        sceneState('error', 'Beeldlaag kon niet laden — alleen interface'); scheduleGeo();
      });
      loadImage();
    } else sceneState('missing', 'Scènelaag ontbreekt — alleen interface');
    compute();
    scheduleGeo();
    setTicker();

    return {
      el: rootEl,
      get model() { return model; },
      get scenario() { return scenario; },
      get layout() { return layout; },
      get live() { return LIVE; },
      /** Weergave opnieuw bepalen (bijv. na een gewijzigde immersive portretstand); één rAF, geen volledige render. */
      /** Kaartteksten opnieuw bepalen zonder nieuwe invoer (bijv. wanneer dagtotalen binnenkomen). */
      rerender() { if (model && !destroyed) render(); },
      relayout(now) { if (now && !destroyed && !suspended) { if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0; geometry(); } else scheduleGeo(); },
      setScenario(s) { if (!LIVE && M.SCENARIO_IDS.includes(s)) { scenario = s; tick = 0; model = null; compute(); } },
      /** LIVE: nieuwe model-invoer van de HA-adapter (alleen bij gewijzigde data aanroepen). */
      setInput(input) { if (!LIVE || destroyed) return; liveInput = input; compute(); },
      /** LIVE: na een mislukte beeldlaag opnieuw proberen (bijv. na herstel van de verbinding). Begrensd: alleen in
       *  de foutstand en met één extra poging bij een laadfout. Een geladen beeld blijft staan (geen nieuwe aanvraag). */
      retryImage() { if (!LIVE || destroyed || !sceneOk || !options.resolveImage || rootEl.dataset.scene !== 'error') return false; imgRetry = 0; loadImage(); return true; },
      /** Ontkoppeld (bijv. kaart uit de DOM): alle timers, rAF, observers en documentlisteners stoppen; DOM blijft. */
      suspend() {
        if (suspended || destroyed) return; suspended = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect(); detachDoc();
        if (imgInFlight) { imgJob++; imgInFlight = false; imgPending = true; }   // laat antwoord wordt genegeerd
      },
      resume() {
        if (!suspended || destroyed) return; suspended = false;
        attachDoc(); ro.observe(rootEl); ro.observe(stage);
        scheduleGeo(); setTicker(); kick();
        if (imgPending) loadImage();
      },
      get suspended() { return suspended; },
      step() { tick++; compute(); },
      setPaused(v) { paused = !!v; if (paused && raf) { win.cancelAnimationFrame(raf); raf = 0; } kick(); },
      isAnimating: () => !!raf,
      phases: fid => { const p = PF.find(x => x.id === fid); return p ? p.phase.slice() : null; },
      particleInfo: () => PF.map(p => ({ id: p.id, active: p.active, route: p.route, dir: p.dir, color: p.active ? p.color : null })),
      destroy() {
        destroyed = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect(); detachDoc(); imgJob++;
        listeners.splice(0).forEach(off => off());
        rootEl.remove();
      }
    };
  }

  root.EhPve04Master = Object.freeze({ createMasterCockpit, splitValue, ROUTE, OVERLAY_MIN });
})(scope);
 /* ---- ha/contract.js (preview/pve-04/ha/contract.js @ be0b299, sha256 6e6294b6ecbe2e7c1f7a63f53e9bd4456a8de0eab0d18aec3e1929390eff98cb) ---- */
/* Energiehuis PVE-04 · ha/contract.js — Home Assistant-datacontract voor de LIVE-cockpit (HA-01, alleen-lezen).
 *
 * Hergebruikt de configuratiesleutels en standaard-entiteiten van de productiekaart (src/legacy/00-foundation.js
 * EH_DEFAULTS, README-configuratie) zonder die te wijzigen.
 *
 * Twee versheidsgrenzen per bron (RC1-A):
 *   ttlS       — TONEN: hoe lang een laatste waarde zichtbaar mag blijven. Volgt de productiecockpit
 *                (src/legacy/16-regisseur-cockpit.js: P1/huis 5 min, GoodWe/Alfen 35 min, Cupra 90 min). De productie
 *                gebruikt deze grenzen alleen voor tegels en balkjes ("Geen energiebalans"), NIET voor een live animatie.
 *   routeTtlS  — BEWEGEN: hoe recent een vermogensmeting bevestigd moet zijn voor een actieve route, bewegende
 *                lichtpunten en de balanscontrole. Bewust conservatief (P1/huis 60 s, GoodWe/Alfen 90 s) zolang de
 *                werkelijke updatefrequenties in Home Assistant niet zijn gemeten. Per bron instelbaar met route_ttl_s.
 *                VOORLOPIG (RC2): 60/90 s zijn configuratiewaarden, geen meetresultaten.
 *   Tijdstempel  — last_reported/last_updated is het tijdstip van de HA-STATUSMELDING, niet de fysieke meettijd in de
 *                meter of omvormer (polling, buffering en integratievertraging zitten ertussen). "Bevestigd in code" ≠ "bevestigd in een echte Home Assistant": de status van
 * elke bron in een echte installatie is ONBEVESTIGD totdat een afzonderlijk goedgekeurde HA-test is uitgevoerd.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhHaContract = api;
})(scope, function () {
  'use strict';

  const SOURCES = Object.freeze({
    net: Object.freeze({ config: 'net', default: 'sensor.p1_meter_vermogen', kind: 'power', ttlS: 300, routeTtlS: 60, stable: false, label: 'P1-netvermogen',
      sign: 'positief = netafname, negatief = teruglevering (productie: "Netafname positief, teruglevering negatief"); omkeerbaar met p1_sign',
      basis: 'EH_DEFAULTS.net · README · cockpit-TTL 5 min', ha: 'onbevestigd' }),
    pv: Object.freeze({ config: 'zonnepanelen', default: 'sensor.goodwe_pv_power', kind: 'power', ttlS: 2100, routeTtlS: 90, stable: true, label: 'GoodWe PV-vermogen',
      sign: '≥ 0; negatief wordt genegeerd', basis: 'EH_DEFAULTS.zonnepanelen · cockpit-TTL 35 min, stabiele 0 W als laatste stand', ha: 'onbevestigd' }),
    house: Object.freeze({ config: 'huis', default: 'sensor.energiehuis_huisverbruik_exclusief_auto', kind: 'power', ttlS: 300, routeTtlS: 60, stable: false, label: 'Huisverbruik exclusief auto',
      sign: '≥ 0; < −50 W = ongeldig', definition: 'netafname − teruglevering + zonopwek − autoladen (productie-uitleg 02-card-shell.js); de definitie van de HA-template zelf is niet in de repository vastgelegd',
      basis: 'EH_DEFAULTS.huis · cockpit-TTL 5 min', ha: 'onbevestigd (template-definitie onbekend)' }),
    ev: Object.freeze({ config: 'laden', default: 'sensor.alfen_actief_vermogen_totaal', kind: 'power', ttlS: 2100, routeTtlS: 90, stable: true, label: 'Alfen laadvermogen',
      sign: '≥ 0; < −30 W of > 11,5 kW = ongeldig', basis: 'EH_DEFAULTS.laden · cockpit-TTL 35 min, stabiele 0 W als laatste stand', ha: 'onbevestigd' }),
    soc: Object.freeze({ config: 'cupra', default: 'sensor.garage_cupra_born_accuniveau', kind: 'percent', ttlS: 5400, routeTtlS: 5400, stable: true, label: 'Cupra Born accuniveau',
      sign: '0–100 %', basis: 'EH_DEFAULTS.cupra · cockpit-TTL 90 min, laatste stand toegestaan', ha: 'onbevestigd' }),
    battery: Object.freeze({ config: 'batterij', default: 'sensor.virtuele_batterij_soc', kind: 'percent', ttlS: 5400, routeTtlS: 5400, stable: true, label: 'Virtuele batterij (SIMULATIE)',
      sign: '0–100 %; rekensimulatie, geen fysieke opslag en nooit een stroomroute', basis: 'EH_DEFAULTS.batterij / battery_soc · TTL 90 min (gelijk aan Cupra-SOC; niet in productie-cockpit)', ha: 'onbevestigd' }),
    practice: Object.freeze({ config: 'praktijk', default: '', kind: 'power', ttlS: 300, routeTtlS: 60, stable: false, label: 'Praktijkruimte (toekomstige submeter)',
      sign: '—', basis: 'Nog geen meting. In HA-01 bewust NIET koppelbaar: een geconfigureerde waarde wordt genegeerd tot een aparte opdracht.', ha: 'niet gekoppeld' })
  });

  const P1_SIGNS = Object.freeze(['import_positive', 'export_positive']);
  // Instelbare route-TTL (seconden) alleen voor vermogensbronnen met een route of balansrol.
  const ROUTE_TTL_KEYS = Object.freeze(['net', 'pv', 'house', 'ev']);
  const ROUTE_TTL_MIN_S = 5;
  // RC1-B: maximale spreiding (s) tussen de bron-tijdstempels van P1, PV, Alfen en huis waarbinnen de balans als
  // "voldoende synchroon" geldt. Conservatief klein: alleen dan mag een afwijking als KRITIEK worden gemeld.
  // VOORLOPIG (RC2): 10 s is geen gemeten waarde. De tijdstempels zijn HA-statusmeldingen (last_reported >= last_updated),
  // geen bewezen fysieke meettijd; synchroniciteit van bronmeldingen is dus een benadering tot echte HA-data is onderzocht.
  const BALANCE_SKEW_DEFAULT_S = 10, BALANCE_SKEW_MIN_S = 1, BALANCE_SKEW_MAX_S = 120;
  const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
  const IMAGE_RE = /^media-source:\/\/media_source\/[A-Za-z0-9_\-./ ]+\.(webp|jpe?g|png)$/;

  /**
   * Leest een kaartconfiguratie (zelfde sleutels als de productiekaart) zonder iets te wijzigen.
   * Onbekende sleutels worden genegeerd (geen fout), zodat bestaande configuraties ongewijzigd bruikbaar blijven.
   */
  function normalizeConfig(cfg) {
    const c = cfg && typeof cfg === 'object' ? cfg : {};
    const errors = [], notes = [], entities = {};
    for (const [key, s] of Object.entries(SOURCES)) {
      let id = c[s.config] === undefined ? s.default : c[s.config];
      if (id === '' || id === null) { entities[key] = null; continue; }
      if (typeof id !== 'string' || !ENTITY_RE.test(id)) { errors.push(`${s.config}: ongeldige entiteit-ID`); entities[key] = null; continue; }
      entities[key] = id;
    }
    const p1Sign = c.p1_sign === undefined ? 'import_positive' : c.p1_sign;
    if (!P1_SIGNS.includes(p1Sign)) errors.push('p1_sign: alleen import_positive of export_positive');
    let image = c.image === undefined ? '' : c.image;
    if (image && (typeof image !== 'string' || !IMAGE_RE.test(image) || image.includes('..'))) { errors.push('image: alleen een media-source://media_source/…-ID (webp/jpg/png)'); image = ''; }
    // route_ttl_s: { net: 60, zonnepanelen: 90, huis: 60, laden: 90 } (sleutels als de productieconfiguratie)
    const routeTtl = {};
    for (const k of Object.keys(SOURCES)) routeTtl[k] = SOURCES[k].routeTtlS;
    const rt = c.route_ttl_s;
    if (rt !== undefined) {
      if (!rt || typeof rt !== 'object' || Array.isArray(rt)) errors.push('route_ttl_s: verwacht { net, zonnepanelen, huis, laden: seconden }');
      else for (const [ck, v] of Object.entries(rt)) {
        const key = ROUTE_TTL_KEYS.find(k => SOURCES[k].config === ck);
        if (!key) { errors.push(`route_ttl_s.${ck}: onbekende bron (alleen net, zonnepanelen, huis, laden)`); continue; }
        const max = SOURCES[key].ttlS;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < ROUTE_TTL_MIN_S || v > max) { errors.push(`route_ttl_s.${ck}: ${ROUTE_TTL_MIN_S}–${max} s (nooit langer dan de toon-TTL)`); continue; }
        routeTtl[key] = v;
      }
    }
    let skew = c.balance_max_skew_s === undefined ? BALANCE_SKEW_DEFAULT_S : c.balance_max_skew_s;
    if (typeof skew !== 'number' || !Number.isFinite(skew) || skew < BALANCE_SKEW_MIN_S || skew > BALANCE_SKEW_MAX_S) { errors.push(`balance_max_skew_s: ${BALANCE_SKEW_MIN_S}–${BALANCE_SKEW_MAX_S} s`); skew = BALANCE_SKEW_DEFAULT_S; }
    return Object.freeze({ entities: Object.freeze(entities), p1Sign: P1_SIGNS.includes(p1Sign) ? p1Sign : 'import_positive', image, routeTtl: Object.freeze(routeTtl), balanceMaxSkewS: skew, errors: Object.freeze(errors), notes: Object.freeze(notes) });
  }

  /** Specificaties voor model.computeModel (input.specs). */
  function modelSpecs(norm) {
    const out = {};
    for (const [key, s] of Object.entries(SOURCES)) out[key] = Object.freeze({ entity: norm.entities[key], ttlS: s.ttlS, routeTtlS: Math.min(s.ttlS, norm.routeTtl ? norm.routeTtl[key] : s.routeTtlS), stable: s.stable });
    return Object.freeze(out);
  }

  // RC2: expliciet voorlopig — bij te stellen na meting in een afzonderlijk goedgekeurde, alleen-lezen HA-test.
  const PROVISIONAL = Object.freeze({ routeTtlS: true, balanceMaxSkewS: true, timestampsAreHaReports: true });
  return Object.freeze({ SCHEMA: 'energiehuis.ha-contract/1', PROVISIONAL, SOURCES, P1_SIGNS, ROUTE_TTL_KEYS, BALANCE_SKEW_DEFAULT_S, normalizeConfig, modelSpecs, ENTITY_RE, IMAGE_RE });
});
 /* ---- ha/adapter.js (preview/pve-04/ha/adapter.js @ be0b299, sha256 a0fe196aab0bbad97aa3dc4698de8ea47d45611eb3fb6ce9e5159ff4d9728383) ---- */
/* Energiehuis PVE-04 · ha/adapter.js — alleen-lezen Home Assistant-data-adapter (HA-01).
 *
 * Leest uitsluitend het bestaande frontendcontract: het `hass`-object dat Home Assistant aan een Lovelace-kaart
 * geeft (`hass.states`, `hass.connected`). Geen tokens, geen REST, geen polling, geen servicecalls, geen opslag.
 * De state-objecten gaan ONGEWIJZIGD naar model.js; daar gebeuren eenheden (W/kW, %), tekenrichting en versheid
 * (bron-tijdstempel last_reported ≥ last_updated ≥ last_changed; nooit een eigen tijdstempel).
 */
(function (root, factory) {
  const api = factory(root.EhHaContract || (typeof require === 'function' ? require('./contract.js') : null), root.EhPve04Model || (typeof require === 'function' ? require('../model.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhHaAdapter = api;
})(scope, function (C, M) {
  'use strict';

  const KEYS = ['net', 'pv', 'house', 'ev', 'soc', 'battery', 'practice'];
  const RECHECK_MAX_MS = 60000;   // leeftijdslabels ("3 min") minstens elke minuut bijwerken

  function createAdapter(config) {
    const norm = C.normalizeConfig(config);
    const specs = C.modelSpecs(norm);
    const watched = KEYS.filter(k => norm.entities[k]).map(k => [k, norm.entities[k]]);
    let lastRefs = null, lastConnected = null;

    /** true als een bewaakte entiteit (ander state-object) of de verbinding is veranderd sinds de vorige aanroep. */
    function changed(hass) {
      const connected = !!hass && hass.connected !== false;
      const refs = watched.map(([, id]) => hass && hass.states ? hass.states[id] : undefined);
      const diff = !lastRefs || connected !== lastConnected || refs.some((r, i) => r !== lastRefs[i]);
      lastRefs = refs; lastConnected = connected;
      return diff;
    }

    /** Model-invoer. Ontbrekende entiteit ⇒ { missing: true } (zichtbaar ontbrekend, nooit 0). */
    function input(hass, now) {
      const states = {};
      for (const [k, id] of watched) {
        const st = hass && hass.states ? hass.states[id] : undefined;
        states[k] = st ? st : { missing: true };
      }
      return {
        now, live: true, balanceMaxSkewS: norm.balanceMaxSkewS,
        connected: !!hass && hass.connected !== false,
        config: { p1Sign: norm.p1Sign },
        specs, states,
        cupra: { label: 'Laden', idleLabel: 'Niet aan het laden' }
      };
    }

    /** Wanneer moet opnieuw worden beoordeeld zonder nieuwe HA-update? (eerstvolgende route- of toon-TTL-grens, max. 60 s) */
    function nextCheckMs(hass, now) {
      let next = now + RECHECK_MAX_MS;
      for (const [k, id] of watched) {
        const st = hass && hass.states ? hass.states[id] : undefined; if (!st) continue;
        const f = M.freshness(st); if (!Number.isFinite(f.t)) continue;
        // beide grenzen: route-TTL (lichtpunten stoppen) en toon-TTL (waarde verdwijnt of wordt "laatste stand")
        for (const ttl of [specs[k].routeTtlS, specs[k].ttlS]) {
          const exp = f.t + ttl * 1000 + 1;
          if (exp > now && exp < next) next = exp;
        }
      }
      return Math.max(250, next - now);
    }

    /** Overzicht per bron voor detailpanelen en tests: entiteit, tijdstempelbron, TTL. */
    function describe(hass) {
      return KEYS.map(k => {
        const id = norm.entities[k], st = id && hass && hass.states ? hass.states[id] : undefined, f = st ? M.freshness(st) : { source: null };
        return { key: k, entity: id, present: !!st, stampSource: f.source, ttlS: specs[k].ttlS, routeTtlS: specs[k].routeTtlS, contract: C.SOURCES[k].ha };
      });
    }

    return Object.freeze({ config: norm, specs, watched: watched.map(w => w[1]), changed, input, nextCheckMs, describe });
  }

  return Object.freeze({ createAdapter, KEYS });
});
 })(undefined,undefined);
 /* ---- styles.css (preview/pve-04/styles.css @ be0b299, sha256 2f4fb110aef42fdeb8c95a0a79215fbdea21cab27261f4377a9c97ca74bcf782; zonder pagina-regels html/body/.page) ---- */
 const LIVE_CSS="/* Energiehuis PVE-04 · styles.css — Cinematic Energy Experience (DEMO). */\n:root, :host {\n  color-scheme: dark;\n  --bg: #070a11;\n  --bg-2: #0d121c;\n  --glass: rgba(12, 16, 26, 0.58);\n  --glass-hi: rgba(22, 28, 42, 0.72);\n  --line: rgba(255, 255, 255, 0.14);\n  --line-hi: rgba(255, 255, 255, 0.32);\n  --text: #f4f6f9;\n  --muted: #b4bccb;\n  --dim: #8590a3;\n  --sun: #ffc23d;\n  --import: #ff8a5b;\n  --export: #4be38a;\n  --ev: #33ddff;\n  --cupra: #3ee05a;\n  --practice: #2fd4c0;\n  --battery: #b07cff;\n  --warn: #ffb547;\n  --bad: #ff6b6b;\n  --radius: 1.15rem;\n  --font: \"Inter\", \"SF Pro Display\", -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n}\n* { box-sizing: border-box; }\n\n/* ---------------- cockpit shell */\n.ehc { position: relative; container-type: inline-size; margin: 0 auto 2rem; }\n/* Desktop: houd de volledige 16:9-scène binnen de viewporthoogte (tekst mag de scène wel laten groeien). */\n@media (min-width: 700px) { .ehc { max-width: max(44rem, calc((100svh - 7.5rem) * 16 / 9)); } }\n.ehc + .ehc { margin-top: 2rem; }\n.ehc-head { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; margin-bottom: .75rem; }\n.ehc-brand { flex: 1 1 auto; min-width: 0; }\n.ehc-title { margin: 0; font-size: 1.35rem; font-weight: 650; letter-spacing: -.01em; }\n.ehc-title span { color: var(--muted); font-weight: 450; }\n.ehc-demo {\n  margin: 0; padding: .35rem .75rem; border-radius: 999px; font-size: .8rem; font-weight: 650; letter-spacing: .02em;\n  color: #1b1200; background: var(--warn); box-shadow: 0 0 0 1px rgba(255,181,71,.4), 0 6px 20px rgba(255,181,71,.18);\n}\n.ehc-scene-note {\n  margin: 0; padding: .3rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 600;\n  color: #ffe2b0; background: rgba(255,181,71,.12); border: 1px dashed rgba(255,181,71,.7);\n}\n.ehc-scene-note[hidden] { display: none; }\n/* Terugval: geen of kapotte scènelaag ⇒ rustige gradient, interface blijft volledig werken. */\n.ehc[data-scene=\"missing\"] .ehc-stage, .ehc[data-scene=\"error\"] .ehc-stage { background: radial-gradient(120% 90% at 50% 20%, #2a2440 0%, #121722 70%); }\n.ehc-scene[hidden], .ehc-flows[hidden], .ehc-lights[hidden] { display: none; }\n.ehc[data-scene=\"invalid\"] .ehc-stage { background: radial-gradient(120% 90% at 50% 20%, #2a2440 0%, #121722 70%); }\n.ehc-lights, .ehc-light { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }\n.ehc-light { object-fit: cover; object-position: 50% 50%; opacity: .9; }\n.ehc-status { margin: 0; font-size: .82rem; color: var(--muted); }\n.ehc-status[data-tone=\"bad\"] { color: var(--bad); }\n.ehc-status[data-tone=\"warn\"] { color: var(--warn); }\n\n/* ---------------- stage: scene + overlays */\n.ehc-stage {\n  position: relative; display: grid; border-radius: 1.6rem; overflow: hidden; isolation: isolate;\n  background: #121722; box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06);\n}\n/* Minimale hoogte = beeldverhouding van de scène; grotere tekst laat de scène meegroeien. */\n.ehc-stage { grid-template-columns: minmax(0, 1fr); }\n.ehc-stage::before { content: \"\"; grid-area: 1 / 1; aspect-ratio: 16 / 9; }\n.ehc-tiles { grid-area: 1 / 1; }\n.ehc-scene, .ehc-scene img { position: absolute; inset: 0; width: 100%; height: 100%; }\n.ehc-scene img { object-fit: cover; object-position: 50% 50%; display: block; }\n.ehc-shade {\n  position: absolute; inset: 0; pointer-events: none;\n  background:\n    linear-gradient(to bottom, rgba(6,8,16,.55) 0%, rgba(6,8,16,0) 24%),\n    linear-gradient(to top, rgba(6,8,16,.62) 0%, rgba(6,8,16,0) 30%);\n}\n.ehc-flows { position: absolute; inset: 0; pointer-events: none; z-index: 1; }\n.ehc-flows svg, .ehc-flows canvas { position: absolute; left: 0; top: 0; }\n/* Eigen compositielaag: de (statische, gemaskeerde) SVG-routelaag wordt niet elk frame opnieuw gerasterd\n   doordat het deeltjescanvas erboven verandert. Gemeten in tests/perf.cjs. */\n.ehc-flows svg, .ehc-flows canvas { will-change: transform; }\n\n.route path { fill: none; stroke-linecap: round; stroke-linejoin: round; transition: opacity .7s ease, stroke-width .7s ease; }\n.route .r-groove { stroke: rgba(0,0,0,.35); stroke-width: 7; opacity: 0; }\n.route .r-glow { stroke: var(--route); stroke-width: 12; opacity: 0; filter: blur(5px); }\n.route .r-core { stroke: var(--route); stroke-width: 2; opacity: 0; }\n.route .r-chev path { stroke: var(--route); stroke-width: 2.4; opacity: 0; }\n.route[data-active=\"true\"] .r-groove { opacity: 1; }\n.route[data-active=\"true\"] .r-glow { opacity: calc(.18 + var(--i, 0) * .3); }\n.route[data-active=\"true\"] .r-core { opacity: .9; stroke-width: calc(2px + var(--i, 0) * 2.5px); }\n.route[data-active=\"true\"] .r-chev path { opacity: .95; }\n.route.is-sim .r-core { stroke-dasharray: 7 7; }\n\n/* ---------------- tiles */\n.ehc-tiles {\n  position: relative; z-index: 2; display: grid; gap: .75rem; padding: clamp(.75rem, 1.6cqi, 1.5rem);\n  /* Naar de goedgekeurde referentie: kaarten zweven naast de objecten, niet eroverheen. */\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr);\n  grid-template-rows: auto auto minmax(0, 1fr) auto;\n  grid-template-areas: \"pv . .\" \"practice . cupra\" \". house .\" \"battery net .\";\n  min-height: 100%;\n}\n.tile[data-key=\"pv\"] { grid-area: pv; justify-self: start; align-self: start; margin-left: 6%; margin-top: 4%; }\n.tile[data-key=\"battery\"] { grid-area: battery; justify-self: start; align-self: end; }\n.tile[data-key=\"house\"] { grid-area: house; justify-self: center; align-self: end; margin-bottom: 3%; }\n.tile[data-key=\"practice\"] { grid-area: practice; justify-self: start; align-self: end; }\n.tile[data-key=\"net\"] { grid-area: net; justify-self: center; align-self: end; }\n.tile[data-key=\"cupra\"] { grid-area: cupra; justify-self: end; align-self: end; margin-right: 6%; }\n\n.tile {\n  --accent: var(--text);\n  display: flex; flex-wrap: wrap; align-items: flex-start; gap: .6rem; min-width: 0; max-width: min(100%, 15rem); min-height: 48px;\n  padding: .6rem .8rem .65rem .65rem; border-radius: var(--radius); border: 1px solid var(--line);\n  background: var(--glass); color: inherit; font: inherit; text-align: left; cursor: pointer;\n  -webkit-backdrop-filter: blur(16px) saturate(150%); backdrop-filter: blur(16px) saturate(150%);\n  box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);\n  transition: background .2s ease, border-color .2s ease, transform .2s ease;\n}\n.tile:hover { background: var(--glass-hi); border-color: var(--line-hi); }\n.tile:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }\n.tile[aria-expanded=\"true\"] { border-color: var(--accent); background: var(--glass-hi); }\n.t-icon {\n  flex: none; display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border-radius: .8rem;\n  color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 38%, transparent);\n}\n.t-icon svg { width: 1.35rem; height: 1.35rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }\n.t-body { display: flex; flex-direction: column; flex: 1 1 6.5rem; min-width: 0; }\n.t-title { font-size: .72rem; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); overflow-wrap: anywhere; hyphens: auto; }\n.t-value { font-size: 1.5rem; font-weight: 650; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.1; margin-top: .1rem; overflow-wrap: normal; word-break: keep-all; }\n.t-extra { align-self: flex-start; margin-top: .3rem; padding: .1rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 650; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }\n.t-extra[hidden] { display: none; }\n.t-sub { margin-top: .25rem; font-size: .82rem; color: var(--muted); overflow-wrap: anywhere; }\n\n.tile[data-key=\"pv\"] { --accent: var(--sun); }\n.tile[data-key=\"battery\"] { --accent: var(--battery); }\n.tile[data-key=\"house\"] { --accent: #ffd9a8; }\n.tile[data-key=\"practice\"] { --accent: var(--practice); }\n.tile[data-key=\"cupra\"] { --accent: var(--cupra); }\n.tile[data-key=\"net\"] { --accent: var(--muted); }\n.tile[data-key=\"net\"][data-direction=\"import\"] { --accent: var(--import); }\n.tile[data-key=\"net\"][data-direction=\"export\"] { --accent: var(--export); }\n.tile[data-tone=\"muted\"] .t-value { color: var(--dim); }\n.tile[data-tone=\"warn\"] { border-color: rgba(255,181,71,.55); }\n.tile[data-tone=\"warn\"] .t-sub { color: var(--warn); }\n.tile[data-tone=\"bad\"] { border-color: rgba(255,107,107,.65); }\n.tile[data-tone=\"bad\"] .t-sub { color: var(--bad); }\n.tile[data-key=\"house\"] .t-value { font-size: 1.45rem; }\n\n/* ---------------- text below the stage */\n.ehc-summary { margin: .9rem .25rem .25rem; font-size: 1rem; color: var(--text); }\n.ehc-warn { margin: .5rem .25rem; padding: .6rem .8rem; border-radius: .8rem; background: rgba(255,107,107,.12); border: 1px solid rgba(255,107,107,.45); color: #ffd1d1; font-size: .9rem; }\n.ehc-warn[hidden] { display: none; }\n.ehc-warn[data-tone=\"warn\"] { background: rgba(255,181,71,.10); border-color: rgba(255,181,71,.5); color: #ffe2b0; }\n.ehc-controls { margin-top: 1rem; padding: 1rem; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); }\n.ehc-controls-title { margin: 0 0 .6rem; font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }\n.ehc-scenarios { display: flex; flex-wrap: wrap; gap: .5rem; }\n.chip {\n  min-height: 48px; padding: .55rem .95rem; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,.04);\n  color: var(--text); font: inherit; font-size: .88rem; cursor: pointer;\n}\n.chip:hover { border-color: var(--line-hi); }\n.chip[aria-pressed=\"true\"] { background: #f4f6f9; color: #0b0f17; border-color: #f4f6f9; font-weight: 650; }\n.chip:focus-visible, .d-close:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }\n.chip-play { margin-top: .75rem; }\n\n/* ---------------- detail panel */\n.ehc-detail {\n  position: absolute; z-index: 5; top: 3.5rem; right: 1rem; width: min(24rem, calc(100% - 2rem)); max-height: calc(100% - 4.5rem); overflow: auto;\n  padding: 1rem 1.1rem 1.1rem; border-radius: var(--radius); background: rgba(13,18,28,.94); border: 1px solid var(--line-hi);\n  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 24px 60px rgba(0,0,0,.6);\n}\n.ehc-detail[hidden] { display: none; }\n.d-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }\n.d-title { margin: 0; font-size: 1.1rem; }\n.d-close { flex: none; width: 48px; height: 48px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--text); font-size: 1.5rem; line-height: 1; cursor: pointer; }\n.d-value { margin: .35rem 0 .8rem; font-size: 1.6rem; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }\n.d-list { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); gap: .4rem .9rem; margin: 0; font-size: .88rem; }\n.d-list dt { color: var(--muted); }\n.d-list dd { margin: 0; overflow-wrap: anywhere; }\n.d-note { margin: .9rem 0 0; font-size: .78rem; color: var(--warn); }\n\n/* ---------------- tablet (container 700–979px): compactere tegels, scène blijft zichtbaar */\n@container (min-width: 700px) and (max-width: 979px) {\n  .ehc-tiles { gap: .5rem; padding: .7rem; }\n  .tile { max-width: 13.5rem; padding: .55rem .7rem .6rem .55rem; gap: .5rem; border-radius: .95rem; }\n  .t-icon { width: 1.9rem; height: 1.9rem; border-radius: .6rem; }\n  .t-icon svg { width: 1.1rem; height: 1.1rem; }\n  .t-title { font-size: .64rem; }\n  .t-value, .tile[data-key=\"house\"] .t-value { font-size: 1.3rem; }\n  .t-sub { font-size: .74rem; }\n  .t-extra { font-size: .66rem; }\n}\n/* ---------------- mobile composition (container < 700px) */\n@container (max-width: 699px) {\n  .ehc-title { font-size: 1.15rem; }\n  .ehc-stage { border-radius: 1.25rem; }\n  .ehc-stage::before { aspect-ratio: 9 / 16; }\n  /* Eigen mobiele compositie: zon + batterij boven in de lucht, huis midden op de gevel,\n     onderaan praktijk | Net (midden onder het huis) | Cupra op de bestrating. */\n  .ehc-tiles {\n    gap: .45rem; padding: .55rem;\n    grid-template-columns: repeat(6, minmax(0, 1fr));\n    grid-template-rows: auto minmax(0, 1fr) auto;\n    grid-template-areas:\n      \"pv pv pv battery battery battery\"\n      \"house house house house house house\"\n      \"practice practice net net cupra cupra\";\n  }\n  .tile { justify-self: stretch; max-width: 100%; padding: .55rem .6rem .6rem .55rem; gap: .5rem; border-radius: .95rem; }\n  .t-body { flex-basis: 4.5rem; }\n  .tile[data-key=\"practice\"], .tile[data-key=\"net\"], .tile[data-key=\"cupra\"] { flex-direction: column; gap: .3rem; padding: .5rem .5rem .55rem; }\n  .tile[data-key=\"practice\"] .t-icon, .tile[data-key=\"net\"] .t-icon, .tile[data-key=\"cupra\"] .t-icon { width: 1.7rem; height: 1.7rem; }\n  .tile[data-key=\"house\"] { justify-self: center; align-self: center; }\n  .t-icon { width: 2rem; height: 2rem; border-radius: .65rem; }\n  .t-icon svg { width: 1.15rem; height: 1.15rem; }\n  .t-title { font-size: .66rem; letter-spacing: .06em; }\n  .t-value { font-size: 1.3rem; }\n  .tile[data-key=\"house\"] .t-value { font-size: 1.2rem; }\n  .t-sub { font-size: .74rem; }\n  .t-extra { font-size: .66rem; }\n  .ehc-detail { position: fixed; top: auto; right: 0; left: 0; bottom: 0; width: auto; max-height: 72vh; border-radius: 1.25rem 1.25rem 0 0; }\n}\n@container (max-width: 379px) {\n  .ehc-tiles { grid-template-areas: \"pv pv pv battery battery battery\" \"house house house house house house\" \"practice practice practice cupra cupra cupra\" \"net net net net net net\"; grid-template-rows: auto minmax(0, 1fr) auto auto; }\n  .tile[data-key=\"net\"] { flex-direction: row; justify-self: center; min-width: 60%; }\n  .t-title { letter-spacing: .03em; }\n}\n@container (max-width: 339px) {\n  .t-icon { display: none; }\n  .t-value { font-size: 1.2rem; }\n}\n@media (max-width: 480px) {\n  .ehc-head { gap: .35rem .6rem; margin-bottom: .5rem; }\n  .ehc-brand { flex-basis: 100%; }\n  .ehc-demo { font-size: .74rem; padding: .25rem .6rem; }\n}\n\n/* Grote tekst (bijv. 200 %) op smalle schermen: rem schaalt mee met de tekstgrootte,\n   dus deze regel geldt alleen bij vergrote tekst. Eén kolom, niets afgekapt. */\n@container (max-width: 15rem) {\n  .ehc-tiles { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-template-areas: \"pv\" \"battery\" \"house\" \"practice\" \"net\" \"cupra\"; }\n  .tile, .tile[data-key=\"net\"] { justify-self: stretch; align-self: start; min-width: 0; flex-direction: row; }\n  .t-icon { display: none; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .route path, .tile { transition: none; }\n}\n\n/* ======================================================================================\n   Master-modus (standaard, RC2): de goedgekeurde afbeelding exact en ongewijzigd als vaste achtergrond.\n   --u = schaal van de master op het scherm (stagebreedte / 1330 px). Alle maten op de master schalen mee.\n   De lichtlijnen in de afbeelding zijn decoratief; actuele stroom = bewegende lichtpunten + kaarten.\n   ====================================================================================== */\n.ehc--master { --u: 1; --glass: rgba(16, 13, 18, .55); --tint-top: #2b2529; --tint-bot: #1e1b20; }\n@media (min-width: 700px) { .ehc--master { max-width: max(44rem, calc((100svh - 7.5rem) * 1330 / 748)); } }\n.ehm-frame { position: relative; }\n.ehm-stage {\n  position: relative; aspect-ratio: 1330 / 748; border-radius: 1.6rem; overflow: hidden; isolation: isolate;\n  background: #121722; box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06);\n}\n.ehm-scene { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; -webkit-user-drag: none; }\n.ehc--master[data-scene=\"missing\"] .ehm-stage, .ehc--master[data-scene=\"error\"] .ehm-stage { display: none; }\n.ehm-particles { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; will-change: transform; }\n.ehm-covers { position: absolute; inset: 0; z-index: 3; pointer-events: none; }\n\n/* Gedeeld glas: ONDOORZICHTIG basisvlak (kleurverloop uit de omgeving, in de browser bemonsterd) + halfdoorzichtige\n   glaslaag. De ingebakken kaart eronder kan zo nooit doorschijnen. */\n.ehm-cover, .ehc--master:not([data-layout=\"list\"]) .ehm-tiles .tile {\n  position: absolute; left: calc(var(--x) * 100%); top: calc(var(--y) * 100%); width: calc(var(--w) * 100%); height: calc(var(--h) * 100%);\n  background: linear-gradient(var(--glass), var(--glass)), linear-gradient(180deg, var(--tint-top), var(--tint-bot));\n  -webkit-backdrop-filter: none; backdrop-filter: none;\n}\n.ehm-cover {\n  display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 10px); overflow: hidden;\n  border-radius: calc(var(--u) * 24px); border: 1px solid rgba(255,255,255,.16); color: var(--text); font-weight: 650; white-space: nowrap;\n  box-shadow: inset 0 1px 0 rgba(255,255,255,.10);\n}\n.ehm-plate { display: none; color: var(--accent, #ccc); }\n.ehm-plate svg { width: 42%; height: 42%; max-width: 28px; fill: none; stroke: currentColor; stroke-width: 1.6; opacity: .75; }\n.ehc--master[data-layout=\"list\"] .ehm-plate { display: flex; }\n.ehm-pill { font-size: max(8px, calc(var(--u) * 20px)); border-radius: 999px; }\n.ehm-pill .p-demo { padding: .1em .55em; border-radius: 999px; color: #1b1200; background: var(--warn); font-weight: 750; letter-spacing: .03em; }\n.ehm-pill .p-text { color: var(--muted); font-weight: 550; }\n.ehm-pill .p-time { font-variant-numeric: tabular-nums; }\n.ehc--master:not([data-layout=\"overlay\"]) .ehm-pill .p-text { display: none; }\n\n/* Accentkleuren (naar de ingebakken referentiekaarten) */\n.ehc--master [data-key=\"pv\"] { --accent: #ffc24a; }\n.ehc--master [data-key=\"house\"] { --accent: #ffd27a; }\n.ehc--master [data-key=\"cupra\"] { --accent: #7cff4a; }\n.ehc--master [data-key=\"battery\"] { --accent: #a98bff; }\n.ehc--master [data-key=\"practice\"] { --accent: #e08a3c; }\n.ehc--master [data-key=\"net\"] { --accent: #8fd9c6; }\n.ehc--master [data-key=\"net\"][data-direction=\"import\"] { --accent: #ff8a3d; }\n.ehc--master [data-key=\"net\"][data-direction=\"export\"] { --accent: #3fe6f2; }\n/* RC2: actuele P1 zonder bevestigde richting: neutraal grijs (niet verwarren met cyaan teruglevering/oranje afname). */\n.ehc--master [data-key=\"net\"][data-direction=\"unconfirmed\"] { --accent: #aab4c3; }\n.ehc--master .tile[data-tone=\"warn\"] { --accent: var(--warn); }\n.ehc--master .tile[data-tone=\"bad\"] { --accent: var(--bad); }\n\n/* ---------------- glaskaarten op de master (overlay en compact) */\n.ehm-tiles { position: relative; z-index: 4; }\n.ehc--master .ehm-tiles .tile { grid-area: auto; margin: 0; }\n.ehc--master:not([data-layout=\"list\"]) .ehm-tiles { position: absolute; inset: 0; pointer-events: none; }\n.ehc--master:not([data-layout=\"list\"]) .ehm-tiles .tile {\n  pointer-events: auto; max-width: none; min-height: 0; flex-wrap: nowrap; align-items: center;\n  border-radius: calc(var(--u) * 24px); border: max(1px, calc(var(--u) * 2px)) solid color-mix(in srgb, var(--accent) 82%, transparent);\n  box-shadow: 0 0 calc(var(--u) * 18px) color-mix(in srgb, var(--accent) 42%, transparent),\n              inset 0 0 calc(var(--u) * 26px) color-mix(in srgb, var(--accent) 16%, transparent),\n              inset 0 1px 0 rgba(255,255,255,.14);\n  transition: box-shadow .2s ease, transform .2s ease;\n}\n.ehc--master:not([data-layout=\"list\"]) .ehm-tiles .tile:hover { box-shadow: 0 0 calc(var(--u) * 26px) color-mix(in srgb, var(--accent) 60%, transparent), inset 0 0 calc(var(--u) * 26px) color-mix(in srgb, var(--accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.18); }\n.ehc--master .t-value { font-variant-numeric: tabular-nums; }\n.ehc--master .t-unit { font-size: .62em; font-weight: 600; opacity: .92; }\n\n/* overlay: volledige kaart zoals in de referentie (icoon, titel, waarde, toelichting) */\n.ehc--master[data-layout=\"overlay\"] .ehm-tiles .tile { min-width: 0; justify-self: auto; overflow: hidden; gap: calc(var(--u) * 14px); padding: calc(var(--u) * 9px) calc(var(--u) * 12px) calc(var(--u) * 9px) calc(var(--u) * 16px); }\n.ehc--master[data-layout=\"overlay\"] .t-icon { width: calc(var(--u) * 46px); height: calc(var(--u) * 46px); border-radius: 0; background: none; box-shadow: none; color: var(--accent); filter: drop-shadow(0 0 calc(var(--u) * 6px) color-mix(in srgb, var(--accent) 70%, transparent)); }\n.ehc--master[data-layout=\"overlay\"] .t-icon svg { width: 100%; height: 100%; stroke-width: 1.7; }\n.ehc--master[data-layout=\"overlay\"] .t-body { flex: 1 1 auto; justify-content: center; gap: 0; min-width: 0; }\n.ehc--master[data-layout=\"overlay\"] .t-title { font-size: max(10px, calc(var(--u) * 18px)); letter-spacing: 0; text-transform: none; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ehc--master[data-layout=\"overlay\"] .t-value { font-size: max(13px, calc(var(--u) * 34px)); font-weight: 700; margin-top: 0; white-space: nowrap; color: #fff; letter-spacing: -.01em; }\n.ehc--master[data-layout=\"overlay\"] .t-sub {\n  font-size: max(9px, calc(var(--u) * 14.5px)); line-height: 1.2; margin-top: calc(var(--u) * 2px); color: rgba(255,255,255,.82); overflow: hidden;\n  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;\n}\n.ehc--master[data-layout=\"overlay\"] .tile[data-key=\"cupra\"] .t-sub, .ehc--master[data-layout=\"overlay\"] .tile[data-key=\"battery\"] .t-sub, .ehc--master[data-layout=\"overlay\"] .tile[data-key=\"net\"] .t-sub { -webkit-line-clamp: 1; line-clamp: 1; }\n.ehc--master[data-layout=\"overlay\"] .t-extra { font-size: max(8px, calc(var(--u) * 12.5px)); margin-top: calc(var(--u) * 2px); padding: 0 .6em; line-height: 1.5; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }\n/* praktijk: \"Nog niet gekoppeld\" als knop-pil zoals in de referentie */\n.ehc--master[data-layout=\"overlay\"] .tile[data-key=\"practice\"][data-tone=\"muted\"] .t-value { display: none; }\n.ehc--master[data-layout=\"overlay\"] .tile[data-key=\"practice\"][data-tone=\"muted\"] .t-sub { display: inline-block; align-self: flex-start; margin-top: calc(var(--u) * 6px); padding: .15em .75em; border-radius: calc(var(--u) * 10px); border: max(1px, calc(var(--u) * 1.5px)) solid var(--accent); color: #ffe9d4; box-shadow: 0 0 calc(var(--u) * 10px) color-mix(in srgb, var(--accent) 45%, transparent); font-size: max(9px, calc(var(--u) * 15px)); }\n.ehc--master[data-layout=\"overlay\"] .tile[data-key=\"practice\"] .t-icon { width: calc(var(--u) * 38px); height: calc(var(--u) * 38px); }\n.ehc--master[data-layout=\"overlay\"] .tile[data-key=\"practice\"] .t-title { font-size: max(10px, calc(var(--u) * 17px)); }\n.ehc--master[data-layout=\"overlay\"] .ehc-detail { top: 3.5rem; }\n\n/* compact (mobiel/tablet): dezelfde glaskaarten op het beeld, alleen de waarde (+ richting); geen dubbele set eronder.\n   Het tikvlak wordt onzichtbaar vergroot tot minstens 48 × 48 px. */\n.ehc--master[data-layout=\"compact\"] .ehm-tiles .tile { min-width: 0; max-width: none; justify-self: auto; overflow: visible; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 0 2px; }\n.ehc--master[data-layout=\"compact\"] .ehm-tiles .tile::before { content: \"\"; position: absolute; left: 50%; top: 50%; width: max(100%, 48px); height: max(100%, 48px); transform: translate(-50%, -50%); }\n.ehc--master[data-layout=\"compact\"] .t-icon, .ehc--master[data-layout=\"compact\"] .t-sub { display: none; }\n.ehc--master[data-layout=\"compact\"] .t-body { flex: 0 0 auto; justify-content: center; align-items: center; text-align: center; min-width: 0; max-width: 100%; overflow: hidden; }\n.ehc--master[data-layout=\"compact\"] .t-title { display: none; }\n.ehc--master[data-layout=\"compact\"][data-density=\"mid\"] .t-title { display: block; font-size: max(9px, calc(var(--u) * 17px)); letter-spacing: 0; text-transform: none; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }\n.ehc--master[data-layout=\"compact\"] .t-value, .ehc--master[data-layout=\"compact\"] .tile[data-key=\"house\"] .t-value { font-size: clamp(11px, calc(var(--u) * 34px), 22px); font-weight: 700; margin: 0; white-space: nowrap; color: #fff; line-height: 1.15; }\n.ehc--master[data-layout=\"compact\"] .t-extra { display: none; }\n.ehc--master[data-layout=\"compact\"] .tile[data-key=\"net\"] .t-extra:not([hidden]), .ehc--master[data-layout=\"compact\"] .tile[data-key=\"battery\"] .t-extra { display: block; margin: 0; padding: 0 .4em; font-size: clamp(8px, calc(var(--u) * 13px), 12px); line-height: 1.35; font-weight: 700; color: var(--accent); background: none; }\n.ehc--master[data-layout=\"compact\"] .tile[data-key=\"practice\"][data-tone=\"muted\"] .t-value { display: none; }\n.ehc--master[data-layout=\"compact\"] .tile[data-key=\"practice\"][data-tone=\"muted\"] .t-sub { display: block; margin: 0; font-size: clamp(9px, calc(var(--u) * 18px), 13px); line-height: 1.1; white-space: normal; text-align: center; color: #ffe9d4; font-weight: 650; }\n.ehc--master[data-layout=\"compact\"] .tile:focus-visible { outline-offset: 2px; }\n\n/* lijst (zeer smal of vergrote tekst): lege glasvlakken op het beeld, leesbare kaarten eronder */\n.ehc--master[data-layout=\"list\"] .ehm-stage { border-radius: 1.1rem; }\n.ehc--master[data-layout=\"list\"] .ehm-tiles { display: grid; grid-template-columns: minmax(0, 1fr); gap: .5rem; margin-top: .6rem; }\n.ehc--master[data-layout=\"list\"] .ehm-tiles .tile { position: relative; max-width: none; justify-self: stretch; align-self: stretch; flex-direction: row; min-width: 0; padding: .6rem .7rem; gap: .6rem; border-radius: .95rem; background: var(--bg-2); border-color: color-mix(in srgb, var(--accent) 45%, transparent); -webkit-backdrop-filter: none; backdrop-filter: none; }\n.ehc--master[data-layout=\"list\"] .t-icon { color: var(--accent); }\n.ehc--master[data-layout=\"list\"] .t-extra { color: var(--accent); }\n@container (min-width: 30rem) { .ehc--master[data-layout=\"list\"] .ehm-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }\n\n/* legenda, scenario's (inklapbaar) */\n.ehm-legend { margin: .7rem .25rem 0; font-size: .82rem; color: var(--muted); }\n.ehm-legend::before { content: \"ⓘ \"; color: var(--dim); }\n.ehc--master .ehc-controls > summary { display: flex; align-items: center; min-height: 48px; margin: -.4rem 0; cursor: pointer; list-style: none; }\n.ehc--master .ehc-controls > summary::-webkit-details-marker { display: none; }\n.ehc--master .ehc-controls > summary::after { content: \"▾\"; margin-left: .5rem; transition: transform .2s ease; }\n.ehc--master .ehc-controls:not([open]) > summary::after { transform: rotate(-90deg); }\n.ehc--master .ehc-controls[open] > summary { margin-bottom: .4rem; }\n.ehc--master .ehc-controls > summary:focus-visible { outline: 3px solid #fff; outline-offset: 3px; border-radius: .5rem; }\n@media (prefers-reduced-motion: reduce) { .ehc--master .ehm-tiles .tile, .ehc--master .ehc-controls > summary::after { transition: none; } }\n\n/* LIVE-modus (HA-01): geen DEMO-labels; neutrale LIVE-markering, alleen-lezen. */\n.ehc-demo.ehc-live { color: #04220f; background: #5fe7a0; box-shadow: 0 0 0 1px rgba(95,231,160,.4), 0 6px 20px rgba(95,231,160,.16); }\n.ehm-pill .p-demo.p-live { background: #5fe7a0; color: #04220f; }\n.ehm-pill[data-state=\"offline\"] .p-demo.p-live { background: var(--bad); color: #2a0606; }\n/* RC1-C: verbindingsstatus ondubbelzinnig. Offline: rood (kop + pil), verbonden maar niet alles actueel: oranje. */\n.ehc-demo.ehc-live[data-state=\"offline\"] { color: #2a0606; background: var(--bad); box-shadow: 0 0 0 1px rgba(255,107,107,.45), 0 6px 20px rgba(255,107,107,.18); }\n.ehc-demo.ehc-live[data-state=\"degraded\"] { color: #1b1200; background: var(--warn); box-shadow: 0 0 0 1px rgba(255,181,71,.4), 0 6px 20px rgba(255,181,71,.18); }\n.ehm-pill[data-state=\"degraded\"] .p-demo.p-live { background: var(--warn); color: #1b1200; }\n.ehm-pill[data-state=\"offline\"] .p-text { color: var(--bad); }\n";
 /* ==================================================================================================
  * Integratie in <energiehuis-card> (Home). Alleen-lezen: geen servicecalls, geen bediening van Alfen of
  * andere apparatuur, geen opslag, geen eigen tokens. Enige Home Assistant-aanroep: callWS
  * media_source/resolve_media voor de afgeschermde masterafbeelding.
  *
  * Rendercyclus: de bestaande kaart vervangt bij elke hass-update de complete shadow-DOM (innerHTML). De Live
  * Cockpit is daarom één BLIJVEND element (eigen shadow root, eigen CSS) dat na elke kaartrender op Home wordt
  * teruggeplaatst. Cockpit, masterafbeelding, canvas en detailpaneel worden niet opnieuw opgebouwd; nieuwe
  * meetwaarden gaan via adapter.changed() → cockpit.setInput() (alleen bij gewijzigde state-objecten).
  * ================================================================================================== */
 const C = scope.EhHaContract, A = scope.EhHaAdapter, X = scope.EhPve04Master;
 const RESOLVE_TIMEOUT_MS = 15000;
 const PASS_KEYS = ['net', 'zonnepanelen', 'huis', 'laden', 'cupra', 'batterij', 'praktijk'];

 /** Schakelaar: alleen exact `live_cockpit: true` activeert de nieuwe Home (standaard uit). */
 function enabled(c) { return !!c && c.live_cockpit === true; }
 /** v1.28-opt-in: alleen exact `live_cockpit_immersive: true` én `live_cockpit: true` (standaard uit). */
 function immersiveEnabled(c) { return enabled(c) && c.live_cockpit_immersive === true; }

 /** Vertaalt de kaartconfiguratie naar het HA-01-datacontract (zelfde entiteitssleutels als de productiekaart). */
 function liveConfig(c) {
  const o = {};
  for (const k of PASS_KEYS) if (c[k] !== undefined) o[k] = c[k];
  if (c.live_cockpit_p1_sign !== undefined) o.p1_sign = c.live_cockpit_p1_sign;
  if (c.live_cockpit_image !== undefined && c.live_cockpit_image !== '') o.image = c.live_cockpit_image;
  if (c.live_cockpit_route_ttl_s !== undefined) o.route_ttl_s = c.live_cockpit_route_ttl_s;
  if (c.live_cockpit_balance_max_skew_s !== undefined) o.balance_max_skew_s = c.live_cockpit_balance_max_skew_s;
  return o;
 }

 /** Alleen een same-origin pad onder /media/ (eventueel met ?authSig=…) wordt als beeld-URL geaccepteerd. */
 function safeResolvedUrl(url, origin) {
  if (typeof url !== 'string' || !url) return null;
  try {
   const u = new URL(url, origin);
   if (u.origin !== origin || !u.pathname.startsWith('/media/') || u.pathname.includes('..')) return null;
   return u.pathname + u.search;
  } catch (e) { return null; }
 }

 const HOST_CSS = ':host{display:block;margin:0 0 12px;color:var(--text);font-family:var(--font);line-height:1.35;contain:layout style}' +
  '.ehl-mount{padding:0}' +
  // In de kaart staat de titel al in het masterbeeld en de kaartkop: kop visueel verbergen (blijft voor schermlezers).
  '.ehc-brand{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}' +
  '.ehc-head{justify-content:flex-start}' +
  // v1.28 immersive Home: schermvullend, master volledig zichtbaar (contain), achtergrondverlenging uit dezelfde master.
  ':host([data-immersive]){margin:0;--eh-imm-total:max(300px,calc(100svh - var(--eh-imm-offset,190px)));--eh-imm-chrome:12px;--eh-imm-stage-h:max(120px,calc(var(--eh-imm-total) - var(--eh-imm-chrome)))}' +
  // Lage, liggende schermen: alleen de statusregel boven de scène meetellen; legenda en samenvatting volgen eronder.
  '@media (max-height:500px) and (orientation:landscape){:host([data-immersive]){--eh-imm-chrome:10px}}' +
  ':host([data-immersive]) .ehc{max-width:none;margin:0;display:flex;flex-direction:column;justify-content:center;min-height:var(--eh-imm-total);isolation:isolate;border-radius:20px;overflow:hidden;padding:6px 8px 8px;background:radial-gradient(120% 90% at 50% 30%,#1b2a3c,#081320)}' +
  ':host([data-immersive]) .ehc[data-layout="list"]{min-height:0}' +
  ':host([data-immersive]) .ehc:not([data-layout="list"]) .ehm-frame{width:min(100%,calc(var(--eh-imm-stage-h) * 1330 / 748));margin:0 auto}' +
  ':host([data-immersive]) .eh-imm-ambient{position:absolute;inset:-6%;width:112%;height:112%;z-index:-1;filter:blur(22px) saturate(1.15) brightness(.62);pointer-events:none}' +
  ':host([data-immersive]) .ehc-head{margin:0 2px 6px}' +
  ':host([data-immersive]) .ehm-stage{box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}' +
  // Home = scène + vakjes + kwartierprijs-overlay. Status, samenvatting en legenda blijven er voor schermlezers (sr-only)
  // en staan niet meer als paneel naast of onder het beeld; de LIVE/OFFLINE-pil staat in de scène zelf.
  ':host([data-immersive]) .ehc-head,:host([data-immersive]) .ehc-summary,:host([data-immersive]) .ehm-legend{position:absolute;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}' +
  // Waarschuwing bij een tegenstrijdige meetketen blijft zichtbaar, als dunne balk bovenaan de scène.
  ':host([data-immersive]) .ehc-warn:not([hidden]){position:absolute;z-index:6;left:50%;top:6px;transform:translateX(-50%);width:max-content;max-width:min(94%,680px);margin:0;padding:.3rem .7rem;border-radius:10px;font-size:.72rem;line-height:1.3;pointer-events:none;background:rgba(40,12,12,.86)}' +
  // Dagtotalen in de vakjes: tweede, kleine regel(s) onder de livewaarde.
  // Portret (kleine scène): de pil loopt naar links door in de lege lucht boven het huis, zodat datum en temperatuur passen.
  ':host([data-immersive]) .ehc--master[data-layout="list"] .ehm-pill{left:50%;width:calc((var(--x) + var(--w) - .5) * 100%)}' +
  // In de immersive Home vervangt datum + temperatuur de tekst "alleen-lezen" (die staat al in de appbalk); offline blijft zichtbaar.
  ':host([data-immersive]) .ehm-pill:not([data-state="offline"]) .p-text{display:none}' +
  '.ehm-pill .p-extra{margin-left:.55em;padding-left:.6em;border-left:1px solid rgba(255,255,255,.28);color:#d6e4ef;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.ehm-pill .p-extra[hidden]{display:none}' +
  '.ehc--master[data-layout="compact"][data-density="xs"] .ehm-pill .p-extra{display:none}' +
  '.t-day{display:grid;gap:1px;margin-top:.25rem;font-size:.74rem;color:var(--muted);font-variant-numeric:tabular-nums}.t-day[hidden]{display:none}.t-day span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.ehc--master[data-layout="list"] .t-day span{white-space:normal;overflow:visible}' +
  '.ehc--master:not([data-layout="list"]) .t-day{margin:calc(var(--u) * 2px) 0 0;font-size:clamp(9px,calc(var(--u) * 13px),11px);line-height:1.2;color:rgba(255,255,255,.86);letter-spacing:-.01em}' +
  '.ehc--master[data-layout="compact"] .t-day{text-align:center;justify-items:center}' +
  // Met een dagregel is de oude ondertitel overbodig (tenzij de meting afwijkt: dan blijft de reden zichtbaar); de batterij toont al "Simulatie".
  ':host([data-immersive]) .ehc--master:not([data-layout="list"]) .tile:not([data-tone="warn"]):not([data-tone="bad"]) .t-day:not([hidden]) ~ .t-sub,:host([data-immersive]) .ehc--master:not([data-layout="list"]) .tile[data-key="battery"] .t-sub{display:none}' +
  // Vakjes met dagtotalen krijgen iets meer hoogte (naar beneden), nog steeds over de afgedekte ingebakken kaart heen.
  ':host([data-immersive]) .ehc--master:not([data-layout="list"]) .ehm-tiles .tile{top:calc((var(--y) - .012) * 100%);height:calc((var(--h) + .046) * 100%)}' +
  // Net-vakje (breedte van de scène 560–800 px, bijv. iPhone liggend): iets breder naar links voor "Af x · Terug y kWh".
  ':host([data-immersive]) .ehc--master[data-dform="2"]:not([data-layout="list"]) .ehm-tiles .tile[data-key="net"]{left:calc((var(--x) - .07) * 100%);width:calc((var(--w) + .07) * 100%)}' +
  // Kwartierprijs-overlay (subtiel, nooit een tikvlak): rechtsonder op de scène; in de lijstweergave (portret) een rij onderaan de vakjes.
  '.eh-price{appearance:none;font-family:inherit;text-align:left;cursor:pointer;display:block;box-sizing:border-box;min-width:44px;min-height:44px;position:absolute;z-index:4;pointer-events:auto;left:62.5%;right:1.5%;bottom:2.2%;padding:calc(var(--u) * 8px) calc(var(--u) * 12px);border-radius:calc(var(--u) * 16px);background:rgba(8,16,28,.58);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.13);color:#e8f2fa;font-size:clamp(9px,calc(var(--u) * 13px),11px);line-height:1.2}' +
  '.eh-price:hover{border-color:rgba(255,255,255,.3)}.eh-price:focus-visible{outline:2px solid #76c1ef;outline-offset:2px}' +
  '.eh-price-top{display:flex;align-items:baseline;gap:.5em;white-space:nowrap}.eh-price-label{opacity:.78;letter-spacing:.04em;text-transform:uppercase;font-size:.9em}.eh-price-now{font-size:1.5em;font-weight:700;font-variant-numeric:tabular-nums;color:#fff}.eh-price-at{margin-left:auto;opacity:.7;font-variant-numeric:tabular-nums}' +
  '.eh-price-bars{display:block;width:100%;height:calc(var(--u) * 40px);min-height:12px;max-height:26px;margin-top:calc(var(--u) * 5px)}.eh-price-bars rect{fill:rgba(255,255,255,.34)}.eh-price-bars rect.cheap{fill:rgba(95,231,160,.55)}.eh-price-bars rect.now{fill:#fff}.eh-price-bars line.nowline{stroke:#5fe7a0;stroke-width:.5;opacity:.9}.eh-price-bars line.zero{stroke:#fff;stroke-width:.3;opacity:.35}.eh-price-bars rect.past{fill:rgba(255,255,255,.2)}' +
  '.eh-price-bars line.daybreak{stroke:#fff;stroke-width:.65;stroke-dasharray:2 2;opacity:.7}.eh-price-period{display:block;margin-top:2px;font-size:.85em;opacity:.75;white-space:normal}' +
  '.ehc--master:not([data-layout="list"]) .eh-price-period{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}' +
  '.eh-price-bars rect.planned{fill:#4bd66d}.eh-price-bars rect.waiting{fill:#ffad32}.eh-price-bars rect.planned.now,.eh-price-bars rect.waiting.now{stroke:#fff;stroke-width:.5}.eh-price-bars line.limit{stroke:#ef6666;stroke-width:.6}' +
  '.eh-price[data-state="none"] .eh-price-now{font-size:1em;font-weight:600;opacity:.8}' +
  '.ehc--master[data-layout="list"] .eh-price{position:static;grid-column:1 / -1;padding:.55rem .8rem;border-radius:.95rem;font-size:.8rem;background:color-mix(in srgb,var(--bg-2) 80%,transparent)}' +
  '.ehc--master[data-layout="list"] .eh-price-bars{height:34px;max-height:none}' +
  '' +
  // Portret (data-imm-portrait, gezet door measure()): volle-breedte scène bovenaan, routekaarten (2 kolommen vanaf 21rem)
  // eronder als glas over dezelfde vervaagde master; glasvlakken op de scène zijn tikvlakken (≥44 px).
  ':host([data-imm-portrait]){margin:0 -6px}' +
  ':host([data-imm-portrait]) .ehc,:host([data-imm-portrait]) .ehc[data-layout="list"]{justify-content:flex-start;min-height:var(--eh-imm-total);padding:4px 4px 10px;border-radius:18px}' +
  ':host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-stage{border-radius:14px}' +
  ':host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-tiles{margin-top:.5rem;gap:.45rem}' +
  ':host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-tiles .tile{background:color-mix(in srgb,var(--bg-2) 80%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
  '@container (min-width:21rem){:host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
  ':host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-covers .ehm-plate{pointer-events:auto;cursor:pointer;overflow:visible}' +
  ':host([data-imm-portrait]) .ehc--master[data-layout="list"] .ehm-plate::before{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}' +
  '@media (prefers-reduced-motion:reduce){:host([data-immersive]) .eh-imm-ambient{filter:blur(22px) brightness(.62)}}' +
  // Zeer kleine scène: "Nog niet gekoppeld" past niet zonder woordafbreking ⇒ gedempt streepje (pagina legt het uit).
  '.ehc--master[data-layout="compact"][data-density="xs"] .tile[data-key="practice"][data-tone="muted"] .t-sub{display:none}' +
  '.ehc--master[data-layout="compact"][data-density="xs"] .tile[data-key="practice"][data-tone="muted"] .t-value{display:block;color:var(--dim)}';

 /** Eén controller per kaart. Geeft { error } terug bij een ongeldige configuratie (kaart blijft werken). */
 function createController(card, cfg) {
  const immersive = immersiveEnabled(card.config);   // v1.28-opt-in; signatuur ongewijzigd t.o.v. v1.27
  const norm = C.normalizeConfig(cfg);
  if (norm.errors.length) return { error: norm.errors.join('; ') };
  const adapter = A.createAdapter(cfg);
  const doc = card.ownerDocument || document;
  const host = doc.createElement('div');
  host.className = 'eh-live-home';
  host.setAttribute('data-eh-live', 'home');
  if (immersive) host.setAttribute('data-immersive', '');
  const sr = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style'); style.textContent = LIVE_CSS + '\n' + HOST_CSS;
  const mount = doc.createElement('div'); mount.className = 'ehl-mount';
  sr.append(style, mount);
  let timer = 0, pending = null, wasConnected = null, suspended = false, destroyed = false, updates = 0, resolves = 0;

  function cancelResolve(why) { const j = pending; pending = null; if (j && j.cancel) j.cancel(why); }
  function resolveImage(id) {
   cancelResolve('vervangen');
   const job = { done: false, to: 0, cancel: null };
   pending = job;
   return new Promise((resolve, reject) => {
    const finish = (fn, v) => { if (job.done) return; job.done = true; clearTimeout(job.to); if (pending === job) pending = null; fn(v); };
    job.cancel = why => finish(reject, new Error(why));
    job.to = setTimeout(() => finish(reject, new Error('time-out')), card._ehLiveResolveTimeoutMs || RESOLVE_TIMEOUT_MS);
    (async () => {
     const h = card._hass;
     if (!h || typeof h.callWS !== 'function') return null;
     resolves++;
     const r = await h.callWS({ type: 'media_source/resolve_media', media_content_id: id });
     if (job.done) return null;                                  // laat antwoord na afbreken: negeren
     const origin = typeof h.hassUrl === 'function' ? new URL(h.hassUrl('/')).origin : location.origin;
     const url = safeResolvedUrl(r && r.url, origin);
     return url && typeof h.hassUrl === 'function' ? h.hassUrl(url) : url;
    })().then(v => finish(resolve, v), e => finish(reject, e));
   });
  }

  // Immersive Home: sfeervolle achtergrondverlenging uit DEZELFDE, al geladen master (klein canvas, vervaagd via CSS;
  // geen tweede netwerkaanvraag, geen nieuw beeldbestand). Voorgrondscène, kaarten en canvas blijven exact uitgelijnd.
  function ambient(img) {
   if (!immersive || !img.naturalWidth) return;
   const root = cockpit.el; let cv = root.querySelector(':scope > .eh-imm-ambient');
   if (!cv) { cv = doc.createElement('canvas'); cv.className = 'eh-imm-ambient'; cv.setAttribute('aria-hidden', 'true'); cv.width = 160; cv.height = 90; root.prepend(cv); }
   try { cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); } catch (e) { /* alleen presentatie */ }
  }
  const cockpit = X.createMasterCockpit(mount, {
   mode: 'live', specs: adapter.specs,
   onTileNavigate: immersive ? key => { if (typeof card._ehImmNavigate === 'function') card._ehImmNavigate(key); } : undefined,
   onImageLoad: immersive ? ambient : undefined,
   pillExtra: immersive ? m => (typeof card._ehImmPillExtra === 'function' ? card._ehImmPillExtra(m) : '') : undefined,
   tileDay: immersive ? (k, m, sw) => (typeof card._ehImmTileDay === 'function' ? card._ehImmTileDay(k, m, sw) : null) : undefined,
   preferList: immersive ? () => host.hasAttribute('data-imm-portrait') : undefined,
   resolveImage: norm.image ? () => resolveImage(norm.image) : () => null,
   imageMissingText: norm.image ? 'Beeld niet beschikbaar — alleen interface' : 'Geen beeld geconfigureerd (live_cockpit_image) — alleen interface'
  });

  function update(hass, force) {
   if (destroyed || suspended) return;
   const now = Date.now();
   const conn = !!hass && hass.connected !== false;
   if (conn && wasConnected === false) cockpit.retryImage();      // verbinding hersteld ⇒ mislukt beeld opnieuw
   wasConnected = conn;
   if (adapter.changed(hass) || force) { cockpit.setInput(adapter.input(hass, now)); updates++; }
   if (immersive && typeof card._ehImmExtras === 'function') card._ehImmExtras();   // kwartierprijs + dagtotalen (alleen lezen)
   // Eén timer: opnieuw beoordelen op de eerstvolgende route-/toon-TTL-grens, zonder complete kaartrender.
   if (timer) clearTimeout(timer);
   timer = setTimeout(() => { timer = 0; update(card._hass, true); }, adapter.nextCheckMs(hass, now));
  }
  // Immersive: beschikbare hoogte METEN (bovenkant van de cockpit t.o.v. het document, hoogte van de ondernavigatie
  // van de kaart) i.p.v. schatten; alleen tijdens zichtbaarheid een resize-listener (geen extra observers).
  const win = doc.defaultView;
  const PORTRAIT_MAX_W = 600, PORTRAIT_MIN_RATIO = 1.1;
  function measure() {
   if (!immersive || destroyed || suspended || !host.isConnected) return;
   const top = host.getBoundingClientRect().top + (win.scrollY || 0);
   const nav = card.shadowRoot && card.shadowRoot.querySelector('.shell > .nav');
   const nr = nav ? nav.getBoundingClientRect() : null;
   const navH = nr && nr.width >= win.innerWidth * 0.5 ? nr.height : 0;   // liggend: rail links, geen balk onder de scène
   const total = Math.max(220, Math.round(win.innerHeight - Math.max(0, top) - navH - 8));
   if (host.style.getPropertyValue('--eh-imm-total') !== total + 'px') host.style.setProperty('--eh-imm-total', total + 'px');
   // Portret: een 16:9-master past op een smal, hoog scherm alleen klein (contain, nooit bijsnijden). Dan de scène over
   // de volle breedte bovenaan en de zes routes als leesbare kaarten eronder i.p.v. een klein beeld in veel waas.
   const w = host.getBoundingClientRect().width;
   const portrait = w > 0 && w < PORTRAIT_MAX_W && total >= w * PORTRAIT_MIN_RATIO;
   if (portrait !== host.hasAttribute('data-imm-portrait')) { host.toggleAttribute('data-imm-portrait', portrait); cockpit.relayout(true); }   // direct: geen tussenframe met de oude laag
  }
  // iOS meldt na het draaien soms nog de oude innerHeight: één extra meting op het volgende frame (geen nieuwe listeners).
  function onViewport() { measure(); win.requestAnimationFrame(measure); }
  let listening = false;
  function listen(on) {
   if (!immersive || on === listening) return;
   listening = on;
   if (on) { win.addEventListener('resize', onViewport, { passive: true }); win.addEventListener('orientationchange', onViewport, { passive: true }); }
   else { win.removeEventListener('resize', onViewport); win.removeEventListener('orientationchange', onViewport); }
  }
  function suspend() {
   if (destroyed || suspended) return;
   suspended = true;
   listen(false);
   if (timer) clearTimeout(timer); timer = 0;
   cockpit.suspend();
   cancelResolve('ontkoppeld');
  }
  function resume() {
   if (destroyed || !suspended) return;
   suspended = false;
   cockpit.resume();
   listen(true);
  }
  function destroy() {
   if (destroyed) return;
   suspend(); destroyed = true;
   cockpit.destroy(); host.remove();
  }
  suspended = false;
  listen(true);   // ook de eerste keer: anders volgt de hoogte pas na een suspend/resume op een draai van het toestel
  return Object.freeze({
   host, cockpit, adapter, update, suspend, resume, destroy, immersive, measure,
   get debug() { return { updates, resolves, suspended, destroyed, timer: !!timer, pendingResolve: !!pending }; }
  });
 }

 /** Na elke kaartrender: Live Cockpit op Home plaatsen (of netjes uitschakelen). */
 function afterRender(card, focused) {
  const c = card.config;
  const state = card._ehLive || (card._ehLive = { ctl: null, key: '', error: null });
  if (!enabled(c)) {
   if (state.ctl) state.ctl.destroy();
   state.ctl = null; state.key = ''; state.error = null;
   return;
  }
  const imm = immersiveEnabled(c), cfg = liveConfig(c), key = JSON.stringify(cfg) + (imm ? '|immersive' : '');
  if (key !== state.key) {
   if (state.ctl) state.ctl.destroy();
   state.ctl = null; state.key = key; state.error = null;
   const made = createController(card, cfg);
   if (made.error) state.error = made.error; else state.ctl = made;
  }
  if (card._view !== 'overview') { if (state.ctl) state.ctl.suspend(); return; }
  const root = card.shadowRoot, body = root && root.querySelector('.shell > .body');
  if (!body) return;
  const metrics = body.querySelector('.metrics');
  if (state.error) {
   // Fail-safe: ongeldige Live Cockpit-configuratie ⇒ bestaande EnergieRegisseur-cockpit blijft, met melding.
   const note = (card.ownerDocument || document).createElement('p');
   note.className = 'eh-live-config-error'; note.setAttribute('role', 'alert');
   note.textContent = 'Live Cockpit niet actief: configuratiefout (' + state.error + '). De EnergieRegisseur-cockpit wordt getoond.';
   note.style.cssText = 'margin:0 0 10px;padding:9px 12px;border-radius:12px;border:1px solid #ffb54780;background:#ffb5471a;color:#ffe2b0;font-size:12px;line-height:1.45';
   if (metrics) metrics.insertAdjacentElement('beforebegin', note); else body.prepend(note);
   return;
  }
  const ctl = state.ctl;
  if (metrics) metrics.insertAdjacentElement('beforebegin', ctl.host); else body.prepend(ctl.host);
  card._ehLiveShown = true;
  ctl.resume();
  if (ctl.measure) { ctl.measure(); const w = card.ownerDocument && card.ownerDocument.defaultView; if (w) w.requestAnimationFrame(ctl.measure); }   // na de stijlen van deze render nogmaals (nav-hoogte)
  ctl.update(card._hass, false);
  // Niet terugzetten terwijl het Inzicht-menu open staat: een focus buiten het menu sluit het meteen (iOS/Safari).
  if (focused && !card._eh26MenuOpen && focused.isConnected && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
 }

 (function install() {
  const P = EnergiehuisCard.prototype, previous = P._render;
  P._render = function () {
   const st = this._ehLive, host = st && st.ctl && st.ctl.host;
   // Focus binnen de cockpit overleeft de vervanging van de kaart-DOM.
   const focused = host && this.shadowRoot && this.shadowRoot.activeElement === host ? host.shadowRoot.activeElement : null;
   this._ehLiveShown = false;
   previous.call(this);
   if (!this.config || !this._hass) return;
   afterRender(this, focused);
  };
  /** Aangeroepen vanuit disconnectedCallback (02-card-shell.js): timers, animatie, observers en aanvragen stoppen. */
  P._ehLiveSuspend = function () { const st = this._ehLive; if (st && st.ctl) st.ctl.suspend(); };
 })();

 return Object.freeze({ enabled, immersiveEnabled, liveConfig, safeResolvedUrl, RESOLVE_TIMEOUT_MS, scope });
})();
