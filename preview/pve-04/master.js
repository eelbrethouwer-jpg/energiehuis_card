/* Energiehuis PVE-04 · master.js — interactieve cockpit op de goedgekeurde master (DEMO).
 *
 * DEMO ONLY: geen Home Assistant, geen netwerk (behalve de master uit dezelfde map), geen opslag.
 * De goedgekeurde afbeelding blijft ongewijzigd de achtergrond. Daarboven:
 *   1. "Rustlagen" (canvas, in de browser berekend): onderdrukken per ingebakken stroomlijn de lijn en haar gloed
 *      zolang de bijbehorende route NIET actief is (0 W, offline, verouderd, ongeldig). Er wordt geen afgeleid
 *      beeldbestand opgeslagen of verstuurd; de pixels bestaan alleen in het geheugen van de browser.
 *   2. Lichtdeeltjes langs exact dezelfde lijn, alleen bij een actieve route (model.js), in de stroomrichting.
 *   3. Live kaarten die de ingebakken kaarten volledig en dekkend afdekken (marge uit master-scene.js).
 * Kan de rustlaag niet worden berekend (bijv. file:// of een geblokkeerde canvas), dan valt de cockpit terug op
 * een donkere dimlaag over inactieve lijnen en toont een waarschuwing.
 */
(function (root) {
  'use strict';
  const M = root.EhPve04Model;
  const OVERLAY_MIN = 900;      // containerbreedte (px) vanaf waar de kaarten óp de master staan
  const KEYS = ['pv', 'battery', 'house', 'practice', 'net', 'cupra'];
  const ICON = {
    pv: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    battery: '<rect x="6" y="4" width="12" height="18" rx="2.2"/><path d="M10 2h4"/><path d="M9 15h6M9 18h6M9 12h6"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    net: '<path d="M12 2l-4 20M12 2l4 20M7 8h10M6 13h12M9 3h6"/>',
    practice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    cupra: '<path d="M4 6l8 13 8-13-4 0-4 6.5L8 6z"/>'
  };
  // Welke modelroutes horen bij welke ingebakken lijn, en in welke richting stromen de deeltjes.
  const DIR = { 'sun-home': 1, 'home-practice': -1, 'home-grid': 1, 'grid-home': -1, 'home-ev': 1 };
  const GROUP_ROUTES = { pv: ['sun-home'], practice: ['home-practice'], net: ['home-grid', 'grid-home'], ev: ['home-ev'] };
  const ROUTE_LABEL = { 'sun-home': 'Zon → huis', 'grid-home': 'Net → huis (afname)', 'home-grid': 'Huis → net (teruglevering)', 'home-ev': 'Huis → Cupra', 'home-practice': 'Huis → praktijk (SIMULATIE)' };
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

  // ------------------------------------------------------------------ rustlagen (pure pixelbewerking)
  /** Afstand van punt tot polyline (px). */
  function distTo(px, py, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  /** Eén horizontale + verticale boxblur (randen geklemd). */
  function boxPass(src, w, h, r, tmp, dst) {
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) { dst[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
  }
  function blur3(src, w, h, r) {
    let a = Float32Array.from(src), b = new Float32Array(src.length);
    const t = new Float32Array(src.length);
    for (let i = 0; i < 3; i++) { boxPass(a, w, h, r, t, b); const s = a; a = b; b = s; }
    return a;
  }

  /**
   * Bouwt per lijngroep een canvas dat de ingebakken lijn + gloed vervangt door de omgeving:
   * laagfrequent = genormaliseerde convolutie van de pixels BUITEN alle lijnen en kaarten (meerdere schalen);
   * hoogfrequent (paneelraster, pannen, planken) blijft behouden in de gloedzone, niet in de lijnkern en niet bij
   * felle vonken. Geeft { ok, groups } of { ok:false, reason } terug; gooit nooit.
   */
  function buildQuietLayers(img, S, doc) {
    try {
      const W = S.image.natural.w, H = S.image.natural.h;
      const full = doc.createElement('canvas'); full.width = W; full.height = H;
      const g = full.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const flows = S.flows.map(f => {
        const pts = f.points.map(p => [p[0] * W, p[1] * H]), hw = f.width * W / 2;
        return { id: f.id, group: f.group, pts, rc: Math.max(4, hw * 0.65), rh: hw * f.glow, fe: 6 };
      });
      const pad = 100;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const f of flows) for (const p of f.pts) { x0 = Math.min(x0, p[0] - f.rh - pad); y0 = Math.min(y0, p[1] - f.rh - pad); x1 = Math.max(x1, p[0] + f.rh + pad); y1 = Math.max(y1, p[1] + f.rh + pad); }
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
      const w = x1 - x0, h = y1 - y0, N = w * h;
      let data;
      try { data = g.getImageData(x0, y0, w, h).data; } catch (e) { return { ok: false, reason: 'canvas-geblokkeerd' }; }
      const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
      for (let i = 0; i < N; i++) { R[i] = data[i * 4]; G[i] = data[i * 4 + 1]; B[i] = data[i * 4 + 2]; }
      // afstand tot elke lijn + uitsluiting (alle gloedzones en alle afgedekte kaarten)
      // Afstanden alleen binnen het kader van elke lijn (+ gloed) berekenen; daarbuiten telt de lijn niet mee.
      const D = flows.map(() => new Float32Array(N).fill(1e9));
      const wt = new Float32Array(N).fill(1);
      flows.forEach((f, k) => {
        const lim = f.rh + f.fe + 1;
        let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
        for (const p of f.pts) { fx0 = Math.min(fx0, p[0]); fy0 = Math.min(fy0, p[1]); fx1 = Math.max(fx1, p[0]); fy1 = Math.max(fy1, p[1]); }
        const ax = Math.max(0, Math.floor(fx0 - lim - x0)), ay = Math.max(0, Math.floor(fy0 - lim - y0));
        const bx = Math.min(w, Math.ceil(fx1 + lim - x0)), by = Math.min(h, Math.ceil(fy1 + lim - y0));
        for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
          const i = y * w + x, d = distTo(x + x0 + 0.5, y + y0 + 0.5, f.pts);
          D[k][i] = d; if (d <= f.rh + f.fe) wt[i] = 0;
        }
      });
      for (const c of Object.values(S.covers)) {
        const ax = Math.max(0, Math.floor(c.x * W - x0)), ay = Math.max(0, Math.floor(c.y * H - y0));
        const bx = Math.min(w, Math.ceil((c.x + c.w) * W - x0)), by = Math.min(h, Math.ceil((c.y + c.h) * H - y0));
        for (let y = ay; y < by; y++) wt.fill(0, y * w + ax, y * w + Math.max(ax, bx));
      }
      // laagfrequente achtergrond: van grof naar fijn mengen op basis van de dekking (geen naden tussen schalen)
      const BR = new Float32Array(N), BG = new Float32Array(N), BB = new Float32Array(N);
      const RW = R.map((v, i) => v * wt[i]), GW = G.map((v, i) => v * wt[i]), BW = B.map((v, i) => v * wt[i]);
      [40, 18, 8].forEach((r, si) => {
        const bw = blur3(wt, w, h, r), br = blur3(RW, w, h, r), bg = blur3(GW, w, h, r), bb = blur3(BW, w, h, r);
        for (let i = 0; i < N; i++) {
          const c = bw[i];
          const t = si === 0 ? (c > 1e-4 ? 1 : 0) : Math.max(0, Math.min(1, (c - 0.2) / 0.3));
          if (t > 0) {
            BR[i] += (br[i] / c - BR[i]) * t; BG[i] += (bg[i] / c - BG[i]) * t; BB[i] += (bb[i] / c - BB[i]) * t;
          } else if (si === 0) { BR[i] = R[i]; BG[i] = G[i]; BB[i] = B[i]; }
        }
      });
      const lR = blur3(R, w, h, 3), lG = blur3(G, w, h, 3), lB = blur3(B, w, h, 3);
      // per groep een eigen canvas (zo kan elke route afzonderlijk in- en uitfaden)
      const groups = {};
      for (const gid of [...new Set(flows.map(f => f.group))]) {
        const fl = flows.map((f, k) => [f, k]).filter(([f]) => f.group === gid);
        let gx0 = W, gy0 = H, gx1 = 0, gy1 = 0;
        for (const [f] of fl) for (const p of f.pts) { gx0 = Math.min(gx0, p[0] - f.rh - f.fe); gy0 = Math.min(gy0, p[1] - f.rh - f.fe); gx1 = Math.max(gx1, p[0] + f.rh + f.fe); gy1 = Math.max(gy1, p[1] + f.rh + f.fe); }
        gx0 = Math.max(x0, Math.floor(gx0)); gy0 = Math.max(y0, Math.floor(gy0)); gx1 = Math.min(x1, Math.ceil(gx1)); gy1 = Math.min(y1, Math.ceil(gy1));
        const cw = gx1 - gx0, ch = gy1 - gy0;
        const cv = doc.createElement('canvas'); cv.width = cw; cv.height = ch;
        const cg = cv.getContext('2d'), out = cg.createImageData(cw, ch), od = out.data;
        let covered = 0;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const i = (y + gy0 - y0) * w + (x + gx0 - x0), o = (y * cw + x) * 4;
          let a = 0, kt = 1;
          for (const [f, k] of fl) {
            const d = D[k][i];
            const al = d <= f.rh ? 1 : d <= f.rh + f.fe ? 1 - (d - f.rh) / f.fe : 0;
            if (al > a) a = al;
            const core = d <= f.rc ? 1 : d <= f.rc + 3 ? 1 - (d - f.rc) / 3 : 0;
            kt = Math.min(kt, 1 - core);
          }
          if (a <= 0) continue;
          const lum = (R[i] + G[i] + B[i]) / 3, blum = (BR[i] + BG[i] + BB[i]) / 3;
          if (lum - blum > 30) kt = 0;                                  // felle vonk of lijnrest: geen textuur
          od[o] = BR[i] + (R[i] - lR[i]) * kt; od[o + 1] = BG[i] + (G[i] - lG[i]) * kt; od[o + 2] = BB[i] + (B[i] - lB[i]) * kt;
          od[o + 3] = Math.round(a * 255); covered++;
        }
        cg.putImageData(out, 0, 0);
        groups[gid] = { canvas: cv, rect: { x: gx0 / W, y: gy0 / H, w: cw / W, h: ch / H }, pixels: covered };
      }
      return { ok: true, groups };
    } catch (e) {
      return { ok: false, reason: 'berekening mislukt' };
    }
  }

  // ------------------------------------------------------------------ cockpit
  function createMasterCockpit(host, options = {}) {
    const doc = host.ownerDocument, win = doc.defaultView;
    const S = options.scene !== undefined ? options.scene : root.EhPve04MasterScene;
    const id = 'ehm' + (++seq);
    let scenario = M.SCENARIO_IDS.includes(options.scenario) ? options.scenario : 'zon-export';
    let tick = 0, model = null, ticker = 0, destroyed = false, openKey = null, opener = null, geoRaf = 0, layout = null;
    const listeners = [];
    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); listeners.push(() => t.removeEventListener(type, fn, o)); };
    const sceneOk = !!(S && S.image && S.image.natural && Array.isArray(S.flows) && S.covers && KEYS.every(k => S.covers[k]));
    const base = options.base || '';

    // ---------------- bouw (één keer)
    const rootEl = el(doc, 'section', 'ehc ehc--master', { 'aria-labelledby': id + '-title', 'data-layout': 'overlay', 'data-scene': sceneOk ? 'loading' : 'missing', 'data-quiet': 'pending' });
    const head = el(doc, 'header', 'ehc-head');
    head.innerHTML = `<div class="ehc-brand"><h1 class="ehc-title" id="${id}-title">Energiehuis <span>Live Cockpit</span></h1></div>`;
    const badge = el(doc, 'p', 'ehc-demo'); badge.textContent = 'DEMO — fictieve meetwaarden';
    const sceneNote = el(doc, 'p', 'ehc-scene-note', { role: 'note' }); sceneNote.hidden = true;
    const status = el(doc, 'p', 'ehc-status', { role: 'status' });
    head.append(badge, sceneNote, status);

    const frame = el(doc, 'div', 'ehm-frame');
    const stage = el(doc, 'div', 'ehm-stage');
    const img = el(doc, 'img', 'ehm-scene', { alt: 'Goedgekeurde avondscène: woning met zonnepanelen, houten praktijkruimte links en een groene Cupra bij de laadpaal rechts. De ingebakken voorbeeldkaarten zijn afgedekt door live DEMO-kaarten.', decoding: 'async', fetchpriority: 'high', draggable: 'false' });
    const quietHost = el(doc, 'div', 'ehm-quiet-host', { 'aria-hidden': 'true' });
    const SVGNS = 'http://www.w3.org/2000/svg';
    const dim = doc.createElementNS(SVGNS, 'svg'); dim.setAttribute('class', 'ehm-dim'); dim.setAttribute('aria-hidden', 'true'); dim.setAttribute('preserveAspectRatio', 'none');
    const particles = el(doc, 'canvas', 'ehm-particles', { 'aria-hidden': 'true' });
    const covers = el(doc, 'div', 'ehm-covers', { 'aria-hidden': 'true' });
    const pill = el(doc, 'div', 'ehm-cover ehm-pill'); pill.innerHTML = '<span class="p-demo">DEMO</span><span class="p-text">fictieve meetwaarden</span><span class="p-time"></span>';
    const pillTime = pill.querySelector('.p-time');
    covers.appendChild(pill);
    const PL = {};
    for (const k of KEYS) { const p = el(doc, 'div', 'ehm-cover ehm-plate', { 'data-key': k }); p.innerHTML = '<span class="pl-value"></span>'; covers.appendChild(p); PL[k] = p; }
    stage.append(img, quietHost, dim, particles, covers);

    const tiles = el(doc, 'div', 'ehm-tiles');
    const T = {};
    for (const k of KEYS) {
      const b = el(doc, 'button', 'tile', { type: 'button', 'data-key': k, 'aria-haspopup': 'dialog', 'aria-controls': id + '-detail', 'aria-expanded': 'false' });
      b.innerHTML = `<span class="t-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><span class="t-body"><span class="t-title"></span><span class="t-value"></span><span class="t-extra"></span><span class="t-sub"></span></span>`;
      tiles.appendChild(b);
      T[k] = { b, title: b.querySelector('.t-title'), value: b.querySelector('.t-value'), extra: b.querySelector('.t-extra'), sub: b.querySelector('.t-sub') };
    }
    frame.append(stage, tiles);

    const summary = el(doc, 'p', 'ehc-summary', { 'aria-live': 'polite' });
    const warn = el(doc, 'p', 'ehc-warn', { role: 'alert' }); warn.hidden = true;
    const controls = el(doc, 'div', 'ehc-controls');
    const cLabel = el(doc, 'h2', 'ehc-controls-title', { id: id + '-sc' }); cLabel.textContent = 'DEMO-scenario';
    const group = el(doc, 'div', 'ehc-scenarios', { role: 'group', 'aria-labelledby': id + '-sc' });
    const SB = {};
    for (const s of M.SCENARIOS) { const b = el(doc, 'button', 'chip', { type: 'button', 'data-scenario': s.id, 'aria-pressed': 'false' }); b.textContent = s.label; group.appendChild(b); SB[s.id] = b; }
    const play = el(doc, 'button', 'chip chip-play', { type: 'button', 'aria-pressed': 'true' }); play.textContent = 'Schommeling aan';
    controls.append(cLabel, group, play);
    const detail = el(doc, 'div', 'ehc-detail', { id: id + '-detail', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': id + '-dt' });
    detail.hidden = true;
    detail.innerHTML = `<div class="d-head"><h2 class="d-title" id="${id}-dt"></h2><button type="button" class="d-close" aria-label="Sluiten">×</button></div><p class="d-value"></p><dl class="d-list"></dl><p class="d-note">DEMO: fictieve meetwaarden. Geen verbinding met Home Assistant, geen bediening.</p>`;
    const D = { title: detail.querySelector('.d-title'), value: detail.querySelector('.d-value'), list: detail.querySelector('.d-list'), close: detail.querySelector('.d-close') };
    rootEl.append(head, frame, summary, warn, controls, detail);
    host.appendChild(rootEl);

    // posities (percentages van de master) — één keer zetten
    const setBox = (node, c) => { for (const [k, v] of [['--x', c.x], ['--y', c.y], ['--w', c.w], ['--h', c.h]]) node.style.setProperty(k, String(v)); };
    if (sceneOk) {
      for (const k of KEYS) { setBox(T[k].b, S.covers[k]); setBox(PL[k], S.covers[k]); }
      if (S.covers.pill) setBox(pill, S.covers.pill); else pill.hidden = true;
      dim.setAttribute('viewBox', `0 0 ${S.image.natural.w} ${S.image.natural.h}`);
      img.setAttribute('width', S.image.natural.w); img.setAttribute('height', S.image.natural.h);
    }

    // ---------------- rustlagen en dimterugval
    const quiet = {};          // groep → canvas
    const dimPaths = {};       // groep → svg-groep (alleen terugval)
    if (sceneOk) {
      const NW = S.image.natural.w, NH = S.image.natural.h;
      for (const f of S.flows) {
        if (!dimPaths[f.group]) { const gg = doc.createElementNS(SVGNS, 'g'); gg.dataset.group = f.group; dim.appendChild(gg); dimPaths[f.group] = gg; }
        const p = doc.createElementNS(SVGNS, 'polyline');
        p.setAttribute('points', f.points.map(q => (q[0] * NW).toFixed(1) + ',' + (q[1] * NH).toFixed(1)).join(' '));
        p.setAttribute('stroke-width', (f.width * NW * f.glow * 1.6).toFixed(1));
        dimPaths[f.group].appendChild(p);
      }
    }
    function sceneState(state, text) {
      rootEl.dataset.scene = state;
      sceneNote.hidden = !text; setText(sceneNote, text || '');
    }
    function quietState(state) {
      rootEl.dataset.quiet = state;
      if (state === 'unavailable') { sceneNote.hidden = false; setText(sceneNote, 'Ingebakken stroomlijnen niet onderdrukbaar — donkere dimlaag actief'); }
    }
    function onImageLoad() {
      if (destroyed || !sceneOk) return;
      sceneState('ok', '');
      const t0 = win.performance.now();
      const res = buildQuietLayers(img, S, doc);
      rootEl.dataset.quietMs = String(Math.round(win.performance.now() - t0));
      if (!res.ok) { quietState('unavailable'); rootEl.dataset.quietReason = res.reason; if (model) applyRoutes(); return; }
      for (const [gid, q] of Object.entries(res.groups)) {
        const c = q.canvas; c.className = 'ehm-quiet'; c.dataset.group = gid; c.dataset.suppressed = 'true';
        c.style.left = (q.rect.x * 100) + '%'; c.style.top = (q.rect.y * 100) + '%'; c.style.width = (q.rect.w * 100) + '%'; c.style.height = (q.rect.h * 100) + '%';
        quietHost.appendChild(c); quiet[gid] = c;
      }
      quietState('ok');
      if (model) applyRoutes();
    }

    // ---------------- deeltjes (alleen actieve routes, in stroomrichting)
    const pctx = particles.getContext('2d');
    const reduced = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {}, removeEventListener() {} };
    const PF = (sceneOk ? S.flows : []).filter(f => f.particles).map(f => ({ id: f.id, group: f.group, color: f.color, points: f.points, poly: null, active: false, dir: 1, intensity: 0, alpha: 0, phase: Array.from({ length: 7 }, (_, i) => i / 7) }));
    let sw = 0, sh = 0, dpr = 1, raf = 0, last = 0, paused = false;
    const sprites = {};
    function sprite(color) {
      if (sprites[color]) return sprites[color];
      const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, color); gr.addColorStop(0.5, color + '55'); gr.addColorStop(1, color + '00');
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
    const animating = () => !paused && !reduced.matches && !doc.hidden && !destroyed;
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
          pctx.strokeStyle = p.color; pctx.lineWidth = 2.4 * u + 0.6; pctx.globalAlpha = 0.95;
          for (let i = 1; i <= 3; i++) {
            const q = at(p.poly, p.dir > 0 ? i / 4 : 1 - i / 4), a = q.angle + (p.dir > 0 ? 0 : Math.PI), s = 7 * u + 3;
            pctx.beginPath(); pctx.moveTo(q.x - s * Math.cos(a - 0.6), q.y - s * Math.sin(a - 0.6)); pctx.lineTo(q.x, q.y); pctx.lineTo(q.x - s * Math.cos(a + 0.6), q.y - s * Math.sin(a + 0.6)); pctx.stroke();
          }
          pctx.globalAlpha = 1;
          continue;
        }
        const speed = (40 + 140 * p.intensity) * Math.max(0.5, u) / Math.max(120, p.poly.length);
        const spr = sprite(p.color), s = (10 + 12 * p.intensity) * u + 4;
        pctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < p.phase.length; i++) {
          // Alleen een actieve route beweegt; bij inactief staan de deeltjes onmiddellijk stil en doven ze uit.
          if (p.active) p.phase[i] = (p.phase[i] + dt * speed) % 1;
          const f = p.dir > 0 ? p.phase[i] : 1 - p.phase[i];
          const q = at(p.poly, f), fade = Math.min(1, p.phase[i] * 6, (1 - p.phase[i]) * 6);
          pctx.globalAlpha = p.alpha * fade * (p.group === 'practice' ? 0.6 : 0.95);
          pctx.drawImage(spr, q.x - s / 2, q.y - s / 2, s, s);
        }
        pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1;
      }
    }

    // ---------------- routes → rustlagen, dimlaag en deeltjes
    function applyRoutes() {
      const R = model.routes;
      for (const [gid, ids] of Object.entries(GROUP_ROUTES)) {
        const act = ids.find(r => R[r] && R[r].active) || null;
        const sup = String(!act);
        if (quiet[gid] && quiet[gid].dataset.suppressed !== sup) quiet[gid].dataset.suppressed = sup;
        if (dimPaths[gid] && dimPaths[gid].dataset.suppressed !== sup) dimPaths[gid].dataset.suppressed = sup;
        rootEl.dataset['flow' + gid.charAt(0).toUpperCase() + gid.slice(1)] = act || 'off';
        for (const p of PF) if (p.group === gid) { p.active = !!act; p.dir = act ? DIR[act] : p.dir; p.intensity = act ? R[act].intensity : 0; }
      }
      kick();
    }

    // ---------------- layout en geometrie
    function geometry() {
      geoRaf = 0;
      if (destroyed) return;
      const next = rootEl.getBoundingClientRect().width >= OVERLAY_MIN && rootEl.dataset.scene !== 'error' && sceneOk ? 'overlay' : 'compact';
      if (next !== layout) { layout = next; rootEl.dataset.layout = next; }
      const r = stage.getBoundingClientRect();
      sw = r.width; sh = r.height;
      rootEl.style.setProperty('--u', (sw / (sceneOk ? S.image.natural.w : 1330)).toFixed(4));
      dpr = Math.min(2, win.devicePixelRatio || 1);
      particles.width = Math.max(1, Math.round(sw * dpr)); particles.height = Math.max(1, Math.round(sh * dpr));
      particles.style.width = sw + 'px'; particles.style.height = sh + 'px';
      for (const p of PF) p.poly = sw > 0 ? poly(p.points) : null;
      draw(0); kick();
    }
    const scheduleGeo = () => { if (!geoRaf && !destroyed) geoRaf = win.requestAnimationFrame(geometry); };
    const ro = new win.ResizeObserver(scheduleGeo); ro.observe(rootEl); ro.observe(stage);

    // ---------------- render (alleen patchen)
    function render() {
      const m = model;
      setText(status, m.status.text); status.dataset.tone = m.status.tone;
      setText(summary, 'DEMO · ' + m.summary);
      const w = m.warnings.map(x => x.text).join(' ');
      warn.hidden = !w; setText(warn, w);
      for (const k of KEYS) {
        const d = m.tiles[k], N = T[k];
        setText(N.title, d.title); setText(N.value, d.value); setText(N.sub, d.sub);
        const extra = k === 'cupra' ? 'Accu ' + d.soc : k === 'battery' ? 'Simulatie' : (d.tone === 'sim' ? 'Simulatie' : '');
        setText(N.extra, extra); N.extra.hidden = !extra;
        N.b.dataset.tone = d.tone;
        if (k === 'net') { N.b.dataset.direction = d.direction || 'none'; PL[k].dataset.direction = d.direction || 'none'; }
        N.b.setAttribute('aria-label', `${d.title}: ${d.value}${k === 'cupra' ? ', accu ' + d.soc : ''}${k === 'battery' ? ', simulatie' : ''}. ${d.sub}. Details openen.`);
        setText(PL[k].firstChild, d.value === '—' ? (k === 'practice' ? 'Niet gekoppeld' : '—') : d.value);
        PL[k].dataset.tone = d.tone;
      }
      const now = new Date(m.now);
      setText(pillTime, String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
      for (const [sid, b] of Object.entries(SB)) b.setAttribute('aria-pressed', String(sid === scenario));
      rootEl.dataset.activeScenario = scenario;
      applyRoutes();
      if (openKey) fillDetail(openKey);
    }
    function compute() { model = M.computeModel(M.scenarioInput(scenario, Date.now(), tick), model); render(); }

    // ---------------- detailpaneel
    const ROUTES_FOR = { pv: ['sun-home'], battery: [], house: ['sun-home', 'grid-home', 'home-grid', 'home-ev'], practice: ['home-practice'], net: ['grid-home', 'home-grid'], cupra: ['home-ev'] };
    function fillDetail(key) {
      const d = model.tiles[key];
      setText(D.title, d.title);
      setText(D.value, d.value + (key === 'cupra' ? ' · accu ' + d.soc : ''));
      const rows = [['Status', d.sub], ['Bron (DEMO-label)', d.entity || '—']];
      if (key === 'net') rows.push(['P1-tekenconfiguratie', model.p1Sign === 'export_positive' ? 'Export positief (gecorrigeerd)' : 'Import positief']);
      if (key === 'battery') rows.push(['Let op', 'Virtuele batterij: rekensimulatie, geen fysieke opslag en geen stroomroute.']);
      if (key === 'practice') rows.push(['Let op', d.tone === 'sim' ? 'Gesimuleerde waarde, niet gemeten en niet opgeteld bij het huis.' : 'Geen submeter gekoppeld: er wordt geen vermogen getoond.']);
      if (key === 'house') rows.push(['Balans (rekenkundig)', model.balance === 'sluit' ? 'Sluit — dit bewijst niet dat de meetketen is geverifieerd' : model.balance]);
      for (const rid of ROUTES_FOR[key]) { const r = model.routes[rid]; rows.push([ROUTE_LABEL[rid], r.active ? 'Actief · ' + M.formatPower(r.watts) : 'Inactief · ' + r.reason]); }
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
    on(doc, 'pointerdown', e => { if (openKey && !detail.contains(e.target) && !e.target.closest('.tile')) closeDetail(false); });
    on(group, 'click', e => { const b = e.target.closest('[data-scenario]'); if (!b) return; scenario = b.dataset.scenario; tick = 0; model = null; compute(); });
    on(play, 'click', () => { const onNow = play.getAttribute('aria-pressed') !== 'true'; play.setAttribute('aria-pressed', String(onNow)); play.textContent = onNow ? 'Schommeling aan' : 'Schommeling uit'; setTicker(); });
    const onVis = () => { setTicker(); kick(); };
    on(doc, 'visibilitychange', onVis);
    const onReduced = () => kick();
    if (reduced.addEventListener) { reduced.addEventListener('change', onReduced); listeners.push(() => reduced.removeEventListener('change', onReduced)); }
    function setTicker() {
      const want = !destroyed && options.ticker !== false && play.getAttribute('aria-pressed') === 'true' && !doc.hidden;
      if (want && !ticker) ticker = win.setInterval(() => { tick++; compute(); }, options.intervalMs || 2500);
      if (!want && ticker) { win.clearInterval(ticker); ticker = 0; }
    }

    // ---------------- start
    if (sceneOk) {
      on(img, 'load', onImageLoad);
      on(img, 'error', () => { if (destroyed) return; sceneState('error', 'Beeldlaag kon niet laden — alleen interface'); quietState('none'); scheduleGeo(); });
      img.src = base + S.image.file;
    } else sceneState('missing', 'Scènelaag ontbreekt — alleen interface');
    compute();
    scheduleGeo();
    setTicker();

    return {
      el: rootEl,
      get model() { return model; },
      get scenario() { return scenario; },
      setScenario(s) { if (M.SCENARIO_IDS.includes(s)) { scenario = s; tick = 0; model = null; compute(); } },
      step() { tick++; compute(); },
      setPaused(v) { paused = !!v; if (paused && raf) { win.cancelAnimationFrame(raf); raf = 0; } kick(); },
      isAnimating: () => !!raf,
      phases: fid => { const p = PF.find(x => x.id === fid); return p ? p.phase.slice() : null; },
      quietInfo: () => ({ state: rootEl.dataset.quiet, groups: Object.fromEntries(Object.entries(quiet).map(([g, c]) => [g, c.dataset.suppressed === 'true'])) }),
      destroy() {
        destroyed = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect();
        listeners.splice(0).forEach(off => off());
        rootEl.remove();
      }
    };
  }

  root.EhPve04Master = Object.freeze({ createMasterCockpit, buildQuietLayers, OVERLAY_MIN });
})(typeof globalThis !== 'undefined' ? globalThis : this);
