'use strict';
// Energiehuis 3.0: golden tests voor de balans-, kWh- en kostenmotor.
// Fixtures zijn de acht scenario's en het rekenvoorbeeld uit de engineeringreview (fictieve waarden).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/engines/balance-engine.cjs');

const src = (w, status = 'gemeten', t = null) => ({ w, status, t });
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, a + ' ≠ ' + b);
const PR = { praktijkConfigured: true };

// ---- §7 scenario's -----------------------------------------------------------------------------
const scenarios = [
  { id: 1, p1: 450, pv: 0, alfen: 0, prak: 60, woning: 390, verbruik: 450, eigen: 0, status: 'berekend' },
  { id: 2, p1: 7520, pv: 0, alfen: 7020, prak: 80, woning: 420, verbruik: 7520, eigen: 0, status: 'berekend' },
  { id: 3, p1: -3900, pv: 4800, alfen: 0, prak: 150, woning: 750, verbruik: 900, eigen: 900, status: 'berekend' },
  { id: 4, p1: -780, pv: 5200, alfen: 3700, prak: 120, woning: 600, verbruik: 4420, eigen: 4420, status: 'berekend' },
  { id: 5, p1: 8300, pv: 0, alfen: 6000, prak: 1800, woning: 500, verbruik: 8300, eigen: 0, status: 'berekend' }
];
for (const s of scenarios) {
  test('scenario ' + s.id + ': balans sluit en getallen kloppen', () => {
    const r = E.ehBalPower({ p1: src(s.p1), pv: src(s.pv), alfen: src(s.alfen), praktijk: src(s.prak) }, PR);
    assert.equal(r.woning.w, s.woning);
    assert.equal(r.woning.status, s.status);
    assert.equal(r.verbruik.w, s.verbruik);
    assert.equal(r.eigenZon.w, s.eigen);
    // Identiteit: Woning + Praktijk + Cupra = P1 + PV
    assert.equal(r.woning.w + s.prak + s.alfen, s.p1 + s.pv);
    assert.equal(r.identityOk, true);
  });
}

test('scenario 3: PV wordt opgeteld, nooit nog eens afgetrokken', () => {
  const r = E.ehBalPower({ p1: src(-3900), pv: src(4800), alfen: src(0), praktijk: src(150) }, PR);
  assert.equal(r.verbruik.w, 900);          // -3900 + 4800
  assert.notEqual(r.verbruik.w, -8700);      // dubbele aftrek zou -8700 geven
  assert.equal(r.net.exportW, 3900);
});

test('scenario 5: 7000 W laden zou boven de aansluiting uitkomen; Woning blijft binnen de grens', () => {
  assert.ok(500 + 1800 + 7000 > E.EH_BAL_MAX_HOME_W);
  const r = E.ehBalPower({ p1: src(8300), pv: src(0), alfen: src(6000), praktijk: src(1800) }, PR);
  assert.ok(r.woning.w < E.EH_BAL_MAX_HOME_W);
});

test('scenario 6: GoodWe unavailable maar bewezen nacht: PV 0 W is "geschat" en Woning ook', () => {
  const pv = E.ehBalNightPv(src(null, 'onbeschikbaar'), { belowHorizon: true, lastValidW: 12 });
  assert.equal(pv.w, 0);
  assert.equal(pv.status, 'geschat');
  const r = E.ehBalPower({ p1: src(520), pv, alfen: src(0), praktijk: src(70) }, PR);
  assert.equal(r.woning.w, 450);
  assert.equal(r.woning.status, 'geschat');
});

test('scenario 6b: nachtbewijs vereist beide voorwaarden (zon onder én laatste waarde < 50 W)', () => {
  assert.equal(E.ehBalNightPv(src(null), { belowHorizon: true, lastValidW: 400 }).w, null);
  assert.equal(E.ehBalNightPv(src(null), { belowHorizon: false, lastValidW: 0 }).w, null);
  assert.equal(E.ehBalNightPv(src(null), { belowHorizon: true, lastValidW: null }).w, null);
  assert.equal(E.ehBalNightPv(src(null), {}).w, null);
});

test('scenario 7: GoodWe unavailable terwijl de zon schijnt: geen Woning, net blijft exact', () => {
  const r = E.ehBalPower({ p1: src(-1200), pv: src(null, 'onbeschikbaar'), alfen: src(0), praktijk: src(100) }, PR);
  assert.equal(r.woning.w, null);
  assert.equal(r.woning.status, 'onbeschikbaar');
  assert.deepEqual(r.woning.missing, ['pv']);
  assert.equal(r.verbruik.w, null);
  assert.equal(r.eigenZon.w, null);
  assert.equal(r.net.exportW, 1200);          // P1 blijft exact
  assert.equal(r.praktijk.w, 100);            // Praktijk blijft gemeten
  assert.equal(r.cupra.w, 0);
});

test('scenario 8a: Alfen loopt achter na stoppen van laden: niet consistent, geen getal', () => {
  const r = E.ehBalPower({ p1: src(450), pv: src(0), alfen: src(7000), praktijk: src(60) }, PR);
  assert.equal(r.woning.w, null);
  assert.equal(r.woning.reason, 'niet_consistent');
  assert.equal(r.woning.rawW, -6610);
});

test('scenario 8b: GoodWe loopt 40 s achter: alleen de tijdstempelcontrole vangt het', () => {
  const now = 1_000_000;
  const input = { p1: src(1900, 'gemeten', now), pv: src(4000, 'gemeten', now - 40000), alfen: src(3700, 'gemeten', now), praktijk: src(100, 'gemeten', now) };
  // Zonder tijdstempelcontrole lijkt 2100 W plausibel (echt 600 W): het gevaarlijke geval.
  const blind = E.ehBalPower(input, Object.assign({ maxSkewS: null }, PR));
  assert.equal(blind.woning.w, 2100);
  // Met de controle (10 s) geen getal.
  const checked = E.ehBalPower(input, Object.assign({ maxSkewS: 10 }, PR));
  assert.equal(checked.woning.w, null);
  assert.equal(checked.woning.reason, 'niet_synchroon');
  assert.equal(checked.skewS, 40);
  assert.equal(checked.verbruik.reason, 'niet_synchroon');
});

// ---- Veiligheidsvoorwaarden -------------------------------------------------------------------
test('meetruis: tussen -150 en 0 W wordt 0 W met label; daaronder geen getal', () => {
  const noise = E.ehBalPower({ p1: src(100), pv: src(0), alfen: src(0), praktijk: src(180) }, PR);
  assert.equal(noise.woning.w, 0);
  assert.equal(noise.woning.note, 'meetruis');
  const bad = E.ehBalPower({ p1: src(100), pv: src(0), alfen: src(0), praktijk: src(300) }, PR);
  assert.equal(bad.woning.w, null);
  assert.equal(bad.woning.reason, 'niet_consistent');
});

test('bovengrens: Woning boven de aansluitcapaciteit is per definitie fout', () => {
  const r = E.ehBalPower({ p1: src(9800), pv: src(0), alfen: src(0), praktijk: src(0) }, PR);
  assert.equal(r.woning.w, null);
  assert.equal(r.woning.reason, 'boven_aansluiting');
});

test('verouderde bron telt niet mee in de live balans', () => {
  const r = E.ehBalPower({ p1: src(100), pv: src(0), alfen: src(0, 'verouderd'), praktijk: src(10) }, PR);
  assert.equal(r.woning.w, null);
  assert.deepEqual(r.woning.missing, ['alfen']);
});

test('een ontbrekende waarde is nooit stilzwijgend 0', () => {
  for (const missing of ['p1', 'pv', 'alfen', 'praktijk']) {
    const input = { p1: src(100), pv: src(50), alfen: src(0), praktijk: src(10) };
    input[missing] = src(null);
    const r = E.ehBalPower(input, PR);
    assert.equal(r.woning.w, null, missing);
  }
});

test('praktijk niet geconfigureerd: Woning is dan "incl. praktijk" en telt niets af', () => {
  const r = E.ehBalPower({ p1: src(500), pv: src(0), alfen: src(100), praktijk: src(null) }, { praktijkConfigured: false });
  assert.equal(r.woning.w, 400);
  assert.equal(r.woning.inclPraktijk, true);
});

test('P1-teken omkeerbaar met export_positive', () => {
  const r = E.ehBalPower({ p1: src(3900), pv: src(4800), alfen: src(0), praktijk: src(150) },
    { praktijkConfigured: true, p1Sign: 'export_positive' });
  assert.equal(r.woning.w, 750);
  assert.equal(r.net.exportW, 3900);
});

test('statusafleiding: slechtste invoer wint, gemeten wordt berekend', () => {
  assert.equal(E.ehBalDerive(['gemeten', 'gemeten']), 'berekend');
  assert.equal(E.ehBalDerive(['gemeten', 'geschat']), 'geschat');
  assert.equal(E.ehBalWorst(['gemeten', 'verouderd', 'geschat']), 'verouderd');
  assert.equal(E.ehBalWorst(['gemeten', 'onzin']), 'onbeschikbaar');
});

test('eigenschap: voor willekeurige synchrone invoer geldt Woning + Praktijk + Cupra = P1 + PV', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pv = Math.round(rnd() * 6000), alfen = Math.round(rnd() * 7400), prak = Math.round(rnd() * 2500);
    const home = Math.round(rnd() * 2500);
    const p1 = home + prak + alfen - pv;
    const r = E.ehBalPower({ p1: src(p1), pv: src(pv), alfen: src(alfen), praktijk: src(prak) }, PR);
    if (home + prak + alfen <= E.EH_BAL_MAX_HOME_W) {
      assert.equal(r.woning.w, home);
      assert.equal(r.woning.w + prak + alfen, p1 + pv);
      checked++;
    }
  }
  assert.ok(checked > 1000);
});

// ---- kWh uit tellers ----------------------------------------------------------------------------
test('kWh per uur uit tellerverschillen, niet geklemd per bucket', () => {
  const hours = [
    { t: 0, imp: 0.5, exp: 0, pv: 0, alfen: 0, praktijk: 0.1 },
    // Asynchrone tellers: dit uur komt Woning licht negatief uit, het volgende compenseert.
    { t: 3600000, imp: 0.2, exp: 0, pv: 0, alfen: 0.5, praktijk: 0.05 },
    { t: 7200000, imp: 1.0, exp: 0, pv: 0, alfen: 0.4, praktijk: 0.05 }
  ];
  const agg = E.ehBalAggregate(hours, PR);
  near(agg.intervals[1].woning, -0.35);
  // Som zonder klem = 0.4 + (-0.35) + 0.55 = 0.6; mét per-bucket-klem zou 0.95 uitkomen.
  near(agg.totals.woning, 0.6);
  assert.equal(agg.partial, false);
  assert.equal(agg.coverage, 1);
});

test('ontbrekend uur: totaal wordt "(deels)" met dekking, nooit 0', () => {
  const hours = [
    { t: 0, imp: 1, exp: 0, pv: 0, alfen: 0, praktijk: 0.1 },
    { t: 3600000, imp: null, exp: 0, pv: 0, alfen: 0, praktijk: 0.1 },
    { t: 7200000, imp: 1, exp: 0, pv: 0, alfen: 0, praktijk: 0.1 },
    { t: 10800000, imp: 1, exp: 0, pv: 0, alfen: 0, praktijk: 0.1 }
  ];
  const agg = E.ehBalAggregate(hours, PR);
  assert.equal(agg.partial, true);
  assert.equal(agg.complete, 3);
  assert.equal(agg.coverage, 0.75);
  near(agg.totals.woning, 2.7);
  assert.equal(E.ehBalAggregate([], PR).totals.woning, null);
});

test('tellerreset (daling > 0,01 kWh): interval telt niet mee en wordt gemeld', () => {
  const agg = E.ehBalAggregate([{ t: 0, imp: 1, exp: 0, pv: -12, alfen: 0, praktijk: 0 }, { t: 3600000, imp: 1, exp: 0, pv: 0, alfen: 0, praktijk: 0 }], PR);
  assert.equal(agg.resets, 1);
  assert.equal(agg.complete, 1);
  assert.equal(agg.partial, true);
  assert.match(agg.notes.join(' '), /tellerreset/);
  // Een daling binnen 0,01 kWh is afronding, geen reset.
  assert.equal(E.ehBalEnergy({ imp: 1, exp: 0, pv: -0.005, alfen: 0, praktijk: 0 }, PR).complete, true);
});

test('Woning over de periode duidelijk negatief: geen getal maar "niet consistent"', () => {
  const agg = E.ehBalAggregate([{ t: 0, imp: 0.1, exp: 0, pv: 0, alfen: 2, praktijk: 0 }], PR);
  assert.equal(agg.totals.woning, null);
  assert.equal(agg.woningReason, 'niet_consistent');
});

test('uren sleutelen op UTC: dagen van 23, 24 en 25 uur', () => {
  const day = (y, m, d) => [new Date(y, m, d).getTime(), new Date(y, m, d + 1).getTime()];
  // Alleen zinvol als de testzone zomer/wintertijd kent; anders zijn alle dagen 24 uur.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [a, b] = day(2026, 9, 25); // 25 oktober 2026: einde zomertijd (Europe/Amsterdam)
  const hours = E.ehBalHours({}, a, b);
  if (tz === 'Europe/Amsterdam') assert.equal(hours.length, 25);
  else assert.equal(hours.length, Math.round((b - a) / 3600000));
  const [c, d] = day(2026, 2, 29); // 29 maart 2026: begin zomertijd
  if (tz === 'Europe/Amsterdam') assert.equal(E.ehBalHours({}, c, d).length, 23);
  // Het dubbele uur krijgt twee aparte buckets met unieke starttijden.
  assert.equal(new Set(hours.map(h => h.t)).size, hours.length);
});

test('ehBalHours zet statistiekrijen op hun uurstart en laat gaten leeg (null)', () => {
  const from = Date.UTC(2026, 10, 1, 0), to = Date.UTC(2026, 10, 1, 3);
  const h = E.ehBalHours({ imp: [{ t: from, change: 1 }, { t: from + 2 * 3600000, change: 3 }], exp: [{ t: from, change: 0 }] }, from, to);
  assert.equal(h.length, 3);
  assert.equal(h[0].imp, 1);
  assert.equal(h[1].imp, null);
  assert.equal(h[2].imp, 3);
  assert.equal(h[1].exp, null);
});

// ---- Kosten -------------------------------------------------------------------------------------
const T2027 = Date.UTC(2027, 0, 15, 12);
const EX = { t: T2027, imp: 2.5, exp: 0.3, pv: 2.0, alfen: 3.0, praktijk: 0.4 };

test('rekenvoorbeeld uit de review: Woning 0,8 / Praktijk 0,4 / Cupra 3,0 kWh', () => {
  const e = E.ehBalEnergy(EX, PR);
  near(e.woning, 0.8); near(e.verbruik, 4.2); near(e.eigenZon, 1.7);
  const c = E.ehBalCostInterval(e, { p: 0.30, q: 0.07 }, T2027);
  assert.equal(c.regime, 'vergoeding');
  near(c.A.woning, 0.24); near(c.A.praktijk, 0.12); near(c.A.cupra, 0.90);
  near(c.A_total, 1.26);
  near(c.netShare.woning + c.netShare.praktijk + c.netShare.cupra, 0.75);
  near(c.terugleverOpbrengst, 0.021);
  near(c.netKosten, 0.729);
  near(c.zonneImpact, 0.531);
  near(c.A_total - c.zonneImpact, c.netKosten);                     // Σ A − zonne-impact = B
  near(c.netShare.woning + c.netShare.praktijk + c.netShare.cupra - c.terugleverOpbrengst, c.netKosten);
  near(c.gemisteTeruglevering, 1.7 * 0.07);
  // Cupra-aandeel 71,4 %
  near(c.netShare.cupra / c.afnameKosten, 3.0 / 4.2);
});

test('scenario 5 kosten: som van de aandelen is gelijk aan de netkosten, zonne-impact 0', () => {
  const t = Date.UTC(2026, 5, 1, 12);
  const e = E.ehBalEnergy({ t, imp: 8.3, exp: 0, pv: 0, alfen: 6.0, praktijk: 1.8 }, PR);
  const c = E.ehBalCostInterval(e, { p: 0.30 }, t);
  assert.equal(c.regime, 'saldering');
  near(c.afnameKosten, 2.49);
  near(c.netKosten, 2.49);
  near(c.zonneImpact, 0);
  near(c.netShare.praktijk, 1.8 / 8.3 * 2.49);
});

test('saldering eindigt per 1 januari 2027 (lokale middernacht)', () => {
  assert.equal(E.ehBalRegime(Date.UTC(2026, 11, 31, 22, 59)), 'saldering');
  assert.equal(E.ehBalRegime(Date.UTC(2026, 11, 31, 23, 0)), 'vergoeding');
  assert.equal(E.ehBalRegime(Date.UTC(2027, 5, 1)), 'vergoeding');
});

test('onder saldering is q gelijk aan p; vanaf 2027 zonder q blijft de vergoeding onbekend', () => {
  const t26 = Date.UTC(2026, 10, 20, 12);
  const e26 = E.ehBalEnergy({ t: t26, imp: 0, exp: 1, pv: 2, alfen: 0, praktijk: 0 }, PR);
  const c26 = E.ehBalCostInterval(e26, { p: 0.25 }, t26);
  assert.equal(c26.qKnown, true);
  near(c26.netKosten, -0.25);
  const e27 = E.ehBalEnergy({ t: T2027, imp: 0, exp: 1, pv: 2, alfen: 0, praktijk: 0 }, PR);
  const c27 = E.ehBalCostInterval(e27, { p: 0.25 }, T2027);
  assert.equal(c27.qKnown, false);
  assert.equal(c27.netKosten, null);
  assert.equal(c27.zonneImpact, null);
  near(c27.afnameKosten, 0);
});

test('ontbrekende prijs of onvolledige energie geeft geen kosten (nooit 0)', () => {
  const e = E.ehBalEnergy(EX, PR);
  assert.equal(E.ehBalCostInterval(e, { p: null }, T2027).reason, 'prijs_ontbreekt');
  assert.equal(E.ehBalCostInterval(E.ehBalEnergy({ imp: 1 }, PR), { p: 0.3 }, T2027).reason, 'energie_onvolledig');
});

test('kostenaggregatie over uren sluit exact en telt dekking mee', () => {
  const hours = [];
  const prices = new Map();
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 48; i++) {
    const t = T2027 + i * 3600000;
    const pv = i % 24 > 8 && i % 24 < 17 ? rnd() * 3 : 0;
    const woning = 0.2 + rnd() * 0.6, prak = rnd() * 0.3, cupra = rnd() < 0.3 ? rnd() * 5 : 0;
    const cons = woning + prak + cupra;
    const selfUse = Math.min(pv, cons);
    hours.push({ t, imp: cons - selfUse, exp: pv - selfUse, pv, alfen: cupra, praktijk: prak });
    prices.set(t, { p: 0.2 + rnd() * 0.2, q: 0.05 + rnd() * 0.03 });
  }
  const a = E.ehBalCostAggregate(hours, prices, PR);
  assert.equal(a.used, 48);
  assert.equal(a.partial, false);
  assert.ok(a.checks.aMinusZon < 1e-9, 'A − zonne-impact = B');
  assert.ok(a.checks.aandelenMinusTeruglever < 1e-9, 'Σ aandelen − E·q = B');
  assert.deepEqual(a.regimes, ['vergoeding']);
  // Gat in de prijzen: dekking daalt, prijs ontbreekt wordt geteld.
  prices.delete(hours[5].t);
  const b = E.ehBalCostAggregate(hours, prices, PR);
  assert.equal(b.used, 47);
  assert.equal(b.noPrice, 1);
  assert.equal(b.partial, true);
});

test('regimewissel in één periode: beide regimes zichtbaar, q ontbreekt alleen na 2027', () => {
  const tA = Date.UTC(2026, 11, 31, 20), tB = Date.UTC(2027, 0, 1, 1);
  const hours = [tA, tB].map(t => ({ t, imp: 1, exp: 0.5, pv: 1, alfen: 0, praktijk: 0 }));
  const prices = new Map([[tA, { p: 0.3 }], [tB, { p: 0.3 }]]);
  const a = E.ehBalCostAggregate(hours, prices, PR);
  assert.deepEqual(a.regimes, ['saldering', 'vergoeding']);
  assert.equal(a.qComplete, false);
  assert.equal(a.netKosten, null);
  assert.equal(a.qMissing, 1);
});

test('centen verdelen zonder verlies: delen tellen exact op tot het totaal', () => {
  for (const [vals, total] of [[[0.1429, 0.0714, 0.5357], 0.75], [[1 / 3, 1 / 3, 1 / 3], 1], [[0.005, 0.005, 0.005], 0.02]]) {
    const parts = E.ehBalSplitCents(vals, total);
    near(parts.reduce((a, b) => a + b, 0), total, 1e-9);
  }
});

// ---- Meetcontrole -------------------------------------------------------------------------------
test('P1-teken uit vermogen tegenover tellers', () => {
  const ok = [], rev = [];
  for (let i = 0; i < 10; i++) {
    ok.push({ meanW: -1500, imp: 0, exp: 1.5 });
    rev.push({ meanW: 1500, imp: 0, exp: 1.5 });
  }
  assert.equal(E.ehBalSignCheck(ok).verdict, 'import_positive');
  assert.equal(E.ehBalSignCheck(rev).verdict, 'export_positive');
  assert.equal(E.ehBalSignCheck(ok.slice(0, 3)).verdict, 'onvoldoende_data');
  const mixed = ok.slice(0, 5).concat(rev.slice(0, 5));
  assert.equal(E.ehBalSignCheck(mixed).verdict, 'onduidelijk');
});

test('PV-vermogen tegenover teller: DC-indicatie bij 2-8 % afwijking', () => {
  const rows = f => Array.from({ length: 8 }, () => ({ meanW: 3000 * f, change: 3 }));
  assert.equal(E.ehBalRatioCheck(rows(1.0)).verdict, 'ok');
  assert.equal(E.ehBalRatioCheck(rows(1.03)).verdict, 'vermogen_hoger');
  assert.equal(E.ehBalRatioCheck(rows(1.2)).verdict, 'afwijkend_hoog');
  assert.equal(E.ehBalRatioCheck(rows(0.9)).verdict, 'vermogen_lager');
  assert.equal(E.ehBalRatioCheck(rows(1).slice(0, 2)).verdict, 'onvoldoende_data');
  near(E.ehBalRatioCheck(rows(1.03)).ratio, 1.03, 1e-9);
});

test('sluitingscontrole: vaak negatieve Woning-uren worden gemeld', () => {
  const good = Array.from({ length: 10 }, (_, i) => ({ t: i, imp: 1, exp: 0, pv: 0, alfen: 0.2, praktijk: 0.1 }));
  assert.equal(E.ehBalClosureCheck(good, PR).verdict, 'ok');
  const bad = good.map((h, i) => (i % 2 ? Object.assign({}, h, { alfen: 2 }) : h));
  const r = E.ehBalClosureCheck(bad, PR);
  assert.equal(r.verdict, 'vaak_negatief');
  assert.equal(r.negative, 5);
});

// ---- Standalone inbedding ---------------------------------------------------------------------------
test('engine draait zonder Home Assistant, DOM of opslag en exporteert al zijn functies', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'engines', 'balance-engine.cjs'), 'utf8');
  for (const banned of ['document.', 'window.', 'localStorage', 'hass', 'callService', 'callWS', 'fetch(']) {
    assert.equal(code.includes(banned), false, 'engine mag ' + banned + ' niet gebruiken');
  }
  // Als klassiek script (zoals in de HACS-bundel): geen module/exports beschikbaar.
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  assert.equal(typeof ctx.ehBalPower, 'function');
  assert.equal(typeof ctx.ehBalCostAggregate, 'function');
});
