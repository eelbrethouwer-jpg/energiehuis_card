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
 *                werkelijke updatefrequenties in Home Assistant niet zijn gemeten. Per bron instelbaar met route_ttl_s. "Bevestigd in code" ≠ "bevestigd in een echte Home Assistant": de status van
 * elke bron in een echte installatie is ONBEVESTIGD totdat een afzonderlijk goedgekeurde HA-test is uitgevoerd.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhHaContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
  // "voldoende synchroon gemeten" geldt. Conservatief klein: alleen dan mag een afwijking als KRITIEK worden gemeld.
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
      if (key === 'practice') { if (id) notes.push('praktijk: in HA-01 niet koppelbaar — genegeerd'); id = ''; }
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

  return Object.freeze({ SCHEMA: 'energiehuis.ha-contract/1', SOURCES, P1_SIGNS, ROUTE_TTL_KEYS, BALANCE_SKEW_DEFAULT_S, normalizeConfig, modelSpecs, ENTITY_RE, IMAGE_RE });
});
