/* Energiehuis PVE-04 · flows.js — weergave van energieroutes (DEMO), met occlusiemaskers.
 *
 * Maskers (PVE-04): een PNG met alfa = voorgrond-occlusie (auto, beplanting, paaltjes). Deeltjes
 * (canvas, destination-out) en routelijnen (SVG <mask>) verdwijnen achter die objecten. De UI-kaarten
 * liggen in een hogere laag en worden nooit door een masker of route bedekt.
 *
 * Deze laag tekent ALLEEN routes die model.js `active: true` geeft. Een inactieve route krijgt
 * direct data-active="false"; de lichtdeeltjes doven daarna passief uit (geen actieve claim).
 * De virtuele batterij heeft bewust geen route: het is een simulatie, geen fysieke opslag.
 *
 * Pure geometrie (coverTransform, routePoints, cubic) is exporteerbaar voor Node-tests;
 * createFlowLayer() gebruikt de DOM en wordt alleen in de browser aangeroepen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhPve04Flows = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STYLE = Object.freeze({
    'sun-home': { color: '#FFC23D', label: 'Zon → huis' },
    'grid-home': { color: '#FF8A5B', label: 'Net → huis (afname)' },
    'home-grid': { color: '#4BE38A', label: 'Huis → net (teruglevering)' },
    'home-ev': { color: '#33DDFF', label: 'Huis → Cupra' },
    'home-practice': { color: '#2FD4C0', label: 'Huis → praktijk (SIMULATIE)', dashed: true }
  });
  const BATTERY_COLOR = '#B07CFF'; // alleen voor de tegel; nooit een route

  /** object-fit: cover — map genormaliseerde beeldcoördinaten naar containerpixels. */
  function coverTransform(cw, ch, iw, ih, posX = 0.5, posY = 0.5) {
    const scale = Math.max(cw / iw, ch / ih);
    const w = iw * scale, h = ih * scale;
    return { scale, w, h, ox: (cw - w) * posX, oy: (ch - h) * posY };
  }
  const mapPoint = (p, t) => ({ x: t.ox + p.x * t.w, y: t.oy + p.y * t.h });

  /**
   * Bepaalt begin/eind (+ optioneel tussenpunt) per route in containerpixels.
   * pts: { pv, house, grid, cupra, charger, practice } in px.
   */
  function routePoints(id, pts) {
    switch (id) {
      case 'sun-home': return [pts.pv, pts.house];
      case 'grid-home': return [pts.grid, pts.house];
      case 'home-grid': return [pts.house, pts.grid];
      case 'home-ev': return [pts.house, pts.cupra];
      case 'home-practice': return [pts.house, pts.practice];
      default: return null;
    }
  }

  /** Vloeiende kubische curves door 2 of 3 punten. Geeft een lijst segmenten [p0,c1,c2,p3]. */
  function segments(points, bend = 0.18) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      // buig loodrecht op de lijn, altijd “naar beneden” zodat routes als kabels hangen
      let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; }
      const k = len * bend;
      out.push([a, { x: a.x + dx * 0.3 + nx * k, y: a.y + dy * 0.3 + ny * k }, { x: a.x + dx * 0.7 + nx * k, y: a.y + dy * 0.7 + ny * k }, b]);
    }
    return out;
  }
  function cubic(s, t) {
    const u = 1 - t;
    const x = u * u * u * s[0].x + 3 * u * u * t * s[1].x + 3 * u * t * t * s[2].x + t * t * t * s[3].x;
    const y = u * u * u * s[0].y + 3 * u * u * t * s[1].y + 3 * u * t * t * s[2].y + t * t * t * s[3].y;
    return { x, y };
  }
  function polyline(segs, stepsPer = 40) {
    const pts = [];
    segs.forEach((s, i) => { for (let k = i ? 1 : 0; k <= stepsPer; k++) pts.push(cubic(s, k / stepsPer)); });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, length: cum[cum.length - 1] };
  }
  function at(poly, f) {
    const d = f * poly.length; let lo = 0, hi = poly.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (poly.cum[m] < d) lo = m; else hi = m; }
    const span = poly.cum[hi] - poly.cum[lo] || 1, t = (d - poly.cum[lo]) / span;
    const a = poly.pts[lo], b = poly.pts[hi];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  const pathD = segs => segs.map((s, i) => (i ? '' : `M${s[0].x.toFixed(1)},${s[0].y.toFixed(1)}`) + `C${s[1].x.toFixed(1)},${s[1].y.toFixed(1)} ${s[2].x.toFixed(1)},${s[2].y.toFixed(1)} ${s[3].x.toFixed(1)},${s[3].y.toFixed(1)}`).join('');

  // ------------------------------------------------------------------ DOM layer
  const SVGNS = 'http://www.w3.org/2000/svg';

  function createFlowLayer(host, opts = {}) {
    const doc = host.ownerDocument, win = doc.defaultView;
    const svg = doc.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'flows'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const canvas = doc.createElement('canvas'); canvas.className = 'particles'; canvas.setAttribute('aria-hidden', 'true');
    host.append(svg, canvas);
    // SVG-masker: wit = zichtbaar; het occlusiebeeld wordt via een filter zwart (behoudt alfa) en verbergt zo.
    const pfx = (opts.idPrefix || 'ehf') + '-flows';
    const defs = doc.createElementNS(SVGNS, 'defs');
    defs.innerHTML = `<filter id="${pfx}-inv" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>` +
      `<mask id="${pfx}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1"><rect class="m-all" x="0" y="0" width="1" height="1" fill="#fff"/><image class="m-img" preserveAspectRatio="none" filter="url(#${pfx}-inv)"/></mask>`;
    svg.appendChild(defs);
    const maskEl = defs.querySelector('mask'), maskRect = defs.querySelector('.m-all'), maskImgEl = defs.querySelector('.m-img');
    const routesG = doc.createElementNS(SVGNS, 'g'); routesG.setAttribute('class', 'routes'); svg.appendChild(routesG);
    let mask = null, cover = null;
    const ctx = canvas.getContext('2d');

    const R = {};
    for (const id of Object.keys(STYLE)) {
      const g = doc.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'route' + (STYLE[id].dashed ? ' is-sim' : '')); g.dataset.route = id; g.dataset.active = 'false';
      g.style.setProperty('--route', STYLE[id].color);
      const groove = doc.createElementNS(SVGNS, 'path'); groove.setAttribute('class', 'r-groove');
      const glow = doc.createElementNS(SVGNS, 'path'); glow.setAttribute('class', 'r-glow');
      const core = doc.createElementNS(SVGNS, 'path'); core.setAttribute('class', 'r-core');
      const chev = doc.createElementNS(SVGNS, 'g'); chev.setAttribute('class', 'r-chev');
      const chevs = [0, 1, 2].map(() => { const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M-5,-5 L2,0 L-5,5'); chev.appendChild(p); return p; });
      g.append(groove, glow, core, chev); routesG.appendChild(g);
      // persistente deeltjes: fase blijft behouden over updates heen
      const n = 7;
      R[id] = { id, g, groove, glow, core, chevs, poly: null, active: false, alpha: 0, intensity: 0, phase: Array.from({ length: n }, (_, i) => i / n) };
    }

    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, paused = false, destroyed = false;
    const reduced = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {}, removeEventListener() {} };
    const sprites = {};
    function sprite(color) {
      if (sprites[color]) return sprites[color];
      const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, color); gr.addColorStop(0.5, color + '55'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[color] = c);
    }

    function setGeometry(points, size, coverT) {
      w = size.w; h = size.h; cover = coverT || null;
      for (const el of [maskEl, maskRect]) { el.setAttribute('width', w); el.setAttribute('height', h); }
      applyMask();
      dpr = Math.min(2, win.devicePixelRatio || 1);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      for (const r of Object.values(R)) {
        const p = routePoints(r.id, points);
        if (!p || p.some(x => !x)) { r.poly = null; r.g.style.display = 'none'; continue; }
        r.g.style.display = '';
        const segs = segments(p);
        const d = pathD(segs);
        r.groove.setAttribute('d', d); r.glow.setAttribute('d', d); r.core.setAttribute('d', d);
        r.poly = polyline(segs);
        r.chevs.forEach((c, i) => { const q = at(r.poly, (i + 1) / 4); c.setAttribute('transform', `translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) rotate(${(q.angle * 180 / Math.PI).toFixed(1)})`); });
      }
      draw(0);
      kick();
    }

    function setRoutes(routes) {
      for (const r of Object.values(R)) {
        const m = routes[r.id];
        const active = !!(m && m.active);
        r.active = active; r.intensity = active ? m.intensity : 0;
        if (r.g.dataset.active !== String(active)) r.g.dataset.active = String(active);
        const iv = r.intensity.toFixed(3);
        if (r.g.style.getPropertyValue('--i') !== iv) r.g.style.setProperty('--i', iv);
      }
      kick();
    }

    function animating() { return !paused && !reduced.matches && !doc.hidden; }
    function kick() { if (!destroyed && !raf && animating()) { last = 0; raf = win.requestAnimationFrame(frame); } else if (!animating()) draw(0); }
    function frame(ts) {
      raf = 0;
      if (destroyed || !animating()) return;
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      draw(dt);
      // blijf alleen draaien zolang er iets zichtbaar beweegt
      if (Object.values(R).some(r => r.active || r.alpha > 0.01)) raf = win.requestAnimationFrame(frame);
    }
    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const still = !animating();
      for (const r of Object.values(R)) {
        const target = r.active ? 1 : 0;
        r.alpha += (target - r.alpha) * Math.min(1, dt * (r.active ? 4 : 6)); // passieve fade, geen claim
        if (!r.active && dt === 0) r.alpha = still ? 0 : r.alpha;
        if (still || !r.poly || r.alpha < 0.01) continue;
        const speed = (40 + 140 * r.intensity) / Math.max(120, r.poly.length); // fractie per seconde
        const img = sprite(STYLE[r.id].color), s = 10 + 10 * r.intensity;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < r.phase.length; i++) {
          // Alleen een actieve route beweegt. Bij ongeldig/verouderd/offline staan de deeltjes
          // onmiddellijk stil en doven ze passief uit op hun plek (geen richtingsclaim).
          if (r.active) r.phase[i] = (r.phase[i] + dt * speed) % 1;
          const q = at(r.poly, r.phase[i]);
          const fade = Math.min(1, r.phase[i] * 6, (1 - r.phase[i]) * 6);
          ctx.globalAlpha = r.alpha * fade * (STYLE[r.id].dashed ? 0.55 : 0.95);
          ctx.drawImage(img, q.x - s / 2, q.y - s / 2, s, s);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      // Occlusie: deeltjes achter voorgrondobjecten wegsnijden (alleen deze canvaslaag, nooit de UI).
      if (mask && cover && !still) {
        ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1;
        ctx.drawImage(mask, cover.ox, cover.oy, cover.w, cover.h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    function applyMask() {
      const on = !!(mask && cover);
      if (on) {
        maskImgEl.setAttribute('href', mask.src);
        maskImgEl.setAttribute('x', cover.ox); maskImgEl.setAttribute('y', cover.oy);
        maskImgEl.setAttribute('width', cover.w); maskImgEl.setAttribute('height', cover.h);
        routesG.setAttribute('mask', `url(#${pfx}-mask)`);
      } else routesG.removeAttribute('mask');
    }
    function setMask(img) { mask = img && img.complete && img.naturalWidth ? img : null; applyMask(); draw(0); kick(); }

    const onVis = () => kick();
    const onReduced = () => kick();
    doc.addEventListener('visibilitychange', onVis);
    reduced.addEventListener ? reduced.addEventListener('change', onReduced) : reduced.addListener && reduced.addListener(onReduced);

    return {
      setGeometry, setRoutes, setMask,
      maskInfo: () => ({ active: !!(mask && cover), href: mask ? mask.src : null, rect: cover ? { x: cover.ox, y: cover.oy, w: cover.w, h: cover.h } : null, maskId: pfx + '-mask' }),
      setPaused(v) { paused = !!v; if (paused && raf) { win.cancelAnimationFrame(raf); raf = 0; } kick(); },
      isAnimating: () => !!raf,
      phases: id => R[id] ? R[id].phase.slice() : null,
      destroy() {
        destroyed = true;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        doc.removeEventListener('visibilitychange', onVis);
        reduced.removeEventListener ? reduced.removeEventListener('change', onReduced) : reduced.removeListener && reduced.removeListener(onReduced);
        svg.remove(); canvas.remove();
      }
    };
  }

  return Object.freeze({ STYLE, BATTERY_COLOR, coverTransform, mapPoint, routePoints, segments, polyline, at, pathD, createFlowLayer });
});
