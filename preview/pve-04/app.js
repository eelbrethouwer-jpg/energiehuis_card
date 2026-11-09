/* Energiehuis PVE-04 · app.js — interactieve DEMO-cockpit (basis: PVE-03).
 * DEMO ONLY: geen Home Assistant, geen netwerk, geen opslag. Alle waarden komen uit model.js.
 * Beeldlagen, maskers en ankerpunten komen uitsluitend uit scene-manifest.js (EhPve04Manifest).
 * Ontbreekt het manifest of een beeldlaag, dan blijft de interface werken zonder scène (terugval).
 */
(function (root) {
  'use strict';
  const M = root.EhPve04Model, F = root.EhPve04Flows;
  const MOBILE_MAX = 700; // containerbreedte in px (moet gelijk zijn aan manifest desktop.minContainerWidth)
  const srcset = (c, type) => c.base.filter(b => b.type === type).sort((a, b) => a.w - b.w).map(b => b.file + ' ' + b.w + 'w').join(', ');
  const smallest = (c, type) => c.base.filter(b => b.type === type).sort((a, b) => a.w - b.w)[0];

  const ICON = {
    pv: '<path d="M4 15h16l-2-8H6z"/><path d="M8 7l-.8 8M12 7v8M16 7l.8 8M5 11h14"/><path d="M12 15v4M8 19h8"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><path d="M6 10v4M9 10v4"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    net: '<path d="M12 2l-4 20M12 2l4 20M7 8h10M6 13h12M9 3h6"/>',
    practice: '<path d="M3 20h18"/><rect x="5" y="8" width="14" height="12"/><path d="M4 8h16"/><rect x="8" y="11" width="5" height="4"/><path d="M15 20v-6h2v6"/>',
    cupra: '<path d="M3 15l2-5c.4-1 1.3-2 2.5-2h9c1.2 0 2.1 1 2.5 2l2 5v3H3z"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/><path d="M6 12h12"/>'
  };
  const TILES = [
    { key: 'pv', tag: '' },
    { key: 'battery', tag: 'Simulatie' },
    { key: 'house', tag: '' },
    { key: 'practice', tag: '' },
    { key: 'net', tag: '' },
    { key: 'cupra', tag: '' }
  ];
  let seq = 0;

  function el(doc, tag, cls, attrs) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  // Patcht de bestaande tekstnode (geen nieuwe nodes bij updates).
  function setText(node, text) {
    const t = node.firstChild;
    if (t && t.nodeType === 3 && !t.nextSibling) { if (t.data !== text) t.data = text; }
    else if (node.textContent !== text) node.textContent = text;
  }

  function createCockpit(host, options = {}) {
    const doc = host.ownerDocument, win = doc.defaultView;
    const id = 'ehc' + (++seq);
    let scenario = M.SCENARIO_IDS.includes(options.scenario) ? options.scenario : 'zon-export';
    let tick = 0, model = null, layout = null, ticker = 0, geoRaf = 0, destroyed = false, openKey = null, opener = null, maskImg = null;
    const MF = options.manifest !== undefined ? options.manifest : root.EhPve04Manifest;
    const comp = name => (MF && MF.compositions && MF.compositions[name]) || null;
    const listeners = [];
    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); listeners.push(() => t.removeEventListener(type, fn, o)); };

    // ---------------- build once
    const rootEl = el(doc, 'section', 'ehc', { 'aria-labelledby': id + '-title', 'data-layout': 'desktop' });
    const head = el(doc, 'header', 'ehc-head');
    head.innerHTML = `<div class="ehc-brand"><h1 class="ehc-title" id="${id}-title">Energiehuis <span>Live Cockpit</span></h1></div>`;
    const badge = el(doc, 'p', 'ehc-demo'); badge.textContent = 'DEMO — fictieve meetwaarden';
    const status = el(doc, 'p', 'ehc-status'); status.setAttribute('role', 'status');
    const sceneNote = el(doc, 'p', 'ehc-scene-note', { role: 'note' }); sceneNote.hidden = true;
    head.append(badge, sceneNote, status);

    const stage = el(doc, 'div', 'ehc-stage');
    const pic = el(doc, 'picture', 'ehc-scene');
    const source = el(doc, 'source', null, { type: 'image/webp' });
    const img = el(doc, 'img', null, { alt: 'Avondscène: woning met zonnepanelen, houten praktijkruimte links, groene Cupra bij de laadpaal rechts. Beeldlaag zonder meetwaarden.', decoding: 'async', fetchpriority: 'high' });
    pic.append(source, img);
    const shade = el(doc, 'div', 'ehc-shade', { 'aria-hidden': 'true' });
    const flowHost = el(doc, 'div', 'ehc-flows');
    const tiles = el(doc, 'div', 'ehc-tiles');
    const T = {};
    for (const t of TILES) {
      const b = el(doc, 'button', 'tile', { type: 'button', 'data-key': t.key, 'aria-haspopup': 'dialog', 'aria-controls': id + '-detail', 'aria-expanded': 'false' });
      b.innerHTML = `<span class="t-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[t.key]}</svg></span>
        <span class="t-body"><span class="t-title"></span><span class="t-value"></span><span class="t-extra"></span><span class="t-sub"></span></span>`;
      tiles.appendChild(b);
      T[t.key] = { b, title: b.querySelector('.t-title'), value: b.querySelector('.t-value'), extra: b.querySelector('.t-extra'), sub: b.querySelector('.t-sub') };
    }
    stage.append(pic, shade, flowHost, tiles);

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
    detail.innerHTML = `<div class="d-head"><h2 class="d-title" id="${id}-dt"></h2><button type="button" class="d-close" aria-label="Sluiten">×</button></div>
      <p class="d-value"></p><dl class="d-list"></dl><p class="d-note">DEMO: fictieve meetwaarden. Geen verbinding met Home Assistant, geen bediening.</p>`;
    const D = { title: detail.querySelector('.d-title'), value: detail.querySelector('.d-value'), list: detail.querySelector('.d-list'), close: detail.querySelector('.d-close') };

    rootEl.append(head, stage, summary, warn, controls, detail);
    host.appendChild(rootEl);
    const flows = F.createFlowLayer(flowHost, { idPrefix: id });

    // ---------------- layout & geometry
    function note(text) { sceneNote.hidden = !text; setText(sceneNote, text || ''); }
    function sceneState(state) {
      rootEl.dataset.scene = state;
      const ok = state === 'ok' || state === 'loading';
      pic.hidden = !ok; flowHost.hidden = !ok;
      if (state === 'missing') note('Scènelaag ontbreekt — alleen interface');
      else if (state === 'error') note('Beeldlaag kon niet laden — alleen interface');
      else note(MF && MF.status !== 'approved' ? (MF.statusLabel || 'Tijdelijk beeld — niet visueel goedgekeurd') : '');
    }
    function applyLayout(next) {
      if (next === layout) return;
      layout = next; rootEl.dataset.layout = next;
      const c = comp(next);
      if (!c) { sceneState('missing'); flows.setMask(null); return; }
      sceneState('loading');
      source.setAttribute('srcset', srcset(c, 'image/webp'));
      img.setAttribute('srcset', srcset(c, 'image/jpeg'));
      const fb = smallest(c, 'image/jpeg') || smallest(c, 'image/webp');
      img.setAttribute('src', fb.file);
      img.setAttribute('width', c.natural.w); img.setAttribute('height', c.natural.h);
      // Occlusiemasker: laden mislukt ⇒ geen masker (veilig: alleen visueel, nooit een datawijziging)
      flows.setMask(null); rootEl.dataset.mask = 'none';
      const mk = c.masks && c.masks[0];
      if (mk) {
        const mi = new win.Image(); maskImg = mi;
        mi.onload = () => { if (maskImg === mi && !destroyed) { flows.setMask(mi); rootEl.dataset.mask = 'ok'; scheduleGeo(); } };
        mi.onerror = () => { if (maskImg === mi && !destroyed) { flows.setMask(null); rootEl.dataset.mask = 'error'; } };
        mi.src = mk.file;
      }
    }
    function geometry() {
      geoRaf = 0;
      if (destroyed) return;
      const sr = stage.getBoundingClientRect();
      const next = rootEl.getBoundingClientRect().width < MOBILE_MAX ? 'mobile' : 'desktop';
      if (next !== layout) { applyLayout(next); }
      const c = comp(layout);
      if (!c) { flows.setGeometry({}, { w: sr.width, h: sr.height }, null); if (model) flows.setRoutes(model.routes); return; }
      const sz = Math.max(1, Math.round(Math.max(sr.width, sr.height * c.natural.w / c.natural.h))) + 'px';
      if (source.getAttribute('sizes') !== sz) { source.setAttribute('sizes', sz); img.setAttribute('sizes', sz); }
      const an = c.anchors || {};
      const t = F.coverTransform(sr.width, sr.height, c.natural.w, c.natural.h, 0.5, 0.5);
      const P = k => an[k] ? F.mapPoint(an[k], t) : null;
      const nr = T.net.b.getBoundingClientRect();
      const pts = { pv: P('pv'), house: P('house'), cupra: P('cupraPort'), charger: P('charger'), practice: P('practice'), grid: { x: nr.left - sr.left + nr.width / 2, y: nr.top - sr.top - 2 } };
      // punten buiten beeld vastzetten aan de rand
      for (const k of Object.keys(pts)) if (pts[k]) pts[k] = { x: Math.max(8, Math.min(sr.width - 8, pts[k].x)), y: Math.max(8, Math.min(sr.height - 8, pts[k].y)) };
      flows.setGeometry(pts, { w: sr.width, h: sr.height }, t);
      if (model) flows.setRoutes(model.routes);
    }
    const scheduleGeo = () => { if (!geoRaf && !destroyed) geoRaf = win.requestAnimationFrame(geometry); };
    const ro = new win.ResizeObserver(scheduleGeo); ro.observe(stage); ro.observe(rootEl);
    on(img, 'load', () => { if (rootEl.dataset.scene === 'loading') sceneState('ok'); scheduleGeo(); });
    on(img, 'error', () => { if (comp(layout)) sceneState('error'); });

    // ---------------- render (patch only)
    function render() {
      const m = model;
      setText(status, m.status.text); status.dataset.tone = m.status.tone;
      setText(summary, 'DEMO · ' + m.summary);
      const w = m.warnings.map(x => x.text).join(' ');
      warn.hidden = !w; setText(warn, w);
      for (const t of TILES) {
        const d = m.tiles[t.key], N = T[t.key];
        setText(N.title, d.title); setText(N.value, d.value); setText(N.sub, d.sub);
        setText(N.extra, t.key === 'cupra' ? 'Accu ' + d.soc : t.key === 'battery' ? 'Simulatie' : (d.tone === 'sim' ? 'Simulatie' : ''));
        N.extra.hidden = !N.extra.textContent;
        N.b.dataset.tone = d.tone;
        if (t.key === 'net') N.b.dataset.direction = d.direction || 'none';
        N.b.setAttribute('aria-label', `${d.title}: ${d.value}${t.key === 'cupra' ? ', accu ' + d.soc : ''}. ${d.sub}. Details openen.`);
      }
      flows.setRoutes(m.routes);
      for (const [sid, b] of Object.entries(SB)) b.setAttribute('aria-pressed', String(sid === scenario));
      rootEl.dataset.activeScenario = scenario;
      if (openKey) fillDetail(openKey);
    }
    function compute() {
      model = M.computeModel(M.scenarioInput(scenario, Date.now(), tick), model);
      render();
    }

    // ---------------- detail panel
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
      for (const rid of ROUTES_FOR[key]) { const r = model.routes[rid]; rows.push([F.STYLE[rid].label, r.active ? 'Actief · ' + M.formatPower(r.watts) : 'Inactief · ' + r.reason]); }
      const frag = doc.createDocumentFragment();
      for (const [k, v] of rows) { const dt = doc.createElement('dt'); dt.textContent = k; const dd = doc.createElement('dd'); dd.textContent = v; frag.append(dt, dd); }
      D.list.replaceChildren(frag);
    }
    function openDetail(key, btn) {
      if (openKey) T[openKey].b.setAttribute('aria-expanded', 'false');
      openKey = key; opener = btn;
      fillDetail(key);
      detail.hidden = false; detail.dataset.key = key;
      btn.setAttribute('aria-expanded', 'true');
      D.close.focus();
    }
    function closeDetail(restore = true) {
      if (!openKey) return;
      T[openKey].b.setAttribute('aria-expanded', 'false');
      detail.hidden = true; openKey = null;
      if (restore && opener && opener.isConnected) opener.focus();
      opener = null;
    }

    on(tiles, 'click', e => { const b = e.target.closest('.tile'); if (!b) return; const k = b.dataset.key; if (openKey === k) closeDetail(); else openDetail(k, b); });
    on(D.close, 'click', () => closeDetail());
    on(rootEl, 'keydown', e => { if (e.key === 'Escape' && openKey) { e.preventDefault(); e.stopPropagation(); closeDetail(); } });
    on(doc, 'pointerdown', e => { if (openKey && !detail.contains(e.target) && !e.target.closest('.tile')) closeDetail(false); });
    on(group, 'click', e => { const b = e.target.closest('[data-scenario]'); if (!b) return; scenario = b.dataset.scenario; tick = 0; model = null; compute(); });
    on(play, 'click', () => { const onNow = play.getAttribute('aria-pressed') !== 'true'; play.setAttribute('aria-pressed', String(onNow)); play.textContent = onNow ? 'Schommeling aan' : 'Schommeling uit'; setTicker(); });
    on(doc, 'visibilitychange', () => setTicker());

    function setTicker() {
      const want = !destroyed && options.ticker !== false && play.getAttribute('aria-pressed') === 'true' && !doc.hidden;
      if (want && !ticker) ticker = win.setInterval(() => { tick++; compute(); }, options.intervalMs || 2500);
      if (!want && ticker) { win.clearInterval(ticker); ticker = 0; }
    }

    applyLayout(rootEl.getBoundingClientRect().width < MOBILE_MAX ? 'mobile' : 'desktop');
    compute();
    scheduleGeo();
    setTicker();

    return {
      el: rootEl,
      get model() { return model; },
      get scenario() { return scenario; },
      get manifest() { return MF; },
      setScenario(s) { if (M.SCENARIO_IDS.includes(s)) { scenario = s; tick = 0; model = null; compute(); } },
      step() { tick++; compute(); },
      flows,
      destroy() {
        destroyed = true;
        if (ticker) win.clearInterval(ticker); ticker = 0;
        if (geoRaf) win.cancelAnimationFrame(geoRaf); geoRaf = 0;
        ro.disconnect();
        if (maskImg) { maskImg.onload = maskImg.onerror = null; maskImg = null; }
        listeners.splice(0).forEach(off => off());
        flows.destroy();
        rootEl.remove();
      }
    };
  }

  root.EhPve04 = Object.freeze({ createCockpit });
})(typeof globalThis !== 'undefined' ? globalThis : this);
