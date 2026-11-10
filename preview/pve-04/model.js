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
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
    // (LIVE: instelbaar via de HA-adapter, balance_max_skew_s) ...
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
    return late.length ? 'niet live bevestigd: ' + late.map(k => LABEL[k]).join(', ') + ' (spreiding ' + skewTxt + ')' : 'meettijden lopen ' + skewTxt + ' uiteen';
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
    const value = parseNumber(st.state);
    if (value === null) return done('unknown', { reason: 'Geen geldige waarde' });
    const unitRaw = String((st.attributes && st.attributes.unit_of_measurement) || '').trim();
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
    if (!connected) for (const k of Object.keys(r)) if (r[k].state !== 'unlinked') r[k] = Object.freeze({ ...r[k], state: 'offline', value: null, shown: null, retained: null, reason: 'Offline' });

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
    // ---- balans (RC1-B): alleen een VOLDOENDE SYNCHROON gemeten keten mag als tegenstrijdig (kritiek) gelden.
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
        balanceInfo = sync ? 'Sluit (spreiding meettijden ' + skewTxt + ') — dit bewijst niet dat de meetketen is geverifieerd' : 'Rekenkundig binnen 150 W, maar ' + asyncWhy(late, skewTxt) + ': niet als bevestiging te gebruiken';
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
        warnings.push({ code: 'chain-async', critical: false, text: 'Meettijden lopen uiteen en de waarden sluiten niet: stroomroutes gepauzeerd tot een synchrone meting.' });
      }
    }
    if (pv !== null && pv < -T.routeMinW) warnings.push({ code: 'pv-negative', critical: false, text: 'Negatieve zonne-opwek genegeerd.' });
    const critical = warnings.some(w => w.critical);
    const blocked = !connected ? 'Offline' : critical ? 'Gestopt: meetketen tegenstrijdig' : hold;

    // ---- routes (geen grace: ongeldig = direct inactief)
    const practiceSim = cur(r.practice) && r.practice.simulated && r.practice.value >= 0;
    const cand = {
      'sun-home': { ok: pv !== null && pv >= T.routeMinW, w: pv, why: cur(r.pv) ? 'Onder 30 W' : r.pv.reason },
      'grid-home': { ok: direction === 'import', w: importW, why: cur(r.net) ? 'Geen netafname' : r.net.reason },
      'home-grid': { ok: direction === 'export', w: importW === null ? null : -importW, why: cur(r.net) ? 'Geen teruglevering' : r.net.reason },
      'home-ev': { ok: ev !== null && ev >= T.routeMinW, w: ev, why: evInvalid || (cur(r.ev) ? 'Cupra laadt niet' : r.ev.reason) },
      'home-practice': { ok: practiceSim && r.practice.value >= T.routeMinW, w: practiceSim ? r.practice.value : null, why: r.practice.state === 'unlinked' ? 'Nog niet gekoppeld' : 'Geen simulatie' }
    };
    const routes = {};
    for (const id of ROUTES) {
      const c = cand[id];
      const active = !blocked && c.ok && c.w !== null && c.w >= T.routeMinW;
      routes[id] = Object.freeze({
        id, active,
        watts: active ? c.w : null,
        intensity: active ? intensityOf(c.w) : 0,
        simulated: id === 'home-practice',
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
    tiles.practice = practiceSim
      ? { title: 'Praktijkruimte', value: formatPower(r.practice.value), sub: 'SIMULATIE · niet gemeten', tone: 'sim', entity: '—' }
      : { title: 'Praktijkruimte', value: '—', sub: 'Nog niet gekoppeld', tone: 'muted', entity: '—' };
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

  function summarize({ connected, critical, hold, routes, direction, importW, live, late = [] }) {
    if (!connected) return 'Geen verbinding met Home Assistant. Er worden geen meetwaarden of stroomrichtingen getoond.';
    if (critical) return (live ? 'De meetketen' : 'De fictieve meetketen') + ' is tegenstrijdig. Stroomroutes staan stil.';
    if (hold) return 'De meettijden lopen uiteen en de waarden sluiten niet. Stroomroutes zijn gepauzeerd tot een synchrone meting.';
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

  return Object.freeze({ T, SPECS, ROUTES, SCENARIOS, SCENARIO_IDS, parseNumber, readEntity, freshness, formatPower, formatNet, formatPct, gridDirection, computeModel, scenarioInput, ageLabel, agoLabel });
});
