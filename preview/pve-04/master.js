/* Energiehuis PVE-04 · master.js — interactieve cockpit op de goedgekeurde master (DEMO, RC2).
 *
 * DEMO ONLY: geen Home Assistant, geen netwerk (behalve de master uit dezelfde map), geen opslag.
 * De goedgekeurde afbeelding blijft EXACT en ongewijzigd de achtergrond (geen rustlagen, geen retouche: RC2-besluit).
 *   - De ingebakken lichtlijnen in het beeld zijn DECORATIEF en geen actuele stroomindicator. De actuele stroom wordt
 *     getoond met bewegende lichtpunten (alleen bij een geldige, actuele, actieve route volgens model.js), met
 *     routekleur en stroomrichting, en met de kaarten (waarde, kleur, pijl, tekst).
 *   - Glaskaarten liggen exact over de ingebakken kaarten. Hun basisvlak is ondoorzichtig (getint met de kleuren rond
 *     de kaart), zodat oude waarden nooit doorschijnen; daarboven een halfdoorzichtige glaslaag, gekleurde rand en gloed.
 *   - Weergaven: 'overlay' (≥ 900 px), 'compact' (mobiel/tablet: alleen kaarten op het beeld, geen dubbele set) en
 *     'list' (zeer smal of vergrote tekst: leesbare lijst onder het beeld, lege glasvlakken op het beeld).
 */
(function (root) {
  'use strict';
  const M = root.EhPve04Model;
  const OVERLAY_MIN = 900;      // containerbreedte (px) vanaf waar de volledige kaarten op de master staan
  const LIST_MAX_EM = 21;       // smaller dan 21 × de tekstgrootte ⇒ lijstweergave
  const TEXT_SCALE_MAX = 1.25;  // tekst groter dan 125 % ⇒ lijstweergave (kaarttekst op het beeld schaalt niet mee)
  const KEYS = ['pv', 'battery', 'house', 'practice', 'net', 'cupra'];
  const ICON = {
    pv: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    battery: '<rect x="6" y="4" width="12" height="18" rx="2.2"/><path d="M10 2h4"/><path d="M9 15h6M9 18h6M9 12h6"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    net: '<path d="M12 2l-4 20M12 2l4 20M7 8h10M6 13h12M9 3h6"/>',
    practice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    cupra: '<path d="M4 6l8 13 8-13-4 0-4 6.5L8 6z"/>'
  };
  // Modelroute → ingebakken lijn (alleen als pad voor de lichtpunten), richting en kleur van de lichtpunten.
  const ROUTE = {
    'sun-home': { flow: 'flow-pv', dir: 1, color: '#FFC83D', label: 'Zon → huis' },
    'home-practice': { flow: 'flow-practice', dir: -1, color: '#F4F1EA', label: 'Huis → praktijk (SIMULATIE)' },
    'home-grid': { flow: 'flow-net', dir: 1, color: '#3FE6F2', label: 'Huis → net (teruglevering)' },
    'grid-home': { flow: 'flow-net', dir: -1, color: '#FF8A3D', label: 'Net → huis (afname)' },
    'home-ev': { flow: 'flow-car', dir: 1, color: '#7CFF4A', label: 'Huis → Cupra' }
  };
  const NET_DIR = { import: { arrow: '↑', text: 'van net', name: 'afname' }, export: { arrow: '↓', text: 'naar net', name: 'teruglevering' } };
  const DECOR_NOTE = 'De lichtlijnen in de afbeelding zijn decoratief en tonen geen actuele stroom. Actuele stroom: bewegende lichtpunten en de kaarten.';
  let seq = 0;

  function el(doc, tag, cls, attrs) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function setText(node, text) {
    const t = node.firstChild;
    if (t && t.nodeType === 3 && !t.nextSibling) { if (t.data !== text) t.data = text; }
    else if (node.textContent !== text) node.textContent = text;
  }
  const setData = (node, key, v) => { if (node.dataset[key] !== v) node.dataset[key] = v; };
  /** "1,46 kW" → ["1,46", " kW"]; "—" → ["—", ""]. */
  function splitValue(v) { const m = /^(.*\S)(\s\S+)$/.exec(v); return m ? [m[1], m[2]] : [v, '']; }

  /** Gemiddelde kleuren net buiten een kaartvlak (boven/onder), voor het ondoorzichtige glasbasisvlak. Gooit nooit. */
  function sampleTints(img, S, doc) {
    try {
      const W = S.image.natural.w, H = S.image.natural.h;
      const c = doc.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
      const out = {};
      for (const [key, r] of Object.entries(S.covers)) {
        const x0 = Math.max(0, Math.round(r.x * W)), x1 = Math.min(W, Math.round((r.x + r.w) * W));
        const band = (ya, yb) => {
          ya = Math.max(0, Math.min(H - 1, ya)); yb = Math.max(ya + 1, Math.min(H, yb));
          const d = g.getImageData(x0, ya, Math.max(1, x1 - x0), yb - ya).data; let R = 0, G = 0, B = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
          return [R / n, G / n, B / n].map(v => Math.round(v));
        };
        const top = band(Math.round(r.y * H) - 14, Math.round(r.y * H) - 4), bot = band(Math.round((r.y + r.h) * H) + 4, Math.round((r.y + r.h) * H) + 14);
        out[key] = { top, bot };
      }
      return out;
    } catch (e) { return null; }
  }

  function createMasterCockpit(host, options = {}) {
    const doc = host.ownerDocument, win = doc.defaultView;
    const S = options.scene !== undefined ? options.scene : root.EhPve04MasterScene;
    const id = 'ehm' + (++seq);
    let scenario = M.SCENARIO_IDS.includes(options.scenario) ? options.scenario : 'zon-export';
    let tick = 0, model = null, ticker = 0, destroyed = false, openKey = null, opener = null, geoRaf = 0, layout = null, suspended = false, liveInput = null, imgRetry = 0, imgJob = 0;
    // DEMO (standaard): fictieve scenario's. LIVE: invoer uitsluitend via setInput() (HA-adapter); geen DEMO-labels,
    // geen scenario's, geen schommeling, geen fictieve waarden.
    const LIVE = options.mode === 'live';
    const listeners = [];
    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); listeners.push(() => t.removeEventListener(type, fn, o)); };
    const sceneOk = !!(S && S.image && S.image.natural && Array.isArray(S.flows) && S.covers && KEYS.every(k => S.covers[k]));
    const base = options.base || '';

    // ---------------- bouw (één keer)
    const rootEl = el(doc, 'section', 'ehc ehc--master', { 'aria-labelledby': id + '-title', 'data-layout': 'overlay', 'data-scene': sceneOk ? 'loading' : 'missing', 'data-tint': 'none' });
    const head = el(doc, 'header', 'ehc-head');
    head.innerHTML = `<div class="ehc-brand"><h1 class="ehc-title" id="${id}-title">Energiehuis <span>Live Cockpit</span></h1></div>`;
    const badge = el(doc, 'p', LIVE ? 'ehc-demo ehc-live' : 'ehc-demo'); badge.textContent = LIVE ? 'LIVE · alleen-lezen' : 'DEMO — fictieve meetwaarden';
    const sceneNote = el(doc, 'p', 'ehc-scene-note', { role: 'note' }); sceneNote.hidden = true;
    const status = el(doc, 'p', 'ehc-status', { role: 'status' });
    head.append(badge, sceneNote, status);

    const frame = el(doc, 'div', 'ehm-frame');
    const stage = el(doc, 'div', 'ehm-stage');
    const img = el(doc, 'img', 'ehm-scene', { alt: 'Goedgekeurde avondscène: woning met zonnepanelen, houten praktijkruimte links en een groene Cupra bij de laadpaal rechts. De lichtlijnen in het beeld zijn decoratief; de ingebakken voorbeeldkaarten zijn afgedekt door live DEMO-kaarten.', decoding: 'async', fetchpriority: 'high', draggable: 'false' });
    const particles = el(doc, 'canvas', 'ehm-particles', { 'aria-hidden': 'true' });
    const covers = el(doc, 'div', 'ehm-covers', { 'aria-hidden': 'true' });
    const pill = el(doc, 'div', 'ehm-cover ehm-pill', { 'data-key': 'pill' }); pill.innerHTML = LIVE ? '<span class="p-demo p-live">LIVE</span><span class="p-text">alleen-lezen</span><span class="p-time"></span>' : '<span class="p-demo">DEMO</span><span class="p-text">fictieve meetwaarden</span><span class="p-time"></span>';
    const pillTime = pill.querySelector('.p-time'), pillLabel = pill.querySelector('.p-demo');
    covers.appendChild(pill);
    const PL = {};   // lege glasvlakken (alleen in de lijstweergave zichtbaar; de lijst eronder toont de waarden)
    for (const k of KEYS) { const p = el(doc, 'div', 'ehm-cover ehm-plate', { 'data-key': k }); p.innerHTML = `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`; covers.appendChild(p); PL[k] = p; }
    stage.append(img, particles, covers);

    const tiles = el(doc, 'div', 'ehm-tiles');
    const T = {};
    for (const k of KEYS) {
      const b = el(doc, 'button', 'tile', { type: 'button', 'data-key': k, 'aria-haspopup': 'dialog', 'aria-controls': id + '-detail', 'aria-expanded': 'false' });
      b.innerHTML = `<span class="t-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><span class="t-body"><span class="t-title"></span><span class="t-value"><span class="t-num"></span><span class="t-unit"></span></span><span class="t-extra"></span><span class="t-sub"></span></span>`;
      tiles.appendChild(b);
      T[k] = { b, title: b.querySelector('.t-title'), value: b.querySelector('.t-value'), num: b.querySelector('.t-num'), unit: b.querySelector('.t-unit'), extra: b.querySelector('.t-extra'), sub: b.querySelector('.t-sub') };
    }
    frame.append(stage, tiles);

    const legend = el(doc, 'p', 'ehm-legend'); legend.textContent = DECOR_NOTE;
    const summary = el(doc, 'p', 'ehc-summary', { 'aria-live': 'polite' });
    const warn = el(doc, 'p', 'ehc-warn', { role: 'alert' }); warn.hidden = true;
    const controls = el(doc, 'details', 'ehc-controls');
    const cLabel = el(doc, 'summary', 'ehc-controls-title'); cLabel.textContent = 'DEMO-scenario’s';
    const group = el(doc, 'div', 'ehc-scenarios', { role: 'group', 'aria-label': 'DEMO-scenario’s' });
    const SB = {};
    for (const s of M.SCENARIOS) { const b = el(doc, 'button', 'chip', { type: 'button', 'data-scenario': s.id, 'aria-pressed': 'false' }); b.textContent = s.label; group.appendChild(b); SB[s.id] = b; }
    const play = el(doc, 'button', 'chip chip-play', { type: 'button', 'aria-pressed': 'true' }); play.textContent = 'Schommeling aan';
    controls.append(cLabel, group, play);
    const detail = el(doc, 'div', 'ehc-detail', { id: id + '-detail', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': id + '-dt' });
    detail.hidden = true;
    detail.innerHTML = `<div class="d-head"><h2 class="d-title" id="${id}-dt"></h2><button type="button" class="d-close" aria-label="Sluiten">×</button></div><p class="d-value"></p><dl class="d-list"></dl><p class="d-note">${LIVE ? 'Alleen-lezen: geen bediening, geen servicecalls, geen opslag.' : 'DEMO: fictieve meetwaarden. Geen verbinding met Home Assistant, geen bediening.'}</p>`;
    const D = { title: detail.querySelector('.d-title'), value: detail.querySelector('.d-value'), list: detail.querySelector('.d-list'), close: detail.querySelector('.d-close') };
    rootEl.append(head, frame, legend, summary, warn, ...(LIVE ? [] : [controls]), detail);
    if (LIVE) rootEl.dataset.mode = 'live';
    host.appendChild(rootEl);

    // posities (percentages van de master) — één keer zetten
    const setBox = (node, c) => { for (const [k, v] of [['--x', c.x], ['--y', c.y], ['--w', c.w], ['--h', c.h]]) node.style.setProperty(k, String(v)); };
    if (sceneOk) {
      for (const k of KEYS) { setBox(T[k].b, S.covers[k]); setBox(PL[k], S.covers[k]); }
      if (S.covers.pill) setBox(pill, S.covers.pill); else pill.hidden = true;
      img.setAttribute('width', S.image.natural.w); img.setAttribute('height', S.image.natural.h);
    }
    function sceneState(state, text) { rootEl.dataset.scene = state; sceneNote.hidden = !text; setText(sceneNote, text || ''); }
    function onImageLoad() {
      if (destroyed || !sceneOk) return;
      sceneState('ok', '');
      const t0 = win.performance.now();
      const tints = sampleTints(img, S, doc);
      rootEl.dataset.tintMs = String(Math.round(win.performance.now() - t0));
      if (tints) {
        const css = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        for (const [k, t] of Object.entries(tints)) {
          const node = k === 'pill' ? pill : T[k] && T[k].b; if (!node) continue;
          for (const n of k === 'pill' ? [pill] : [node, PL[k]]) { n.style.setProperty('--tint-top', css(t.top)); n.style.setProperty('--tint-bot', css(t.bot)); }
        }
        rootEl.dataset.tint = 'ok';
      } else rootEl.dataset.tint = 'fallback';
      scheduleGeo();
    }

    // ---------------- lichtpunten (alleen actieve routes, in stroomrichting en routekleur)
    const pctx = particles.getContext('2d');
    const reduced = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {}, removeEventListener() {} };
    const FLOWS = sceneOk ? Object.fromEntries(S.flows.map(f => [f.id, f])) : {};
    const PF = Object.values(ROUTE).map(r => r.flow).filter((f, i, a) => a.indexOf(f) === i && FLOWS[f])
      .map(fid => ({ id: fid, points: FLOWS[fid].points, poly: null, route: null, active: false, dir: 1, color: '#ffffff', intensity: 0, alpha: 0, phase: Array.from({ length: 7 }, (_, i) => i / 7) }));
    let sw = 0, sh = 0, dpr = 1, raf = 0, last = 0, paused = false;
    const sprites = {};
    function sprite(color) {
      if (sprites[color]) return sprites[color];
      const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, color); gr.addColorStop(0.5, color + '66'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[color] = c);
    }
    function poly(points) {
      const pts = points.map(p => ({ x: p[0] * sw, y: p[1] * sh })), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      return { pts, cum, length: cum[cum.length - 1] };
    }
    function at(pl, f) {
      const d = f * pl.length; let lo = 0, hi = pl.cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pl.cum[m] < d) lo = m; else hi = m; }
      const span = pl.cum[hi] - pl.cum[lo] || 1, t = (d - pl.cum[lo]) / span, a = pl.pts[lo], b = pl.pts[hi];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    const animating = () => !paused && !suspended && !reduced.matches && !doc.hidden && !destroyed;
    function kick() { if (!raf && animating() && PF.some(p => p.active || p.alpha > 0.01)) { last = 0; raf = win.requestAnimationFrame(frameFn); } else if (!animating()) draw(0); }
    function frameFn(ts) {
      raf = 0;
      if (!animating()) return;
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      draw(dt);
      if (PF.some(p => p.active || p.alpha > 0.01)) raf = win.requestAnimationFrame(frameFn);
    }
    function draw(dt) {
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, sw, sh);
      const still = !animating();
      const u = Math.max(0.35, Math.min(1.4, sw / (sceneOk ? S.image.natural.w : 1330)));
      for (const p of PF) {
        p.alpha += ((p.active ? 1 : 0) - p.alpha) * Math.min(1, dt * (p.active ? 4 : 6));   // passieve fade, geen claim
        if (still) p.alpha = p.active ? 1 : 0;
        if (!p.poly || p.alpha < 0.01) continue;
        if (still) {                                       // reduced motion / verborgen: richting via drie pijlen
          pctx.strokeStyle = p.color; pctx.lineWidth = 2.6 * u + 0.8; pctx.globalAlpha = 0.95;
          for (let i = 1; i <= 3; i++) {
            const q = at(p.poly, p.dir > 0 ? i / 4 : 1 - i / 4), a = q.angle + (p.dir > 0 ? 0 : Math.PI), s = 8 * u + 3;
            pctx.beginPath(); pctx.moveTo(q.x - s * Math.cos(a - 0.6), q.y - s * Math.sin(a - 0.6)); pctx.lineTo(q.x, q.y); pctx.lineTo(q.x - s * Math.cos(a + 0.6), q.y - s * Math.sin(a + 0.6)); pctx.stroke();
          }
          pctx.globalAlpha = 1;
          continue;
        }
        const speed = (40 + 140 * p.intensity) * Math.max(0.5, u) / Math.max(120, p.poly.length);
        const spr = sprite(p.color), s = (12 + 12 * p.intensity) * u + 4;
        pctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < p.phase.length; i++) {
          // Alleen een actieve route beweegt; bij inactief staan de lichtpunten onmiddellijk stil en doven ze uit.
          if (p.active) p.phase[i] = (p.phase[i] + dt * speed) % 1;
          const f = p.dir > 0 ? p.phase[i] : 1 - p.phase[i];
          const q = at(p.poly, f), fade = Math.min(1, p.phase[i] * 6, (1 - p.phase[i]) * 6);
          pctx.globalAlpha = p.alpha * fade * (p.id === 'flow-practice' ? 0.6 : 0.95);
          pctx.drawImage(spr, q.x - s / 2, q.y - s / 2, s, s);
        }
        pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1;
      }
    }
    function applyRoutes() {
      const R = model.routes;
      for (const p of PF) {
        const rid = Object.keys(ROUTE).find(r => ROUTE[r].flow === p.id && R[r] && R[r].active) || null;
        p.active = !!rid; p.route = rid;
        if (rid) { p.dir = ROUTE[rid].dir; p.color = ROUTE[rid].color; p.intensity = R[rid].intensity; }
        const key = 'route' + p.id.replace('flow-', '').replace(/^./, c => c.toUpperCase());
        if (rootEl.dataset[key] !== (rid || 'off')) rootEl.dataset[key] = rid || 'off';
      }
      kick();
    }

    // ---------------- layout en geometrie
    function geometry() {
      geoRaf = 0;
      if (destroyed) return;
      const rw = rootEl.getBoundingClientRect().width;
      const fs = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
      const sceneShown = sceneOk && rootEl.dataset.scene !== 'error';
      const next = !sceneShown || fs / 16 > TEXT_SCALE_MAX || rw / fs < LIST_MAX_EM ? 'list' : rw >= OVERLAY_MIN ? 'overlay' : 'compact';
      if (next !== layout) {
        layout = next; rootEl.dataset.layout = next;
        if (!controls.dataset.touched) controls.open = next === 'overlay';   // mobiel: scenario's standaard ingeklapt
      }
      const r = stage.getBoundingClientRect();
      sw = r.width; sh = r.height;
      rootEl.dataset.density = sw >= 560 ? 'mid' : 'small';
      rootEl.style.setProperty('--u', (sw / (sceneOk ? S.image.natural.w : 1330)).toFixed(4));
      dpr = Math.min(2, win.devicePixelRatio || 1);
      particles.width = Math.max(1, Math.round(sw * dpr)); particles.height = Math.max(1, Math.round(sh * dpr));
      particles.style.width = sw + 'px'; particles.style.height = sh + 'px';
      for (const p of PF) p.poly = sw > 0 ? poly(p.points) : null;
      draw(0); kick();
    }
    const scheduleGeo = () => { if (!geoRaf && !destroyed && !suspended) geoRaf = win.requestAnimationFrame(geometry); };
    const ro = new win.ResizeObserver(scheduleGeo); ro.observe(rootEl); ro.observe(stage);
    on(cLabel, 'click', () => { controls.dataset.touched = '1'; });   // alleen een gebruikerskeuze telt

    // ---------------- render (alleen patchen)
    function render() {
      const m = model;
      setText(status, m.status.text); setData(status, "tone", m.status.tone);
      setText(summary, (LIVE ? '' : 'DEMO · ') + m.summary);
      const w = m.warnings.map(x => x.text).join(' ');
      warn.hidden = !w; setText(warn, w);
      // Netrichting (pijl, kaartkleur, lichtpunten) alleen tonen bij een ACTIEVE netroute: zo kloppen tekst, kleur en
      // richting altijd. Bij een tegenstrijdige meetketen staat de route stil en is de richting niet bevestigd.
      const netActive = !!(m.routes['grid-home'].active || m.routes['home-grid'].active);
      for (const k of KEYS) {
        const d = m.tiles[k], N = T[k];
        setText(N.title, d.title);
        const [num, unit] = splitValue(d.value); setText(N.num, num); setText(N.unit, unit);
        let sub = d.sub, dir = d.direction || 'none';
        if (k === 'net' && !netActive && NET_DIR[d.direction]) { dir = 'none'; sub = 'Richting niet bevestigd' + (m.critical ? ' (meetketen tegenstrijdig)' : ''); }
        setText(N.sub, sub);
        let extra = k === 'cupra' ? 'Accu ' + d.soc : k === 'battery' ? 'Simulatie' : (d.tone === 'sim' ? 'Simulatie' : '');
        if (k === 'net') { const nd = netActive ? NET_DIR[d.direction] : null; extra = nd ? nd.arrow + ' ' + nd.text : ''; }
        setText(N.extra, extra); N.extra.hidden = !extra;
        setData(N.b, 'tone', d.tone); setData(PL[k], 'tone', d.tone);
        if (k === 'net') { setData(N.b, 'direction', dir); setData(PL[k], 'direction', dir); }
        const nd = k === 'net' && netActive && NET_DIR[d.direction] ? ', ' + NET_DIR[d.direction].name + ' (' + NET_DIR[d.direction].text + ')' : '';
        const al = `${d.title}: ${d.value}${nd}${k === 'cupra' ? ', accu ' + d.soc : ''}${k === 'battery' ? ', simulatie' : ''}. ${sub}. Details openen.`;
        if (N.b.getAttribute('aria-label') !== al) N.b.setAttribute('aria-label', al);
      }
      const now = new Date(m.now);
      setText(pillTime, String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
      if (LIVE) { setText(pillLabel, m.connected ? 'LIVE' : 'OFFLINE'); setData(pill, 'state', m.connected ? 'live' : 'offline'); }
      for (const [sid, b] of Object.entries(SB)) if (b.getAttribute('aria-pressed') !== String(sid === scenario)) b.setAttribute('aria-pressed', String(sid === scenario));
      setData(rootEl, 'activeScenario', scenario);
      applyRoutes();
      if (openKey) fillDetail(openKey);
    }
    function compute() {
      const input = LIVE ? (liveInput || { now: Date.now(), live: true, connected: true, states: {}, specs: options.specs }) : M.scenarioInput(scenario, Date.now(), tick);
      model = M.computeModel(input, model); render();
    }

    // ---------------- detailpaneel
    const ROUTES_FOR = { pv: ['sun-home'], battery: [], house: ['sun-home', 'grid-home', 'home-grid', 'home-ev'], practice: ['home-practice'], net: ['grid-home', 'home-grid'], cupra: ['home-ev'] };
    function fillDetail(key) {
      const d = model.tiles[key];
      setText(D.title, d.title);
      setText(D.value, d.value + (key === 'cupra' ? ' · accu ' + d.soc : ''));
      const rows = [['Status', d.sub], [LIVE ? 'Entiteit' : 'Bron (DEMO-label)', d.entity || '—']];
      if (key === 'cupra' && LIVE) rows.push(['Accuniveau', d.soc + (d.socReason && d.socReason !== 'Actueel' ? ' · ' + d.socReason : '') + (d.socEntity ? ' (' + d.socEntity + ')' : '')]);
      if (LIVE && model.readings) { const rk = { pv: 'pv', house: 'house', net: 'net', cupra: 'ev', battery: 'battery' }[key]; const rd = rk && model.readings[rk]; if (rd && rd.stampSource) rows.push(['Tijdstempel', rd.stampSource + (Number.isFinite(rd.ageMs) ? ' · ' + M.ageLabel(rd.ageMs) : '')]); }
      if (key === 'net') {
        const na = model.routes['grid-home'].active || model.routes['home-grid'].active;
        rows.push(['Richting', !na && (d.direction === 'import' || d.direction === 'export') ? 'Niet bevestigd: netroute staat stil (' + model.routes['home-grid'].reason + ')' : d.direction === 'import' ? '↑ Afname van het net (oranje lichtpunten, net → huis)' : d.direction === 'export' ? '↓ Teruglevering aan het net (cyaan lichtpunten, huis → net)' : d.direction === 'balance' ? 'In balans: geen stroomrichting' : 'Onbekend: geen stroomrichting']);
        rows.push(['P1-tekenconfiguratie', model.p1Sign === 'export_positive' ? 'Export positief (gecorrigeerd)' : 'Import positief']);
      }
      if (key === 'battery') rows.push(['Let op', 'Virtuele batterij: rekensimulatie, geen fysieke opslag en geen stroomroute.']);
      if (key === 'practice') rows.push(['Let op', d.tone === 'sim' ? 'Gesimuleerde waarde, niet gemeten en niet opgeteld bij het huis.' : 'Geen submeter gekoppeld: er wordt geen vermogen getoond.']);
      if (key === 'house') rows.push(['Balans (rekenkundig)', model.balance === 'sluit' ? 'Sluit — dit bewijst niet dat de meetketen is geverifieerd' : model.balance]);
      for (const rid of ROUTES_FOR[key]) { const r = model.routes[rid]; rows.push([ROUTE[rid].label, r.active ? 'Actief · ' + M.formatPower(r.watts) : 'Inactief · ' + r.reason]); }
      if (ROUTES_FOR[key].length) rows.push(['Lichtlijn in beeld', 'Decoratief — geen actuele stroomindicator']);
      const frag = doc.createDocumentFragment();
      for (const [k, v] of rows) { const dt = doc.createElement('dt'); dt.textContent = k; const dd = doc.createElement('dd'); dd.textContent = v; frag.append(dt, dd); }
      D.list.replaceChildren(frag);
    }
    function openDetail(key, btn) {
      if (openKey) T[openKey].b.setAttribute('aria-expanded', 'false');
      openKey = key; opener = btn; fillDetail(key);
      detail.hidden = false; detail.dataset.key = key; btn.setAttribute('aria-expanded', 'true'); D.close.focus();
    }
    function closeDetail(restore = true) {
      if (!openKey) return;
      T[openKey].b.setAttribute('aria-expanded', 'false'); detail.hidden = true; openKey = null;
      if (restore && opener && opener.isConnected) opener.focus();
      opener = null;
    }
    on(tiles, 'click', e => { const b = e.target.closest('.tile'); if (!b) return; const k = b.dataset.key; if (openKey === k) closeDetail(); else openDetail(k, b); });
    on(D.close, 'click', () => closeDetail());
    on(rootEl, 'keydown', e => { if (e.key === 'Escape' && openKey) { e.preventDefault(); e.stopPropagation(); closeDetail(); } });
    const docListeners = [['pointerdown', e => { if (openKey && !detail.contains(e.target) && !e.target.closest('.tile')) closeDetail(false); }]];
    on(group, 'click', e => { const b = e.target.closest('[data-scenario]'); if (!b) return; scenario = b.dataset.scenario; tick = 0; model = null; compute(); });
    on(play, 'click', () => { const onNow = play.getAttribute('aria-pressed') !== 'true'; play.setAttribute('aria-pressed', String(onNow)); play.textContent = onNow ? 'Schommeling aan' : 'Schommeling uit'; setTicker(); });
    const onVis = () => { setTicker(); kick(); };
    docListeners.push(['visibilitychange', onVis]);
    const attachDoc = () => docListeners.forEach(([ty, fn]) => doc.addEventListener(ty, fn));
    const detachDoc = () => docListeners.forEach(([ty, fn]) => doc.removeEventListener(ty, fn));
    attachDoc();
    const onReduced = () => kick();
    if (reduced.addEventListener) { reduced.addEventListener('change', onReduced); listeners.push(() => reduced.removeEventListener('change', onReduced)); }
    function setTicker() {
      const want = !LIVE && !destroyed && !suspended && options.ticker !== false && play.getAttribute('aria-pressed') === 'true' && !doc.hidden;
      if (want && !ticker) ticker = win.setInterval(() => { tick++; compute(); }, options.intervalMs || 2500);
      if (!want && ticker) { win.clearInterval(ticker); ticker = 0; }
    }

    // ---------------- start
    // Beeldbron: DEMO = master uit de repository; LIVE = options.resolveImage() (bijv. een geauthenticeerde,
    // tijdelijk getekende Media Source-URL). Bij een laadfout één keer opnieuw oplossen (verlopen handtekening),
    // daarna veilige terugval: alleen interface.
    function loadImage() {
      const job = ++imgJob;
      if (!options.resolveImage) { img.src = base + S.image.file; return; }
      Promise.resolve().then(() => options.resolveImage()).then(url => {
        if (destroyed || job !== imgJob) return;
        if (!url) { sceneState('error', options.imageMissingText || 'Geen beeld beschikbaar — alleen interface'); scheduleGeo(); return; }
        img.src = url;
      }, () => { if (!destroyed && job === imgJob) { sceneState('error', 'Beeld kon niet worden opgehaald — alleen interface'); scheduleGeo(); } });
    }
    if (sceneOk) {
      on(img, 'load', () => { imgRetry = 0; onImageLoad(); });
      on(img, 'error', () => {
        if (destroyed) return;
        if (options.resolveImage && imgRetry < 1) { imgRetry++; loadImage(); return; }
        sceneState('error', 'Beeldlaag kon niet laden — alleen interface'); scheduleGeo();
      });
      loadImage();
    } else sceneState('missing', 'Scènelaag ontbreekt — alleen interface');
    compute();
    scheduleGeo();
    setTicker();

    return {
      el: rootEl,
      get model() { return model; },
      get scenario() { return scenario; },
      get layout() { return layout; },
      get live() { return LIVE; },
      setScenario(s) { if (!LIVE && M.SCENARIO_IDS.includes(s)) { scenario = s; tick = 0; model = null; compute(); } },
      /** LIVE: nieuwe model-invoer van de HA-adapter (alleen bij gewijzigde data aanroepen). */
      setInput(input) { if (!LIVE || destroyed) return; liveInput = input; compute(); },
      /** Ontkoppeld (bijv. kaart uit de DOM): alle timers, rAF, observers en documentlisteners stoppen; DOM blijft. */
      suspend() {
        if (suspended || destroyed) return; suspended = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect(); detachDoc();
      },
      resume() {
        if (!suspended || destroyed) return; suspended = false;
        attachDoc(); ro.observe(rootEl); ro.observe(stage);
        scheduleGeo(); setTicker(); kick();
      },
      get suspended() { return suspended; },
      step() { tick++; compute(); },
      setPaused(v) { paused = !!v; if (paused && raf) { win.cancelAnimationFrame(raf); raf = 0; } kick(); },
      isAnimating: () => !!raf,
      phases: fid => { const p = PF.find(x => x.id === fid); return p ? p.phase.slice() : null; },
      particleInfo: () => PF.map(p => ({ id: p.id, active: p.active, route: p.route, dir: p.dir, color: p.active ? p.color : null })),
      destroy() {
        destroyed = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect(); detachDoc(); imgJob++;
        listeners.splice(0).forEach(off => off());
        rootEl.remove();
      }
    };
  }

  root.EhPve04Master = Object.freeze({ createMasterCockpit, splitValue, ROUTE, OVERLAY_MIN });
})(typeof globalThis !== 'undefined' ? globalThis : this);
