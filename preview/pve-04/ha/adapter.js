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
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, M) {
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
