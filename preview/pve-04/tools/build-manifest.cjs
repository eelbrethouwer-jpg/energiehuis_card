'use strict';
/*
 * PVE-04 — bouwt scene-manifest.js uit de echte bestanden (bytes + SHA-256), de ankerpunten uit
 * tools/render-output.json en de rechten uit tools/rights.json. Deterministisch: geen tijdstempels.
 *
 *   node preview/pve-04/tools/build-manifest.cjs          # schrijven
 *   node preview/pve-04/tools/build-manifest.cjs --check  # alleen controleren (exit 1 bij verschil)
 *
 * Voor stap 1 (fotorealistische lagen) volstaat het om de beeldbestanden te vervangen, render-output.json
 * (ankerpunten) en rights.json bij te werken, het SCENE-blok hieronder aan te passen en dit script te draaien.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, '..');
const OUT = path.join(DIR, 'scene-manifest.js');

const SCENE = {
  sceneId: 'pve04-placeholder-cgi',
  status: 'placeholder',                    // 'placeholder' | 'approved' (alleen na visueel akkoord van de eigenaar)
  statusLabel: 'Tijdelijk beeld — niet visueel goedgekeurd',
  rights: 'R-PVE04-PLACEHOLDER-CGI',
  compositions: {
    desktop: {
      minContainerWidth: 700, budgetBytes: 1.5 * 1024 * 1024,
      base: ['placeholder-desktop-1330.webp', 'placeholder-desktop-2660.webp', 'placeholder-desktop-1330.jpg', 'placeholder-desktop-2660.jpg'],
      masks: [['foreground', 'mask-desktop-1330.png']],
      // Gebieden waar het midden van elke UI-kaart moet liggen (onderling niet overlappend).
      uiZones: [
        { id: 'pv', x: 0, y: 0, w: 0.35, h: 0.25, purpose: 'Zonnepanelen-kaart linksboven, naast het dak' },
        { id: 'practice', x: 0, y: 0.25, w: 0.35, h: 0.35, purpose: 'Praktijkkaart links, boven het bijgebouw' },
        { id: 'battery', x: 0, y: 0.7, w: 0.35, h: 0.3, purpose: 'Virtuele batterij linksonder' },
        { id: 'house', x: 0.35, y: 0.55, w: 0.3, h: 0.25, purpose: 'Huiskaart midden op de gevel' },
        { id: 'net', x: 0.35, y: 0.82, w: 0.3, h: 0.18, purpose: 'Net midden onder de woning' },
        { id: 'cupra', x: 0.65, y: 0.1, w: 0.35, h: 0.45, purpose: 'Cupra-kaart boven de auto' }
      ],
      // Beschermde visuele gebieden: herkenbare kern van een object (kader minus marges l/t/r/b als fractie
      // van het kader). Geen enkele UI-kaart mag een beschermd gebied raken (standaard tekstgrootte).
      protected: [
        { id: 'car', from: 'car', inset: [0.15, 0.15, 0.15, 0.15], purpose: 'Groene auto: carrosserie en ruiten' },
        { id: 'practice-front', from: 'practice', inset: [0.2, 0.2, 0.2, 0.2], purpose: 'Praktijk: verlichte schuifpui' },
        { id: 'pv', from: 'pv', inset: [0.15, 0.15, 0.15, 0.15], purpose: 'Zonnepanelen' },
        { id: 'house-upper', from: 'house', inset: [0.25, 0.15, 0.25, 0.45], purpose: 'Woning: dak, dakkapel en topgevel' }
      ],
      lightLayers: []
    },
    mobile: {
      minContainerWidth: 0, budgetBytes: 1.0 * 1024 * 1024,
      base: ['placeholder-mobile-540.webp', 'placeholder-mobile-1080.webp', 'placeholder-mobile-540.jpg', 'placeholder-mobile-1080.jpg'],
      masks: [['foreground', 'mask-mobile-540.png']],
      uiZones: [
        { id: 'pv', x: 0, y: 0, w: 0.5, h: 0.22, purpose: 'Zonnepanelen-kaart linksboven (lucht)' },
        { id: 'battery', x: 0.5, y: 0, w: 0.5, h: 0.22, purpose: 'Virtuele batterij rechtsboven (lucht)' },
        { id: 'house', x: 0.2, y: 0.3, w: 0.6, h: 0.22, purpose: 'Huiskaart midden op de gevel' },
        { id: 'practice', x: 0, y: 0.58, w: 0.5, h: 0.25, purpose: 'Praktijkkaart linksonder, onder het bijgebouw' },
        { id: 'cupra', x: 0.5, y: 0.58, w: 0.5, h: 0.25, purpose: 'Cupra-kaart rechtsonder, onder de auto' },
        { id: 'net', x: 0.15, y: 0.83, w: 0.7, h: 0.17, purpose: 'Net midden onder' }
      ],
      protected: [
        { id: 'car', from: 'car', inset: [0.2, 0.1, 0.2, 0.45], purpose: 'Groene auto: silhouet, dak en ruiten' },
        { id: 'practice-front', from: 'practice', inset: [0.15, 0.1, 0.2, 0.35], purpose: 'Praktijk: dak en verlichte pui' },
        { id: 'pv', from: 'pv', inset: [0.15, 0.15, 0.15, 0.15], purpose: 'Zonnepanelen' },
        { id: 'house-upper', from: 'house', inset: [0.3, 0.15, 0.3, 0.6], purpose: 'Woning: dakkapel en topgevel' }
      ],
      lightLayers: []
    }
  }
};
const COORDINATES = {
  id: 'normalized-image',
  origin: 'linksboven van de natuurlijke beeldlaag',
  axes: 'x naar rechts, y naar beneden',
  unit: 'fractie van natural.w (x, w) en natural.h (y, h); 0..1 = binnen beeld',
  mapping: 'object-fit: cover, gecentreerd (50% 50%): scherm = offset + waarde × geschaalde beeldmaat (flows.coverTransform)'
};
const r4 = v => +v.toFixed(4);
const clip = b => { const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(1, b.x + b.w), y1 = Math.min(1, b.y + b.h); return { x: r4(x0), y: r4(y0), w: r4(Math.max(0, x1 - x0)), h: r4(Math.max(0, y1 - y0)), clipped: x0 !== b.x || y0 !== b.y || x1 !== b.x + b.w || y1 !== b.y + b.h }; };

// Minimale header-parsers (geen afhankelijkheden): afmetingen uit PNG/JPEG/WebP.
function dims(buf) {
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: buf[25] === 6 || buf[25] === 4 };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: 'image/jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), alpha: false };
      i += 2 + len;
    }
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const c = buf.toString('ascii', 12, 16);
    if (c === 'VP8 ') return { type: 'image/webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
    if (c === 'VP8L') { const b = buf.readUInt32LE(21); return { type: 'image/webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, alpha: !!((b >> 28) & 1) }; }
    if (c === 'VP8X') return { type: 'image/webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), alpha: !!(buf[20] & 0x10) };
  }
  throw new Error('onbekend beeldformaat');
}

function entry(file, rights) {
  const p = path.join(DIR, 'assets', file);
  const buf = fs.readFileSync(p);
  const d = dims(buf);
  return { file: 'assets/' + file, type: d.type, w: d.w, h: d.h, alpha: d.alpha, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), rights };
}

function build() {
  const render = JSON.parse(fs.readFileSync(path.join(__dirname, 'render-output.json'), 'utf8'));
  const rights = JSON.parse(fs.readFileSync(path.join(__dirname, 'rights.json'), 'utf8'));
  const compositions = {};
  for (const [name, c] of Object.entries(SCENE.compositions)) {
    const r = render.compositions[name];
    if (!r) throw new Error('geen render-output voor ' + name);
    compositions[name] = {
      minContainerWidth: c.minContainerWidth,
      natural: r.natural,
      budgetBytes: c.budgetBytes,
      base: c.base.map(f => entry(f, SCENE.rights)),
      masks: c.masks.map(([id, f]) => ({ id, semantics: 'alfa = voorgrond-occlusie (deeltjes en routelijnen verdwijnen erachter; UI-kaarten niet)', ...entry(f, SCENE.rights), bbox: (r.maskBoxes || {})[id] || null })),
      anchors: r.anchors,
      uiZones: c.uiZones,
      keyObjects: Object.fromEntries(Object.entries(r.boxes || {}).map(([k, b]) => [k, clip(b)]).filter(([, c]) => c.w > 0 && c.h > 0)),
      outOfView: Object.entries(r.boxes || {}).filter(([, b]) => { const c = clip(b); return !(c.w > 0 && c.h > 0); }).map(([k]) => k),
      protectedAreas: c.protected.map(pa => {
        const k = clip(r.boxes[pa.from]); const [l, t, rr, bb] = pa.inset;
        return { id: pa.id, from: pa.from, purpose: pa.purpose, x: r4(k.x + k.w * l), y: r4(k.y + k.h * t), w: r4(k.w * (1 - l - rr)), h: r4(k.h * (1 - t - bb)) };
      }),
      lightLayers: c.lightLayers
    };
  }
  const manifest = { schema: 'energiehuis.scene-manifest/2', coordinateSystem: COORDINATES, sceneId: SCENE.sceneId, status: SCENE.status, statusLabel: SCENE.statusLabel, compositions, rights };
  return '/* GEGENEREERD door tools/build-manifest.cjs — niet met de hand bewerken.\n' +
    ' * Energiehuis PVE-04 scènemanifest: beeldlagen, SHA-256, budgetten, maskers, ankerpunten en rechten.\n' +
    ' * Laadt als gewoon script (ook via file://), zonder netwerkverzoeken. */\n' +
    '(function (root) {\n  \'use strict\';\n  const MANIFEST = ' + JSON.stringify(manifest, null, 2).replace(/\n/g, '\n  ') + ';\n' +
    '  if (typeof module === \'object\' && module.exports) module.exports = MANIFEST;\n  else root.EhPve04Manifest = MANIFEST;\n' +
    '})(typeof globalThis !== \'undefined\' ? globalThis : this);\n';
}

const js = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== js) { console.error('FAIL: scene-manifest.js wijkt af van de bestanden; draai build-manifest.cjs'); process.exit(1); }
  console.log('PASS: scene-manifest.js komt exact overeen met assets, ankerpunten en rechten');
} else {
  fs.writeFileSync(OUT, js);
  console.log('scene-manifest.js geschreven');
}
module.exports = { dims };
