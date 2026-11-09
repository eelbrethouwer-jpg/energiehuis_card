/* Energiehuis PVE-04 · manifest-validate.js — pure validatie van het scènemanifest.
 *
 * validateManifest(mf) → { ok, version, errors: string[] }. Gooit NOOIT een exceptie: elke vorm van
 * invoer (null, getallen, cyclische objecten, getters die gooien) levert een resultaat op.
 * Ondersteunt schema v1 (alleen lagen/maskers/ankers) en v2 (+ coördinatenstelsel, uiZones, keyObjects,
 * protectedAreas en optionele lightLayers). De runtime bouwt de scène alleen bij ok === true.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EhPve04ManifestValidate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMAS = { 'energiehuis.scene-manifest/1': 1, 'energiehuis.scene-manifest/2': 2 };
  const COMPOSITIONS = ['desktop', 'mobile'];
  const IMAGE_TYPES = { 'image/webp': /\.webp$/i, 'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i };
  const REQUIRED_ANCHORS = ['pv', 'house', 'cupraPort', 'practice'];
  const UI_KEYS = ['pv', 'battery', 'house', 'practice', 'net', 'cupra'];
  const BLENDS = ['normal', 'screen', 'lighten', 'plus-lighter', 'overlay', 'soft-light'];

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const posInt = v => Number.isInteger(v) && v > 0;

  /** Alleen relatieve paden binnen assets/, zonder ..-segmenten, schema's, query's of rare tekens. */
  function safePath(p) {
    return typeof p === 'string' && p.length <= 200 && /^assets\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p) && !p.includes('..');
  }

  function checkImage(e, where, errs, { mask = false, ratio = null } = {}) {
    if (!isObj(e)) { errs.push(`${where}: geen object`); return; }
    if (!safePath(e.file)) errs.push(`${where}.file: onveilig of ongeldig pad (${String(e.file).slice(0, 60)})`);
    if (!IMAGE_TYPES[e.type]) errs.push(`${where}.type: niet toegestaan (${e.type})`);
    else if (typeof e.file === 'string' && !IMAGE_TYPES[e.type].test(e.file)) errs.push(`${where}: extensie past niet bij type ${e.type}`);
    if (!posInt(e.w) || !posInt(e.h)) errs.push(`${where}: w/h moeten positieve gehele getallen zijn`);
    else if (ratio && Math.abs(e.w / e.h - ratio) > 0.01) errs.push(`${where}: beeldverhouding wijkt af van natural`);
    if (!posInt(e.bytes)) errs.push(`${where}.bytes: ontbreekt of ongeldig`);
    if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256)) errs.push(`${where}.sha256: ontbreekt of geen 64 hex-tekens`);
    if (typeof e.rights !== 'string' || !e.rights) errs.push(`${where}.rights: ontbreekt`);
    if (mask) {
      if (e.type !== 'image/png') errs.push(`${where}: masker moet image/png zijn`);
      if (e.alpha !== true) errs.push(`${where}.alpha: masker vereist een alfakanaal`);
      if (typeof e.semantics !== 'string' || !/occlusie/i.test(e.semantics)) errs.push(`${where}.semantics: ontbreekt (alfa = occlusie)`);
      if (typeof e.id !== 'string' || !e.id) errs.push(`${where}.id: ontbreekt`);
    }
  }

  function checkRect(r, where, errs, { inImage = true } = {}) {
    if (!isObj(r) || ![r.x, r.y, r.w, r.h].every(num)) { errs.push(`${where}: rechthoek met eindige x/y/w/h vereist`); return; }
    if (r.w <= 0 || r.h <= 0) errs.push(`${where}: w/h moeten > 0 zijn`);
    if (inImage && (r.x < 0 || r.y < 0 || r.x + r.w > 1.0001 || r.y + r.h > 1.0001)) errs.push(`${where}: buiten 0..1`);
  }

  function validateComposition(name, c, version, rightsIds, errs) {
    const w = `compositions.${name}`;
    if (!isObj(c)) { errs.push(`${w}: ontbreekt`); return; }
    if (!isObj(c.natural) || !posInt(c.natural.w) || !posInt(c.natural.h)) { errs.push(`${w}.natural: w/h ontbreken of ongeldig`); }
    const ratio = isObj(c.natural) && posInt(c.natural.w) && posInt(c.natural.h) ? c.natural.w / c.natural.h : null;
    if (!Array.isArray(c.base) || c.base.length === 0) errs.push(`${w}.base: ontbreekt of leeg`);
    else {
      c.base.forEach((b, i) => checkImage(b, `${w}.base[${i}]`, errs, { ratio }));
      if (!c.base.some(b => isObj(b) && b.type === 'image/webp')) errs.push(`${w}.base: geen WebP-laag`);
      if (!c.base.some(b => isObj(b) && b.type === 'image/jpeg')) errs.push(`${w}.base: geen JPEG-terugval`);
    }
    if (c.masks !== undefined && !Array.isArray(c.masks)) errs.push(`${w}.masks: geen lijst`);
    else (c.masks || []).forEach((m, i) => checkImage(m, `${w}.masks[${i}]`, errs, { mask: true, ratio }));
    if (!isObj(c.anchors)) errs.push(`${w}.anchors: ontbreekt`);
    else {
      for (const k of REQUIRED_ANCHORS) { const a = c.anchors[k]; if (!isObj(a) || !num(a.x) || !num(a.y)) errs.push(`${w}.anchors.${k}: ontbreekt of niet eindig`); }
      for (const [k, a] of Object.entries(c.anchors)) if (isObj(a) && (Math.abs(a.x) > 4 || Math.abs(a.y) > 4)) errs.push(`${w}.anchors.${k}: onwaarschijnlijk ver buiten beeld`);
    }
    if (rightsIds) for (const e of [...(Array.isArray(c.base) ? c.base : []), ...(Array.isArray(c.masks) ? c.masks : [])]) if (isObj(e) && e.rights && !rightsIds.has(e.rights)) errs.push(`${w}: rechten-ID ${e.rights} niet gedefinieerd`);
    if (version >= 2) {
      if (!Array.isArray(c.uiZones)) errs.push(`${w}.uiZones: ontbreekt`);
      else {
        c.uiZones.forEach((z, i) => { checkRect(z, `${w}.uiZones[${i}]`, errs); if (!UI_KEYS.includes(z && z.id)) errs.push(`${w}.uiZones[${i}].id: onbekend`); });
        for (const k of UI_KEYS) if (!c.uiZones.some(z => z && z.id === k)) errs.push(`${w}.uiZones: zone voor ${k} ontbreekt`);
      }
      if (!isObj(c.keyObjects)) errs.push(`${w}.keyObjects: ontbreekt`);
      else for (const [k, r] of Object.entries(c.keyObjects)) checkRect(r, `${w}.keyObjects.${k}`, errs);
      if (!Array.isArray(c.protectedAreas)) errs.push(`${w}.protectedAreas: ontbreekt`);
      else c.protectedAreas.forEach((p, i) => { checkRect(p, `${w}.protectedAreas[${i}]`, errs); if (!p || typeof p.id !== 'string') errs.push(`${w}.protectedAreas[${i}].id: ontbreekt`); });
      // Optionele lichtlagen: uitbreidbaar. Onbekende extra velden zijn toegestaan; verplichte velden worden gecontroleerd.
      if (c.lightLayers !== undefined) {
        if (!Array.isArray(c.lightLayers)) errs.push(`${w}.lightLayers: geen lijst`);
        else c.lightLayers.forEach((l, i) => {
          checkImage(l, `${w}.lightLayers[${i}]`, errs, { ratio });
          if (!l || typeof l.id !== 'string') errs.push(`${w}.lightLayers[${i}].id: ontbreekt`);
          if (l && l.blend !== undefined && !BLENDS.includes(l.blend)) errs.push(`${w}.lightLayers[${i}].blend: niet toegestaan`);
          if (l && typeof l.trigger !== 'string') errs.push(`${w}.lightLayers[${i}].trigger: ontbreekt`);
        });
      }
    }
  }

  function validateManifest(mf) {
    const errs = [];
    try {
      if (!isObj(mf)) return { ok: false, version: null, errors: ['manifest ontbreekt of is geen object'] };
      const version = SCHEMAS[mf.schema];
      if (!version) return { ok: false, version: null, errors: [`onbekend schema: ${String(mf.schema).slice(0, 60)}`] };
      if (!['placeholder', 'approved'].includes(mf.status)) errs.push('status moet placeholder of approved zijn');
      if (mf.status === 'placeholder' && typeof mf.statusLabel !== 'string') errs.push('statusLabel ontbreekt bij placeholder');
      if (version >= 2 && (!isObj(mf.coordinateSystem) || mf.coordinateSystem.id !== 'normalized-image')) errs.push('coordinateSystem.id moet normalized-image zijn');
      const rightsIds = isObj(mf.rights) ? new Set(Object.keys(mf.rights)) : null;
      if (!rightsIds || rightsIds.size === 0) errs.push('rights: ontbreekt');
      if (!isObj(mf.compositions)) errs.push('compositions: ontbreekt');
      else for (const name of COMPOSITIONS) validateComposition(name, mf.compositions[name], version, rightsIds, errs);
      return { ok: errs.length === 0, version, errors: errs };
    } catch (e) {
      return { ok: false, version: null, errors: errs.concat('validatie afgebroken: ' + String(e && e.message || e).slice(0, 120)) };
    }
  }

  return Object.freeze({ validateManifest, safePath, SCHEMAS, REQUIRED_ANCHORS, UI_KEYS });
});
