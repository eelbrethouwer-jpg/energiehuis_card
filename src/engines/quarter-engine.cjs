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
    for (const x of list) { if (x.t <= t) cur = x; else break; }
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

if (typeof module !== 'undefined' && module) {
  try {
    if (module.exports) Object.assign(module.exports, { EH_QT_STEP_MS, ehQtNum, ehQtDay, ehQtStats, ehQtWindow, ehQtTier, ehQtPricesFromHistory, ehQtSumQuarters, ehQtCostDay });
  } catch (_) {}
}
