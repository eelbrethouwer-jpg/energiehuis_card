/* Energiehuis PVE-04 · ha/contract.js — Home Assistant-datacontract voor de LIVE-cockpit (HA-01, alleen-lezen).
 *
 * Hergebruikt de configuratiesleutels en standaard-entiteiten van de productiekaart (src/legacy/00-foundation.js
 * EH_DEFAULTS, README-configuratie) zonder die te wijzigen. TTL's volgen de v1.25-EnergieRegisseur-cockpit
 * (src/legacy/16-regisseur-cockpit.js). "Bevestigd in code" ≠ "bevestigd in een echte Home Assistant": de status van
 * elke bron in een echte installatie is ONBEVESTIGD totdat een afzonderlijk goedgekeurde HA-test is uitgevoerd.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhHaContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = Object.freeze({
    net: Object.freeze({ config: 'net', default: 'sensor.p1_meter_vermogen', kind: 'power', ttlS: 300, stable: false, label: 'P1-netvermogen',
      sign: 'positief = netafname, negatief = teruglevering (productie: "Netafname positief, teruglevering negatief"); omkeerbaar met p1_sign',
      basis: 'EH_DEFAULTS.net · README · cockpit-TTL 5 min', ha: 'onbevestigd' }),
    pv: Object.freeze({ config: 'zonnepanelen', default: 'sensor.goodwe_pv_power', kind: 'power', ttlS: 2100, stable: true, label: 'GoodWe PV-vermogen',
      sign: '≥ 0; negatief wordt genegeerd', basis: 'EH_DEFAULTS.zonnepanelen · cockpit-TTL 35 min, stabiele 0 W als laatste stand', ha: 'onbevestigd' }),
    house: Object.freeze({ config: 'huis', default: 'sensor.energiehuis_huisverbruik_exclusief_auto', kind: 'power', ttlS: 300, stable: false, label: 'Huisverbruik exclusief auto',
      sign: '≥ 0; < −50 W = ongeldig', definition: 'netafname − teruglevering + zonopwek − autoladen (productie-uitleg 02-card-shell.js); de definitie van de HA-template zelf is niet in de repository vastgelegd',
      basis: 'EH_DEFAULTS.huis · cockpit-TTL 5 min', ha: 'onbevestigd (template-definitie onbekend)' }),
    ev: Object.freeze({ config: 'laden', default: 'sensor.alfen_actief_vermogen_totaal', kind: 'power', ttlS: 2100, stable: true, label: 'Alfen laadvermogen',
      sign: '≥ 0; < −30 W of > 11,5 kW = ongeldig', basis: 'EH_DEFAULTS.laden · cockpit-TTL 35 min, stabiele 0 W als laatste stand', ha: 'onbevestigd' }),
    soc: Object.freeze({ config: 'cupra', default: 'sensor.garage_cupra_born_accuniveau', kind: 'percent', ttlS: 5400, stable: true, label: 'Cupra Born accuniveau',
      sign: '0–100 %', basis: 'EH_DEFAULTS.cupra · cockpit-TTL 90 min, laatste stand toegestaan', ha: 'onbevestigd' }),
    battery: Object.freeze({ config: 'batterij', default: 'sensor.virtuele_batterij_soc', kind: 'percent', ttlS: 5400, stable: true, label: 'Virtuele batterij (SIMULATIE)',
      sign: '0–100 %; rekensimulatie, geen fysieke opslag en nooit een stroomroute', basis: 'EH_DEFAULTS.batterij / battery_soc · TTL 90 min (gelijk aan Cupra-SOC; niet in productie-cockpit)', ha: 'onbevestigd' }),
    practice: Object.freeze({ config: 'praktijk', default: '', kind: 'power', ttlS: 300, stable: false, label: 'Praktijkruimte (toekomstige submeter)',
      sign: '—', basis: 'Nog geen meting. In HA-01 bewust NIET koppelbaar: een geconfigureerde waarde wordt genegeerd tot een aparte opdracht.', ha: 'niet gekoppeld' })
  });

  const P1_SIGNS = Object.freeze(['import_positive', 'export_positive']);
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
    return Object.freeze({ entities: Object.freeze(entities), p1Sign: P1_SIGNS.includes(p1Sign) ? p1Sign : 'import_positive', image, errors: Object.freeze(errors), notes: Object.freeze(notes) });
  }

  /** Specificaties voor model.computeModel (input.specs). */
  function modelSpecs(norm) {
    const out = {};
    for (const [key, s] of Object.entries(SOURCES)) out[key] = Object.freeze({ entity: norm.entities[key], ttlS: s.ttlS, stable: s.stable });
    return Object.freeze(out);
  }

  return Object.freeze({ SCHEMA: 'energiehuis.ha-contract/1', SOURCES, P1_SIGNS, normalizeConfig, modelSpecs, ENTITY_RE, IMAGE_RE });
});
