/* Energiehuis 3.2: browser-safe kwartierprijsmotor. Geen Home Assistant, DOM, opslag of netwerk. */
// Energiehuis 3.2 — kwartierprijzen: pure berekeningen (geen HA, geen DOM). Alleen prijzen die al bekend zijn.
// Alles wat niet bekend is blijft null; er wordt nooit een prijs verzonnen of aangevuld.
const EH_QT_STEP_MS = 900000;

function ehQtNum(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : null;
}

// quarters: [{t: ISO-tekst of ms, p: €/kWh}] ; geeft de kwartieren binnen [startMs, endMs), uniek en gesorteerd.
function ehQtDay(quarters, startMs, endMs) {
  const map = new Map();
  for (const q of Array.isArray(quarters) ? quarters : []) {
    const t = typeof q?.t === 'number' ? q.t : Date.parse(q?.t || '');
    const p = ehQtNum(q?.p);
    if (!Number.isFinite(t) || p === null || t < startMs || t >= endMs) continue;
    const slot = Math.floor(t / EH_QT_STEP_MS) * EH_QT_STEP_MS;
    if (!map.has(slot)) map.set(slot, p);
  }
  const slots = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, p]) => ({ t, p }));
  const expected = Math.round((endMs - startMs) / EH_QT_STEP_MS);
  return { slots, expected, complete: slots.length === expected, known: slots.length };
}

function ehQtStats(slots, nowMs) {
  if (!slots.length) return null;
  let min = slots[0], max = slots[0], sum = 0;
  for (const s of slots) { if (s.p < min.p) min = s; if (s.p > max.p) max = s; sum += s.p; }
  const avg = sum / slots.length;
  const cur = slots.find(s => nowMs >= s.t && nowMs < s.t + EH_QT_STEP_MS) || null;
  return { min, max, avg, current: cur, vsAvg: cur && avg !== 0 ? (cur.p - avg) / Math.abs(avg) : null };
}

// Beste aaneengesloten venster van `hours` uur dat niet vóór fromMs begint. Alleen volledig bekende, opeenvolgende kwartieren.
function ehQtWindow(slots, hours, fromMs) {
  const n = Math.round(hours * 4);
  if (!(n > 0) || slots.length < n) return null;
  let best = null;
  for (let i = 0; i + n <= slots.length; i++) {
    if (slots[i].t + EH_QT_STEP_MS <= fromMs) continue;
    let ok = true, sum = 0;
    for (let j = 0; j < n; j++) {
      if (j && slots[i + j].t - slots[i + j - 1].t !== EH_QT_STEP_MS) { ok = false; break; }
      sum += slots[i + j].p;
    }
    if (!ok) continue;
    const avg = sum / n;
    if (!best || avg < best.avg - 1e-12) best = { start: slots[i].t, end: slots[i + n - 1].t + EH_QT_STEP_MS, avg, hours };
  }
  return best;
}

// Drie klassen op basis van het bereik van de getoonde dag.
function ehQtTier(p, min, max) {
  if (!(max > min)) return 'mid';
  const r = (p - min) / (max - min);
  return r < 1 / 3 ? 'low' : r < 2 / 3 ? 'mid' : 'high';
}

// ---- Terugkijken: kosten per kwartier uit de prijsgeschiedenis en de 5-minutenstatistiek -------------------------
// states: [{t(ms), p(€/kWh of null)}] gesorteerd; geeft per kwartierstart de prijs die op dat moment gold (stapfunctie).
function ehQtPricesFromHistory(states, startMs, endMs) {
  const list = (Array.isArray(states) ? states : []).filter(x => Number.isFinite(x && x.t)).sort((a, b) => a.t - b.t);
  const out = new Map();
  if (!list.length) return out;
  for (let t = startMs; t < endMs; t += EH_QT_STEP_MS) {
    let cur = null;
    // Prijs op het midden van het kwartier: een sensor die enkele seconden na de kwartiergrens bijwerkt, hoort nog bij dit kwartier.
    for (const x of list) { if (x.t <= t + EH_QT_STEP_MS / 2) cur = x; else break; }
    // Geen waarde vóór dit kwartier: onbekend (niet aanvullen met een latere waarde).
    if (cur && ehQtNum(cur.p) !== null) out.set(t, cur.p);
  }
  return out;
}

// rows: [{start(ms), change(kWh)}] per 5 minuten. Een kwartier telt alleen mee met drie complete, niet-negatieve buckets.
function ehQtSumQuarters(rows, startMs, endMs) {
  const buckets = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = Number(r && r.start), c = ehQtNum(r && r.change);
    if (Number.isFinite(t) && c !== null) buckets.set(t, c);
  }
  const out = new Map();
  for (let t = startMs; t < endMs; t += EH_QT_STEP_MS) {
    let sum = 0, ok = true;
    for (let k = 0; k < 3; k++) {
      const c = buckets.get(t + k * 300000);
      if (c === undefined || c < -1e-9) { ok = false; break; }
      sum += Math.max(0, c);
    }
    if (ok) out.set(t, sum);
  }
  return out;
}

// Netto kosten per kwartier: afname × prijs − teruglevering × vergoeding. Tot en met 2026-12-31 geldt saldering (vergoeding = prijs);
// daarna alleen met een bekende vergoeding, anders blijft de netto-uitkomst leeg (alleen afnamekosten).
function ehQtCostDay(priceMap, impMap, expMap, startMs, endMs, opts) {
  const o = Object.assign({ salderingEndMs: Infinity, feedin: null }, opts || {});
  const rows = [];
  const tot = { imp: 0, exp: 0, afname: 0, opbrengst: 0, netto: 0, complete: 0, nettoKnown: true };
  for (let t = startMs; t < endMs; t += EH_QT_STEP_MS) {
    const p = ehQtNum(priceMap.get(t)), imp = impMap.has(t) ? impMap.get(t) : null, exp = expMap.has(t) ? expMap.get(t) : null;
    const complete = p !== null && imp !== null && exp !== null;
    let q = t < o.salderingEndMs ? p : ehQtNum(o.feedin);
    const row = { t, p, imp, exp, complete, afname: null, opbrengst: null, netto: null };
    if (complete) {
      row.afname = imp * p;
      row.opbrengst = q === null ? null : exp * q;
      row.netto = q === null ? null : row.afname - row.opbrengst;
      tot.complete++; tot.imp += imp; tot.exp += exp; tot.afname += row.afname;
      if (q === null) tot.nettoKnown = false; else { tot.opbrengst += row.opbrengst; tot.netto += row.netto; }
    }
    rows.push(row);
  }
  return { rows, total: tot, expected: rows.length };
}

// ---- Weerindicatie (geen prijsvoorspelling): wind en zon wijzen vaak naar goedkopere uren, windstil en donker weer naar duurdere. ----
const EH_WX_WIND_STRONG = 7;   // m/s daggemiddelde: veel wind
const EH_WX_WIND_WEAK = 3.5;   // m/s daggemiddelde: weinig wind
function ehWxMs(speed, unit) {
  const v = ehQtNum(speed);
  if (v === null || v < 0) return null;
  const u = String(unit || 'km/h').toLowerCase();
  if (u === 'm/s') return v;
  if (u === 'mph') return v * 0.44704;
  if (u === 'kn' || u === 'kt') return v * 0.514444;
  if (u === 'ft/s') return v * 0.3048;
  return v / 3.6; // km/h (standaard van Home Assistant)
}
const EH_WX_CLOUD_BY_CONDITION = { 'sunny': 10, 'clear-night': 10, 'partlycloudy': 50, 'cloudy': 90, 'fog': 90, 'rainy': 90, 'pouring': 95, 'snowy': 90, 'snowy-rainy': 90, 'hail': 90, 'lightning': 90, 'lightning-rainy': 90, 'windy': 40, 'windy-variant': 60 };
function ehWxCloud(entry) {
  const c = ehQtNum(entry && entry.cloud_coverage);
  if (c !== null) return Math.max(0, Math.min(100, c));
  const k = entry && EH_WX_CLOUD_BY_CONDITION[entry.condition];
  return k === undefined ? null : k;
}
// Normaliseert een dagelijkse voorspelling van een weather-entiteit tot [{dayKey,t,wind,cloud,temp}] vanaf vandaag, maximaal 7 dagen.
function ehWxDays(daily, nowMs, unit, dayKey) {
  const out = [], seen = new Set();
  const n0 = new Date(nowMs), todayStart = new Date(n0.getFullYear(), n0.getMonth(), n0.getDate()).getTime();
  for (const e of Array.isArray(daily) ? daily : []) {
    const t = Date.parse(e && e.datetime);
    if (!Number.isFinite(t)) continue;
    const key = dayKey(t);
    // Vergelijk op tijd: dagsleutels zijn niet opgevuld met nullen ('2026-11-10' < '2026-11-9' als tekst).
    if (t < todayStart || seen.has(key)) continue;
    seen.add(key);
    const hi = ehQtNum(e.temperature), lo = ehQtNum(e.templow);
    out.push({ dayKey: key, t, wind: ehWxMs(e.wind_speed, unit), cloud: ehWxCloud(e), temp: hi !== null && lo !== null ? (hi + lo) / 2 : hi });
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 7);
}
// score >= 1 → goedkoper, <= -1 → duurder; de redenen worden getoond zodat de indicatie controleerbaar is.
function ehWxIndication(day, month) {
  let score = 0; const reasons = [];
  const summer = month >= 3 && month <= 8;
  if (day.wind !== null) {
    if (day.wind >= EH_WX_WIND_STRONG) { score += 1; reasons.push('veel wind'); }
    else if (day.wind <= EH_WX_WIND_WEAK) { score -= 1; reasons.push('weinig wind'); }
  }
  if (day.cloud !== null) {
    if (summer && day.cloud <= 35) { score += 0.5; reasons.push('zonnig'); }
    else if (!summer && day.cloud >= 80 && day.wind !== null && day.wind <= EH_WX_WIND_WEAK) { score -= 0.5; reasons.push('donker en windstil'); }
  }
  if (day.temp !== null && day.temp <= 2) { score -= 0.5; reasons.push('koud (hoge vraag)'); }
  const level = score >= 1 ? 'cheaper' : score <= -1 ? 'pricier' : 'average';
  return { score, level, reasons };
}

// ---- Terugblik: hoe goed klopte de weerindicatie de afgelopen dagen? ----
// entries: [{t, wind(m/s), cloud, temp}] uit de toestandsgeschiedenis van de weer-entiteit; geeft per dag het gemiddelde.
function ehWxHistoryDays(entries, dayKey) {
  const by = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !Number.isFinite(e.t)) continue;
    const k = dayKey(e.t);
    if (!by.has(k)) by.set(k, { dayKey: k, t: e.t, w: [], c: [], tp: [] });
    const g = by.get(k);
    if (g.t > e.t) g.t = e.t;
    if (Number.isFinite(e.wind)) g.w.push(e.wind);
    if (Number.isFinite(e.cloud)) g.c.push(e.cloud);
    if (Number.isFinite(e.temp)) g.tp.push(e.temp);
  }
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return [...by.values()].sort((a, b) => a.t - b.t).map(g => ({ dayKey: g.dayKey, t: g.t, wind: mean(g.w), cloud: mean(g.c), temp: mean(g.tp) }));
}
// days: [{dayKey,t,wind,cloud,temp,avg}] met avg = gemiddelde dagprijs (alleen complete dagen, anders null).
// Werkelijk duurder/goedkoper = minstens 10% boven/onder het gemiddelde van de beoordeelde dagen; alleen duidelijke signalen tellen mee.
function ehWxBacktest(days, monthOf) {
  const priced = (Array.isArray(days) ? days : []).filter(d => d && Number.isFinite(d.avg) && d.avg > 0);
  if (!priced.length) return { rows: [], priced: 0, signals: 0, hits: 0, ref: null };
  const ref = priced.reduce((a, d) => a + d.avg, 0) / priced.length;
  const rows = priced.map(d => {
    const ind = ehWxIndication(d, monthOf(d.t));
    const rel = d.avg / ref - 1;
    const actual = rel >= 0.1 ? 'pricier' : rel <= -0.1 ? 'cheaper' : 'average';
    const signal = ind.level !== 'average';
    return { dayKey: d.dayKey, t: d.t, wind: d.wind, cloud: d.cloud, temp: d.temp, avg: d.avg, rel, indication: ind.level, reasons: ind.reasons, actual, signal, hit: signal ? ind.level === actual : null };
  });
  const sig = rows.filter(r => r.signal);
  return { rows, priced: priced.length, signals: sig.length, hits: sig.filter(r => r.hit).length, ref };
}

if (typeof module !== 'undefined' && module) {
  try {
    if (module.exports) Object.assign(module.exports, { EH_QT_STEP_MS, ehQtNum, ehQtDay, ehQtStats, ehQtWindow, ehQtTier, ehQtPricesFromHistory, ehQtSumQuarters, ehQtCostDay, ehWxMs, ehWxCloud, ehWxDays, ehWxIndication, ehWxHistoryDays, ehWxBacktest });
  } catch (_) {}
}
