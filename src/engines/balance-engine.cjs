/* Energiehuis 3.0: browser-safe, standalone balans-, kWh- en kostenmotor.
 * Geen Home Assistant, DOM, opslag of netwerk. Definities volgens de engineeringreview
 * "Energiehuis 2.0 — Engineeringreview energiebalans".
 *
 *   Woning  = P1 + PV - Alfen - Praktijk          (restpost; P1 positief = afname, PV = AC)
 *   Verbruik = P1 + PV                            (Woning + Praktijk + Cupra)
 *   Eigen zon = PV - teruglevering
 *   kWh komen uit tellers (Δ per uur), nooit uit vermogen; niet per bucket klemmen.
 *   Kosten in drie lagen: A verbruikswaarde, B netkosten, C zonne-impact; sluiten exact.
 */
const EH_BAL_STATUS = Object.freeze(['gemeten', 'berekend', 'geschat', 'verouderd', 'onbeschikbaar']);
const EH_BAL_NOISE_W = 150;
const EH_BAL_MAX_HOME_W = 9200; // 1x40 A, 230 V
const EH_BAL_RESET_KWH = 0.01;
const EH_BAL_NEG_TOTAL_KWH = 0.05;
// Saldering eindigt per 1 januari 2027 (lokale middernacht Europe/Amsterdam = 31 dec 23:00 UTC).
const EH_BAL_SALDERING_END_MS = Date.UTC(2026, 11, 31, 23, 0, 0);
const EH_BAL_HOUR_MS = 3600000;

function ehBalNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Slechtste status wint. Onbekende statussen tellen als onbeschikbaar.
function ehBalWorst(list) {
  let worst = 0;
  for (const s of list) {
    let i = EH_BAL_STATUS.indexOf(s);
    if (i < 0) i = EH_BAL_STATUS.length - 1;
    if (i > worst) worst = i;
  }
  return EH_BAL_STATUS[worst];
}

// Een afgeleide waarde uit uitsluitend gemeten invoer heet 'berekend'.
function ehBalDerive(statuses) {
  const w = ehBalWorst(statuses);
  return w === 'gemeten' ? 'berekend' : w;
}

function ehBalSource(src) {
  if (!src || typeof src !== 'object') return { w: null, status: 'onbeschikbaar', t: null };
  const w = ehBalNum(src.w);
  let status = EH_BAL_STATUS.includes(src.status) ? src.status : (w === null ? 'onbeschikbaar' : 'gemeten');
  if (w === null) status = 'onbeschikbaar';
  return { w, status, t: Number.isFinite(src.t) ? src.t : null, reason: src.reason || null };
}

// PV = 0 W is alleen bewezen als "geschat (nacht)" als de zon onder de horizon staat én de laatste
// geldige GoodWe-waarde vóór de uitval onder 50 W lag. Anders blijft PV onbeschikbaar (nooit stilzwijgend 0).
function ehBalNightPv(pv, evidence) {
  const s = ehBalSource(pv);
  if (s.w !== null) return s;
  const e = evidence || {};
  const last = ehBalNum(e.lastValidW);
  if (e.belowHorizon === true && last !== null && last < 50) {
    return { w: 0, status: 'geschat', t: s.t, reason: 'nacht' };
  }
  return s;
}

// Vermogensbalans op één moment.
// input: { p1, pv, alfen, praktijk } met elk { w, status, t(ms) }.
function ehBalPower(input, opts) {
  const o = Object.assign({ noiseW: EH_BAL_NOISE_W, maxHomeW: EH_BAL_MAX_HOME_W, maxSkewS: null,
    p1Sign: 'import_positive', praktijkConfigured: false }, opts || {});
  const inp = input || {};
  const p1 = ehBalSource(inp.p1), pv = ehBalSource(inp.pv), al = ehBalSource(inp.alfen), pr = ehBalSource(inp.praktijk);
  if (o.p1Sign === 'export_positive' && p1.w !== null) p1.w = -p1.w;
  const usable = s => s.w !== null && (s.status === 'gemeten' || s.status === 'geschat');
  const none = reason => ({ w: null, status: 'onbeschikbaar', reason, note: null });

  const out = {
    p1Sign: o.p1Sign,
    praktijkConfigured: !!o.praktijkConfigured,
    net: { w: p1.w, importW: null, exportW: null, status: p1.status },
    pv: { w: pv.w, status: pv.status, reason: pv.reason },
    cupra: { w: al.w, status: al.status },
    praktijk: { w: o.praktijkConfigured ? pr.w : null, status: o.praktijkConfigured ? pr.status : 'onbeschikbaar' },
    verbruik: none('bron_ontbreekt'), eigenZon: none('bron_ontbreekt'), woning: none('bron_ontbreekt'),
    skewS: null, identityOk: null
  };
  if (usable(p1)) {
    out.net.importW = Math.max(0, p1.w);
    out.net.exportW = Math.max(0, -p1.w);
  }

  // Spreiding tussen tijdstempels van de gebruikte bronnen.
  const used = [p1, pv, al].concat(o.praktijkConfigured ? [pr] : []);
  const times = used.map(s => s.t);
  if (times.every(t => t !== null)) out.skewS = (Math.max(...times) - Math.min(...times)) / 1000;
  const skewBad = o.maxSkewS !== null && out.skewS !== null && out.skewS > o.maxSkewS;

  // Verbruik = P1 + PV
  if (usable(p1) && usable(pv)) {
    const status = ehBalDerive([p1.status, pv.status]);
    const raw = p1.w + pv.w;
    if (skewBad) out.verbruik = none('niet_synchroon');
    else if (raw < -o.noiseW) out.verbruik = none('niet_consistent');
    else out.verbruik = { w: Math.max(0, raw), status, reason: null, note: raw < 0 ? 'meetruis' : null, rawW: raw };
    // Eigen zon = PV - teruglevering
    const eigen = pv.w - out.net.exportW;
    if (skewBad) out.eigenZon = none('niet_synchroon');
    else if (eigen < -o.noiseW) out.eigenZon = none('niet_consistent');
    else out.eigenZon = { w: Math.max(0, eigen), status, reason: null, note: eigen < 0 ? 'meetruis' : null };
  }

  // Woning = P1 + PV - Alfen - Praktijk
  const needed = [p1, pv, al].concat(o.praktijkConfigured ? [pr] : []);
  if (needed.every(usable)) {
    const status = ehBalDerive(needed.map(s => s.status));
    const raw = p1.w + pv.w - al.w - (o.praktijkConfigured ? pr.w : 0);
    if (skewBad) out.woning = Object.assign(none('niet_synchroon'), { rawW: raw });
    else if (raw < -o.noiseW) out.woning = Object.assign(none('niet_consistent'), { rawW: raw });
    else if (raw > o.maxHomeW) out.woning = Object.assign(none('boven_aansluiting'), { rawW: raw });
    else {
      out.woning = { w: Math.max(0, raw), status, reason: null, note: raw < 0 ? 'meetruis' : null, rawW: raw,
        inclPraktijk: !o.praktijkConfigured };
      out.identityOk = Math.abs((out.woning.rawW + (o.praktijkConfigured ? pr.w : 0) + al.w) - (p1.w + pv.w)) < 1e-6;
    }
  } else {
    out.woning = none('bron_ontbreekt');
    out.woning.missing = [['p1', p1], ['pv', pv], ['alfen', al]].concat(o.praktijkConfigured ? [['praktijk', pr]] : [])
      .filter(([, s]) => !usable(s)).map(([k]) => k);
  }
  return out;
}

// Energie per interval uit tellerverschillen (kWh). Nooit klemmen per bucket.
// iv: { imp, exp, pv, alfen, praktijk }
function ehBalEnergy(iv, opts) {
  const o = Object.assign({ praktijkConfigured: false }, opts || {});
  const src = iv || {};
  const keys = ['imp', 'exp', 'pv', 'alfen'].concat(o.praktijkConfigured ? ['praktijk'] : []);
  const missing = [], resets = [], val = {};
  for (const k of keys) {
    const n = ehBalNum(src[k]);
    if (n === null) missing.push(k);
    else if (n < -EH_BAL_RESET_KWH) resets.push(k); // teller omlaag = reset: interval telt niet mee
    else val[k] = Math.max(0, n);
  }
  const complete = !missing.length && !resets.length;
  const r = {
    complete, missing, resets,
    import: val.imp === undefined ? null : val.imp,
    export: val.exp === undefined ? null : val.exp,
    pv: val.pv === undefined ? null : val.pv,
    cupra: val.alfen === undefined ? null : val.alfen,
    praktijk: o.praktijkConfigured && val.praktijk !== undefined ? val.praktijk : null,
    verbruik: null, woning: null, eigenZon: null
  };
  if (complete) {
    r.verbruik = val.imp - val.exp + val.pv;
    r.woning = r.verbruik - val.alfen - (o.praktijkConfigured ? val.praktijk : 0);
    r.eigenZon = val.pv - val.exp;
  }
  return r;
}

// Bouwt een lijst uurintervallen uit genormaliseerde statistiekreeksen.
// series: { imp:[{t,change}], exp:[...], pv:[...], alfen:[...], praktijk:[...] }; t = starttijd in ms (UTC).
// Sleutelt op UTC-tijdstempel: een lokale dag heeft 23, 24 of 25 uren, het dubbele uur krijgt twee buckets.
function ehBalHours(series, fromMs, toMs) {
  const n = Math.max(0, Math.round((toMs - fromMs) / EH_BAL_HOUR_MS));
  const maps = {};
  for (const k of Object.keys(series || {})) {
    maps[k] = new Map();
    for (const row of series[k] || []) {
      const t = ehBalNum(row && row.t), c = ehBalNum(row && row.change);
      if (t !== null && c !== null) maps[k].set(Math.round(t / EH_BAL_HOUR_MS) * EH_BAL_HOUR_MS, c);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = fromMs + i * EH_BAL_HOUR_MS, iv = { t };
    for (const k of ['imp', 'exp', 'pv', 'alfen', 'praktijk']) iv[k] = maps[k] && maps[k].has(t) ? maps[k].get(t) : null;
    out.push(iv);
  }
  return out;
}

// Telt intervallen op. Afgeleide totalen (Woning, Verbruik, Eigen zon) tellen uitsluitend volledige
// intervallen; losse tellers tellen elk hun eigen beschikbare intervallen.
function ehBalAggregate(intervals, opts) {
  const o = Object.assign({ praktijkConfigured: false, expected: null }, opts || {});
  const list = Array.isArray(intervals) ? intervals : [];
  const tot = { import: 0, export: 0, pv: 0, cupra: 0, praktijk: 0, woning: 0, verbruik: 0, eigenZon: 0 };
  const seen = { import: 0, export: 0, pv: 0, cupra: 0, praktijk: 0 };
  let complete = 0, resets = 0;
  const per = [];
  for (const iv of list) {
    const e = ehBalEnergy(iv, { praktijkConfigured: o.praktijkConfigured });
    e.t = iv && iv.t !== undefined ? iv.t : null;
    per.push(e);
    if (e.resets.length) resets++;
    for (const k of ['import', 'export', 'pv', 'cupra', 'praktijk']) {
      if (e[k] !== null) { tot[k] += e[k]; seen[k]++; }
    }
    if (e.complete) {
      complete++;
      tot.woning += e.woning; tot.verbruik += e.verbruik; tot.eigenZon += e.eigenZon;
    }
  }
  const expected = o.expected === null ? list.length : o.expected;
  const coverage = expected > 0 ? complete / expected : 0;
  const out = {
    intervals: per, n: list.length, expected, complete, resets, coverage,
    partial: expected === 0 || complete < expected,
    totals: {}, notes: []
  };
  out.totals.import = seen.import ? tot.import : null;
  out.totals.export = seen.export ? tot.export : null;
  out.totals.pv = seen.pv ? tot.pv : null;
  out.totals.cupra = seen.cupra ? tot.cupra : null;
  out.totals.praktijk = o.praktijkConfigured && seen.praktijk ? tot.praktijk : null;
  out.totals.verbruik = complete ? tot.verbruik : null;
  out.totals.eigenZon = complete ? tot.eigenZon : null;
  out.totals.woning = complete ? tot.woning : null;
  out.woningReason = null;
  if (complete && tot.woning < -EH_BAL_NEG_TOTAL_KWH) {
    out.totals.woning = null;
    out.woningReason = 'niet_consistent';
    out.notes.push('Woning komt over de periode negatief uit: controleer tellers en meetlocatie.');
  } else if (complete && tot.woning < 0) {
    out.totals.woning = 0; // alleen bij weergave, niet per uur
    out.notes.push('Woning licht negatief (meetruis), getoond als 0.');
  }
  if (out.totals.eigenZon !== null && out.totals.eigenZon < 0) out.totals.eigenZon = 0;
  if (resets) out.notes.push(resets + ' interval(len) met tellerreset niet meegeteld.');
  return out;
}

// ---- Kosten ---------------------------------------------------------------------------------

// Saldering t/m 31 december 2026; daarna wordt teruglevering apart vergoed.
function ehBalRegime(tMs) {
  return Number(tMs) >= EH_BAL_SALDERING_END_MS ? 'vergoeding' : 'saldering';
}

// Verdeelt een bedrag in centen zodat de delen exact optellen tot het totaal (grootste restmethode).
function ehBalSplitCents(values, totalEuro) {
  const total = Math.round(totalEuro * 100);
  const raw = values.map(v => v * 100);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  const out = floors.slice();
  for (let k = 0; rest > 0 && k < order.length; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  for (let k = order.length - 1; rest < 0 && k >= 0; k = (k - 1 + order.length) % order.length, rest++) out[order[k][1]]--;
  return out.map(c => c / 100);
}

// Kostenlagen voor één uur.
// e: ehBalEnergy-uitkomst (complete). price: { p, q }. q wordt onder saldering gelijkgesteld aan p.
//   A verbruikswaarde  = C_i * p
//   B netkosten        = I*p - E*q                  (totaal gemeten, verdeling = verdeelsleutel)
//   C zonne-impact     = S*p + E*q = A - B
function ehBalCostInterval(e, price, tMs) {
  const p = ehBalNum(price && price.p);
  if (!e || !e.complete) return { complete: false, reason: 'energie_onvolledig' };
  if (p === null) return { complete: false, reason: 'prijs_ontbreekt' };
  const regime = ehBalRegime(tMs);
  const q = regime === 'saldering' ? p : ehBalNum(price && price.q);
  const C = e.verbruik, I = e.import, E = e.export, S = e.eigenZon;
  const cons = { woning: e.woning, praktijk: e.praktijk === null ? 0 : e.praktijk, cupra: e.cupra };
  const A = {};
  for (const k of Object.keys(cons)) A[k] = cons[k] * p;
  const share = {};
  for (const k of Object.keys(cons)) share[k] = C > 0 ? cons[k] / C * I * p : 0;
  const r = {
    complete: true, regime, qKnown: q !== null, p, q,
    kwh: { verbruik: C, import: I, export: E, eigenZon: S },
    A, A_total: C * p, afnameKosten: I * p, netShare: share,
    terugleverOpbrengst: q === null ? null : E * q,
    netKosten: q === null ? null : I * p - E * q,
    zonneImpact: q === null ? null : S * p + E * q,
    gemisteTeruglevering: q === null ? null : S * q
  };
  return r;
}

// Kosten over een periode. hours: [{t, imp, exp, pv, alfen, praktijk}], prices: Map|object t(ms) -> {p, q}.
function ehBalCostAggregate(hours, prices, opts) {
  const o = Object.assign({ praktijkConfigured: false, expected: null }, opts || {});
  const get = t => {
    if (!prices) return null;
    if (prices instanceof Map) return prices.get(t) || null;
    return prices[t] || null;
  };
  const sum = { A: { woning: 0, praktijk: 0, cupra: 0 }, A_total: 0, netShare: { woning: 0, praktijk: 0, cupra: 0 },
    afnameKosten: 0, terugleverOpbrengst: 0, netKosten: 0, zonneImpact: 0, gemisteTeruglevering: 0,
    kwh: { verbruik: 0, import: 0, export: 0, eigenZon: 0 } };
  let used = 0, noEnergy = 0, noPrice = 0, qMissing = 0;
  const regimes = new Set();
  const list = Array.isArray(hours) ? hours : [];
  for (const h of list) {
    const e = ehBalEnergy(h, { praktijkConfigured: o.praktijkConfigured });
    const c = ehBalCostInterval(e, get(h.t), h.t);
    if (!c.complete) { if (c.reason === 'prijs_ontbreekt') noPrice++; else noEnergy++; continue; }
    used++;
    regimes.add(c.regime);
    for (const k of Object.keys(sum.A)) { sum.A[k] += c.A[k]; sum.netShare[k] += c.netShare[k]; }
    sum.A_total += c.A_total; sum.afnameKosten += c.afnameKosten;
    for (const k of Object.keys(sum.kwh)) sum.kwh[k] += c.kwh[k];
    if (c.qKnown) {
      sum.terugleverOpbrengst += c.terugleverOpbrengst; sum.netKosten += c.netKosten;
      sum.zonneImpact += c.zonneImpact; sum.gemisteTeruglevering += c.gemisteTeruglevering;
    } else {
      qMissing++;
    }
  }
  const expected = o.expected === null ? list.length : o.expected;
  const qComplete = qMissing === 0;
  const out = {
    expected, used, noEnergy, noPrice, qMissing, regimes: Array.from(regimes).sort(),
    coverage: expected > 0 ? used / expected : 0, partial: expected === 0 || used < expected,
    qComplete,
    A: sum.A, A_total: sum.A_total, netShare: sum.netShare, afnameKosten: sum.afnameKosten,
    terugleverOpbrengst: qComplete ? sum.terugleverOpbrengst : null,
    netKosten: qComplete ? sum.netKosten : null,
    zonneImpact: qComplete ? sum.zonneImpact : null,
    gemisteTeruglevering: qComplete ? sum.gemisteTeruglevering : null,
    kwh: sum.kwh,
    checks: null
  };
  // Controles die altijd moeten sluiten: som A - zonne-impact = B, som aandelen - E*q = B.
  if (qComplete && used) {
    out.checks = {
      aMinusZon: Math.abs(out.A_total - out.zonneImpact - out.netKosten),
      aandelenMinusTeruglever: Math.abs((out.netShare.woning + out.netShare.praktijk + out.netShare.cupra) - out.terugleverOpbrengst - out.netKosten)
    };
  }
  return out;
}

// ---- Meetcontrole (diagnose op uurdata) ---------------------------------------------------------

// P1-teken: vergelijkt het uurgemiddelde van het P1-vermogen (W) met (import - export) uit de tellers.
// rows: [{ meanW, imp, exp }]
function ehBalSignCheck(rows) {
  let agree = 0, disagree = 0;
  for (const r of rows || []) {
    const w = ehBalNum(r && r.meanW), a = ehBalNum(r && r.imp), b = ehBalNum(r && r.exp);
    if (w === null || a === null || b === null) continue;
    const net = a - b;
    if (Math.abs(w) < 50 || Math.abs(net) < 0.05) continue;
    if ((w > 0) === (net > 0)) agree++; else disagree++;
  }
  const n = agree + disagree;
  let verdict = 'onvoldoende_data';
  if (n >= 6) {
    const share = agree / n;
    verdict = share >= 0.85 ? 'import_positive' : share <= 0.15 ? 'export_positive' : 'onduidelijk';
  }
  return { n, agree, disagree, verdict };
}

// Vermogensgemiddelde (W) tegenover de teller (kWh) per uur. Een structurele afwijking van 2-8 %
// bij PV wijst erop dat het vermogen DC (voor de omvormer) is en de teller AC.
// rows: [{ meanW, change }]
function ehBalRatioCheck(rows, opts) {
  const o = Object.assign({ minKwh: 2, minRows: 6, tol: 0.015, maxDc: 0.08 }, opts || {});
  let kw = 0, kwh = 0, n = 0;
  for (const r of rows || []) {
    const w = ehBalNum(r && r.meanW), c = ehBalNum(r && r.change);
    if (w === null || c === null || c < 0) continue;
    kw += Math.max(0, w) / 1000; kwh += c; n++;
  }
  if (n < o.minRows || kwh < o.minKwh) return { n, kwh, ratio: null, verdict: 'onvoldoende_data' };
  const ratio = kw / kwh;
  let verdict = 'ok';
  if (ratio > 1 + o.tol) verdict = ratio <= 1 + o.maxDc ? 'vermogen_hoger' : 'afwijkend_hoog';
  else if (ratio < 1 - 2 * o.tol) verdict = 'vermogen_lager';
  return { n, kwh, ratio, verdict };
}

// Sluiting van de uurbalans: hoeveel uren komt Woning duidelijk negatief uit.
function ehBalClosureCheck(hours, opts) {
  const o = Object.assign({ praktijkConfigured: false, thresholdKwh: 0.15 }, opts || {});
  let n = 0, negative = 0, worst = 0;
  for (const h of hours || []) {
    const e = ehBalEnergy(h, { praktijkConfigured: o.praktijkConfigured });
    if (!e.complete) continue;
    n++;
    if (e.woning < -o.thresholdKwh) { negative++; if (e.woning < worst) worst = e.woning; }
  }
  const share = n ? negative / n : 0;
  return { n, negative, share, worstKwh: worst, verdict: n < 6 ? 'onvoldoende_data' : share > 0.05 ? 'vaak_negatief' : 'ok' };
}

// Classic-script global functions remain available to Energiehuis; CommonJS exports for isolated tests.
if (typeof module !== 'undefined' && module) {
  // Immutable host exports must not prevent the classic-script card from registering.
  try {
    if (module.exports) Object.assign(module.exports, {
      EH_BAL_STATUS, EH_BAL_NOISE_W, EH_BAL_MAX_HOME_W, EH_BAL_SALDERING_END_MS,
      ehBalNum, ehBalWorst, ehBalDerive, ehBalSource, ehBalNightPv, ehBalPower, ehBalEnergy, ehBalHours,
      ehBalAggregate, ehBalRegime, ehBalSplitCents, ehBalCostInterval, ehBalCostAggregate,
      ehBalSignCheck, ehBalRatioCheck, ehBalClosureCheck
    });
  } catch (_) {}
}
