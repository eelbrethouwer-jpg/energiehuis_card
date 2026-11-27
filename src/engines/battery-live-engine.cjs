'use strict';
// Live batterijdashboard (virtuele batterij): zuivere rekenfuncties, geen Home Assistant, geen DOM, geen opslag.
// De batterij is een SIMULATIE; er is geen fysieke opslag en er worden geen opdrachten verstuurd.
// Vermogen wordt, als er geen vermogenssensor is, afgeleid uit de verandering van de kWh-stand.

const EH_BL_HOUR_MS = 3600000;

function ehBlNum(v) {
  if (v === null || v === undefined || v === '' || v === 'unknown' || v === 'unavailable') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// points: [{t(ms), v(number)}] → gesorteerd, zonder ongeldige waarden.
function ehBlSeries(points) {
  return (Array.isArray(points) ? points : [])
    .map(p => ({ t: Number(p && p.t), v: ehBlNum(p && p.v) }))
    .filter(p => Number.isFinite(p.t) && p.v !== null)
    .sort((a, b) => a.t - b.t);
}

// Gemiddeld vermogen (W, + = laden, − = ontladen) uit de kWh-stand: eerst de laatste 30 minuten, anders de laatste twee punten
// mits die hoogstens 2 uur uit elkaar liggen. Zonder twee punten: null (nooit een verzonnen 0 W).
function ehBlDerivePower(kwhPoints, nowMs) {
  const s = ehBlSeries(kwhPoints).filter(p => p.t <= nowMs);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const win = s.filter(p => p.t >= last.t - 30 * 60000);
  let a, b = last;
  if (win.length >= 2) a = win[0];
  else { a = s[s.length - 2]; if (last.t - a.t > 2 * EH_BL_HOUR_MS) return null; }
  const dt = (b.t - a.t) / EH_BL_HOUR_MS;
  if (dt <= 0 || b.t - a.t < 60000) return null;
  return { watts: ((b.v - a.v) / dt) * 1000, spanMin: Math.round((b.t - a.t) / 60000), staleMin: Math.max(0, Math.round((nowMs - b.t) / 60000)) };
}

// Geladen en ontladen kWh sinds startMs uit opeenvolgende kWh-standen. Sprongen groter dan maxStepKwh (reset) en gaten groter
// dan maxGapMs tellen niet mee en maken het resultaat onvolledig.
function ehBlDayTotals(kwhPoints, startMs, nowMs, opts) {
  const maxStep = (opts && opts.maxStepKwh) || 6, maxGap = (opts && opts.maxGapMs) || 3 * EH_BL_HOUR_MS;
  const s = ehBlSeries(kwhPoints).filter(p => p.t <= nowMs);
  let charged = 0, discharged = 0, complete = s.length >= 2, steps = 0;
  for (let i = 1; i < s.length; i++) {
    if (s[i].t < startMs) continue;
    const d = s[i].v - s[i - 1].v;
    if (s[i].t - s[i - 1].t > maxGap || Math.abs(d) > maxStep) { complete = false; continue; }
    steps++;
    if (d > 0) charged += d; else discharged += -d;
  }
  return { charged, discharged, complete: complete && steps > 0, steps };
}

// Stapfunctie per uur: de laatste bekende stand op elk uur-einde. Vóór de eerste stand blijft het uur onbekend (null).
function ehBlHourly(points, startMs, endMs) {
  const s = ehBlSeries(points);
  const out = [];
  for (let t = startMs; t < endMs; t += EH_BL_HOUR_MS) {
    let cur = null;
    for (const p of s) { if (p.t <= t + EH_BL_HOUR_MS - 1) cur = p; else break; }
    out.push({ t, v: cur ? cur.v : null });
  }
  return out;
}

// Resterende tijd tot vol (laden) of leeg (ontladen) bij het huidige vermogen; null bij rust of onbekend.
function ehBlTimeTo(kwh, capKwh, watts) {
  if (![kwh, capKwh, watts].every(Number.isFinite) || capKwh <= 0 || Math.abs(watts) < 20) return null;
  const hours = watts > 0 ? (capKwh - kwh) / (watts / 1000) : kwh / (-watts / 1000);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return { to: watts > 0 ? 'full' : 'empty', minutes: Math.round(hours * 60) };
}

function ehBlMode(watts) {
  if (!Number.isFinite(watts)) return 'unknown';
  if (watts > 20) return 'charging';
  if (watts < -20) return 'discharging';
  return 'idle';
}

function ehBlLevel(soc) {
  if (!Number.isFinite(soc)) return 'unknown';
  return soc >= 95 ? 'full' : soc >= 30 ? 'good' : soc >= 10 ? 'low' : 'empty';
}

// Capaciteit uit kWh en SOC wanneer die klopt (SOC ≥ 5 %), anders de vaste modelwaarde.
function ehBlCapacity(kwh, socPct, fallback) {
  if (Number.isFinite(kwh) && Number.isFinite(socPct) && socPct >= 5 && kwh > 0) {
    const c = kwh / (socPct / 100);
    if (c > 0.5 && c < 200) return c;
  }
  return fallback;
}

if (typeof module !== 'undefined' && module) {
  try {
    if (module.exports) Object.assign(module.exports, { EH_BL_HOUR_MS, ehBlNum, ehBlSeries, ehBlDerivePower, ehBlDayTotals, ehBlHourly, ehBlTimeTo, ehBlMode, ehBlLevel, ehBlCapacity });
  } catch (_) {}
}
