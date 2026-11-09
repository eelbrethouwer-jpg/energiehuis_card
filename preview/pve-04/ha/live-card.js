/* Energiehuis PVE-04 · ha/live-card.js — zelfstandige, alleen-lezen LIVE-cockpit als Lovelace-kaartelement (HA-01 PREVIEW).
 *
 * <energiehuis-live-cockpit-preview>: eigen elementnaam, los van de productiekaart `energiehuis-card`. Wordt NIET
 * automatisch als dashboardkaart geregistreerd (geen window.customCards, geen resource-installatie).
 * Contract met Home Assistant (standaard Lovelace-frontend):
 *   setConfig(config)   — zelfde sleutels als de productiekaart (net, zonnepanelen, laden, huis, cupra, batterij) +
 *                         p1_sign, image (media-source://media_source/…), asset_base.
 *   set hass(hass)      — leest alleen hass.states / hass.connected; werkt bij via één rAF per frame.
 *   hass.callWS({type:'media_source/resolve_media'}) — alleen-lezen WS-opdracht (geen servicecall) voor een
 *                         geauthenticeerde, tijdelijk getekende beeld-URL. Geen tokens, geen REST, geen opslag.
 * Geen bediening, geen servicecalls, geen schrijfacties.
 */
(function (root) {
  'use strict';
  const C = root.EhHaContract, A = root.EhHaAdapter, X = root.EhPve04Master;
  const SCRIPT_BASE = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/ha\/live-card\.js(\?.*)?$/, '') : ''; } catch (e) { return ''; } })();

  /** Alleen een same-origin pad onder /media/ (eventueel met ?authSig=…) wordt als beeld-URL geaccepteerd. */
  function safeResolvedUrl(url, origin) {
    if (typeof url !== 'string' || !url) return null;
    try {
      const u = new URL(url, origin);
      if (u.origin !== origin || !u.pathname.startsWith('/media/') || u.pathname.includes('..')) return null;
      return u.pathname + u.search;
    } catch (e) { return null; }
  }

  class EnergiehuisLiveCockpitPreview extends HTMLElement {
    constructor() {
      super();
      this._hass = null; this._config = null; this._adapter = null; this._cockpit = null;
      this._raf = 0; this._timer = 0; this._dirty = false; this._updates = 0; this._hassWaiters = [];
      this.attachShadow({ mode: 'open' });
    }
    setConfig(config) {
      const norm = C.normalizeConfig(config);
      if (norm.errors.length) throw new Error('Energiehuis LIVE-preview: ' + norm.errors.join('; '));
      const same = this._config && JSON.stringify(this._config) === JSON.stringify(config || {});
      this._config = Object.freeze({ ...(config || {}) });
      if (same) return;
      this._adapter = A.createAdapter(config);
      if (this._cockpit) { this._teardown(); if (this.isConnected) this._build(); }
    }
    set hass(hass) { this._hass = hass; this._dirty = true; if (hass) this._hassWaiters.splice(0).forEach(f => f(hass)); this._schedule(); }
    get hass() { return this._hass; }
    getCardSize() { return 9; }
    connectedCallback() {
      if (!this._adapter) this._adapter = A.createAdapter(this._config || {});
      if (!this._cockpit) this._build(); else this._cockpit.resume();
      this._dirty = true; this._schedule();
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0;
      if (this._timer) clearTimeout(this._timer); this._timer = 0;
      if (this._cockpit) this._cockpit.suspend();
    }
    _build() {
      const base = (this._config && this._config.asset_base) || SCRIPT_BASE;
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = base + 'styles.css';
      const mount = document.createElement('div'); mount.className = 'ehl-mount';
      const style = document.createElement('style'); style.textContent = ':host{display:block;color:var(--text);font-family:var(--font);line-height:1.35}.ehl-mount{padding:0}';
      this.shadowRoot.replaceChildren(style, link, mount);
      const cfg = this._adapter.config;
      this._cockpit = X.createMasterCockpit(mount, {
        mode: 'live', specs: this._adapter.specs,
        resolveImage: cfg.image ? () => this._resolveImage(cfg.image) : () => null,
        imageMissingText: cfg.image ? 'Beeld niet beschikbaar — alleen interface' : 'Geen beeld geconfigureerd — alleen interface'
      });
    }
    _teardown() { if (this._cockpit) this._cockpit.destroy(); this._cockpit = null; }
    async _resolveImage(id) {
      // wacht op het eerste hass-object (de kaart kan eerder aan de DOM hangen dan hass beschikbaar is)
      const h = this._hass || await new Promise(res => this._hassWaiters.push(res));
      if (!h || typeof h.callWS !== 'function') return null;
      const r = await h.callWS({ type: 'media_source/resolve_media', media_content_id: id });
      const origin = (typeof h.hassUrl === 'function' ? new URL(h.hassUrl('/')).origin : location.origin);
      const url = safeResolvedUrl(r && r.url, origin);
      return url && typeof h.hassUrl === 'function' ? h.hassUrl(url) : url;
    }
    _schedule() {
      if (this._raf || !this._cockpit || !this.isConnected) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._update(); });
    }
    _update(force) {
      if (!this._cockpit || !this.isConnected) return;
      const h = this._hass, now = Date.now();
      const changed = this._adapter.changed(h);
      if (changed || force || this._dirty) {
        if (changed || force) { this._cockpit.setInput(this._adapter.input(h, now)); this._updates++; }
        this._dirty = false;
      }
      // Eén timer: opnieuw beoordelen bij de eerstvolgende TTL-grens (deeltjes stoppen direct bij veroudering).
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => { this._timer = 0; this._update(true); }, this._adapter.nextCheckMs(h, now));
    }
    /** Alleen voor tests en diagnose. */
    get debug() { return { updates: this._updates, cockpit: this._cockpit, adapter: this._adapter, timer: !!this._timer }; }
  }

  if (!customElements.get('energiehuis-live-cockpit-preview')) customElements.define('energiehuis-live-cockpit-preview', EnergiehuisLiveCockpitPreview);
  root.EhHaLiveCard = Object.freeze({ EnergiehuisLiveCockpitPreview, safeResolvedUrl });
})(typeof globalThis !== 'undefined' ? globalThis : this);
