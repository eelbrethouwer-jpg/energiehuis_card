/* Energiehuis PVE-04 · ha/sim.js — GESIMULEERDE Home Assistant-states voor tests en de testpagina (HA-01).
 * Uitsluitend testdata: nooit in de LIVE-kaart zelf gebruikt. Bootst het frontendgedrag na: een nieuw hass-object per
 * update, met NIEUWE state-objecten alleen voor entiteiten die veranderen (zoals Home Assistant). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhHaSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = { net: 'sensor.p1_meter_vermogen', pv: 'sensor.goodwe_pv_power', house: 'sensor.energiehuis_huisverbruik_exclusief_auto', ev: 'sensor.alfen_actief_vermogen_totaal', soc: 'sensor.garage_cupra_born_accuniveau', battery: 'sensor.virtuele_batterij_soc' };
  const iso = (now, ageS) => new Date(now - ageS * 1000).toISOString();
  /** state-object zoals HA het levert; lr = last_reported (null = veld ontbreekt). */
  function st(id, v, unit, now, { ageS = 2, changedAgeS = null, lrAgeS = null } = {}) {
    const o = { entity_id: id, state: String(v), attributes: unit == null ? {} : { unit_of_measurement: unit }, last_changed: iso(now, changedAgeS == null ? ageS : changedAgeS), last_updated: iso(now, ageS), context: { id: 'sim' } };
    if (lrAgeS != null) o.last_reported = iso(now, lrAgeS);
    return o;
  }
  // Elk scenario: { states(now) → {key: state|undefined}, connected, config }
  const SCENARIOS = {
    afname: { label: 'Netafname', make: now => ({ net: st(ID.net, 2350, 'W', now), pv: st(ID.pv, 180, 'W', now), house: st(ID.house, 530, 'W', now), ev: st(ID.ev, 2000, 'W', now), soc: st(ID.soc, 41, '%', now, { ageS: 600 }), battery: st(ID.battery, 18, '%', now, { ageS: 300 }) }) },
    teruglevering: { label: 'Teruglevering', make: now => ({ net: st(ID.net, -1880, 'W', now), pv: st(ID.pv, 3340, 'W', now), house: st(ID.house, 1460, 'W', now), ev: st(ID.ev, 0, 'W', now, { ageS: 900 }), soc: st(ID.soc, 72, '%', now, { ageS: 1200 }), battery: st(ID.battery, 64, '%', now, { ageS: 300 }) }) },
    zonneladen: { label: 'Zonneladen', make: now => ({ net: st(ID.net, -380, 'W', now), pv: st(ID.pv, 4820, 'W', now), house: st(ID.house, 1460, 'W', now), ev: st(ID.ev, 2980, 'W', now), soc: st(ID.soc, 58, '%', now, { ageS: 300 }), battery: st(ID.battery, 72, '%', now, { ageS: 300 }) }) },
    'nul-watt': { label: '0 W', make: now => ({ net: st(ID.net, 0, 'W', now), pv: st(ID.pv, 0, 'W', now), house: st(ID.house, 0, 'W', now), ev: st(ID.ev, 0, 'W', now), soc: st(ID.soc, 80, '%', now, { ageS: 600 }), battery: st(ID.battery, 22, '%', now, { ageS: 300 }) }) },
    offline: { label: 'Offline (verbinding weg)', connected: false, make: now => SCENARIOS.zonneladen.make(now) },
    unavailable: { label: 'Unavailable', make: now => ({ net: st(ID.net, 'unavailable', 'W', now), pv: st(ID.pv, 'unknown', 'W', now), house: st(ID.house, 'unavailable', 'W', now), ev: st(ID.ev, 'unavailable', 'W', now), soc: st(ID.soc, 'unavailable', '%', now), battery: st(ID.battery, 'unknown', '%', now) }) },
    kw: { label: 'Eenheden in kW', make: now => ({ net: st(ID.net, '-1.88', 'kW', now), pv: st(ID.pv, '3,34', 'kW', now), house: st(ID.house, '1.46', 'kW', now), ev: st(ID.ev, '0', 'kW', now), soc: st(ID.soc, 72, '%', now, { ageS: 600 }), battery: st(ID.battery, 64, '%', now) }) },
    'eenheid-fout': { label: 'Ongeldige eenheden', make: now => ({ net: st(ID.net, -1880, 'Wh', now), pv: st(ID.pv, 3340, null, now), house: st(ID.house, 1460, 'W', now), ev: st(ID.ev, 0, 'A', now), soc: st(ID.soc, 72, 'kWh', now), battery: st(ID.battery, 64, '%', now) }) },
    ontbrekend: { label: 'Ontbrekende sensoren', make: now => ({ net: st(ID.net, -1880, 'W', now), pv: undefined, house: st(ID.house, 1460, 'W', now), ev: undefined, soc: undefined, battery: undefined }) },
    verouderd: { label: 'Verouderde P1 (20 min, geen last_reported)', make: now => ({ ...SCENARIOS.teruglevering.make(now), net: st(ID.net, -1880, 'W', now, { ageS: 1200 }) }) },
    'constant-gerapporteerd': { label: 'Constante P1, recent gerapporteerd', make: now => ({ ...SCENARIOS.teruglevering.make(now), net: st(ID.net, -1880, 'W', now, { ageS: 7200, lrAgeS: 3 }) }) },
    'constant-nacht': { label: 'PV 3 uur constant 0 W (nacht)', make: now => ({ net: st(ID.net, 420, 'W', now), pv: st(ID.pv, 0, 'W', now, { ageS: 10800 }), house: st(ID.house, 420, 'W', now), ev: st(ID.ev, 0, 'W', now, { ageS: 10800 }), soc: st(ID.soc, 80, '%', now, { ageS: 14400 }), battery: st(ID.battery, 22, '%', now, { ageS: 7200 }) }) },
    tegenstrijdig: { label: 'Tegenstrijdige meetketen', make: now => ({ net: st(ID.net, -1880, 'W', now), pv: st(ID.pv, 3340, 'W', now), house: st(ID.house, 3900, 'W', now), ev: st(ID.ev, 0, 'W', now), soc: st(ID.soc, 72, '%', now, { ageS: 600 }), battery: st(ID.battery, 64, '%', now) }) },
    'p1-omgekeerd': { label: 'P1 omgekeerd (export positief, gecorrigeerd)', config: { p1_sign: 'export_positive' }, make: now => ({ ...SCENARIOS.teruglevering.make(now), net: st(ID.net, 1880, 'W', now) }) },
    'p1-omgekeerd-fout': { label: 'P1 omgekeerd, niet gecorrigeerd', make: now => ({ ...SCENARIOS.teruglevering.make(now), net: st(ID.net, 1880, 'W', now) }) }
  };

  /** Een hass-achtig object; update() hergebruikt ongewijzigde state-objecten (referentiegelijk), zoals HA. */
  function createHass(scenario, now, prev, extra = {}) {
    const sc = SCENARIOS[scenario];
    const made = sc.make(now), states = {};
    for (const [k, id] of Object.entries(ID)) {
      const s = made[k]; if (!s) continue;
      const old = prev && prev.states[id];
      const same = old && old.state === s.state && JSON.stringify(old.attributes) === JSON.stringify(s.attributes) && old.last_updated === s.last_updated && old.last_reported === s.last_reported;
      states[id] = same ? old : Object.freeze(s);
    }
    return Object.freeze({ connected: sc.connected !== false, states: Object.freeze(states), ...extra });
  }
  return Object.freeze({ ID, SCENARIOS, createHass, st });
});
