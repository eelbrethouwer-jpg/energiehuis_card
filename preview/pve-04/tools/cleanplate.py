#!/usr/bin/env python3
"""Energiehuis PVE-04 — clean-plate workflow (stap 1A), gratis en lokaal.

Maakt van de goedgekeurde master-afbeelding een TEKSTVRIJE basislaag: ingebakken kaarten, tekst, logo's,
kenteken en energiestromen worden verwijderd. Deze tool levert de technische keten:

  mask   overlay-map.json  ->  overlay-masker (wit = verwijderen), met marge voor gloed
  draft  master + masker   ->  automatische eerste versie (OpenCV-inpainting, alleen als startpunt)
  qa     master + kandidaat -> per overlay: restanten van UI/tekst, vlakheid t.o.v. de omgeving, status
  sheet  overzichtsblad: master | masker | kandidaat | QA

De definitieve clean plate ontstaat door retouche met gratis software (zie README): de 'draft' is
uitdrukkelijk GEEN eindbeeld. 'qa' kan ook op een handmatig of extern geretoucheerde kandidaat draaien.

PRIVACY: alle beeldoutput gaat standaard naar preview/pve-04/private/ (in .gitignore, nooit op GitHub).
Schrijven buiten private/ wordt geweigerd.

Vereisten (gratis): python3, numpy, pillow, opencv-python-headless.
  python3 preview/pve-04/tools/cleanplate.py all
  python3 preview/pve-04/tools/cleanplate.py qa --candidate private/cleanplate/mijn-retouche.png
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PVE04 = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PVE04))
PRIVATE = os.path.join(PVE04, 'private')
MAP = os.path.join(PVE04, 'cleanplate', 'overlay-map.json')


def private_path(p):
    """Elke beeldoutput moet binnen preview/pve-04/private/ blijven."""
    ap = os.path.abspath(p)
    if not (ap == PRIVATE or ap.startswith(PRIVATE + os.sep)):
        sys.exit(f'Weigering: {p} ligt buiten {os.path.relpath(PRIVATE, REPO)}/ (privébeeld hoort niet in de publieke repo).')
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    return ap


def load_map():
    with open(MAP, encoding='utf-8') as f:
        return json.load(f)


def overlay_mask(m, w, h, grow=6, only=None):
    """Rasteriseert de overlay-map naar een masker (uint8, 255 = verwijderen)."""
    img = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(img)
    for o in m['overlays']:
        if only and o['id'] != only:
            continue
        if o['shape'] == 'rect':
            x0, y0 = o['x'] * w - grow, o['y'] * h - grow
            d.rounded_rectangle([x0, y0, x0 + o['w'] * w + 2 * grow, y0 + o['h'] * h + 2 * grow], radius=14, fill=255)
        else:
            pts = [(x * w, y * h) for x, y in o['points']]
            lw = max(2, int(o['width'] * w + 2 * grow))
            d.line(pts, fill=255, width=lw, joint='curve')
            for p in pts:
                d.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2], fill=255)
    return np.array(img)


def region_stats(gray, region, ring):
    """Laplace-energie (detail) binnen het gebied t.o.v. een ring eromheen."""
    import cv2
    lap = np.abs(cv2.Laplacian(gray.astype(np.float32), cv2.CV_32F, ksize=3))
    inner = float(lap[region > 0].mean()) if region.any() else 0.0
    outer = float(lap[ring > 0].mean()) if ring.any() else 1.0
    return inner, outer


def ui_residue(rgb, region):
    """Restanten van UI: bijna-witte, onverzadigde tekstpixels en lichtgevende lijnkleuren (cyaan/neon)."""
    import cv2
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    hch = hsv[..., 0].astype(int)
    text = (v > 225) & (s < 40)
    cyan = (hch > 80) & (hch < 100) & (s > 120) & (v > 170)
    px = region > 0
    n = max(1, int(px.sum()))
    return float((text & px).sum()) / n, float((cyan & px).sum()) / n


def cmd_mask(a):
    m = load_map()
    w, h = m['master']['w'], m['master']['h']
    mk = overlay_mask(m, w, h, a.grow)
    out = private_path(os.path.join(a.out, 'overlay-mask.png'))
    Image.fromarray(mk).save(out)
    print(f'masker: {os.path.relpath(out, REPO)}  ({mk.mean() / 2.55:.1f}% van het beeld te verwijderen)')
    return mk


def cmd_draft(a):
    import cv2
    m = load_map()
    src = np.array(Image.open(os.path.join(REPO, a.master)).convert('RGB'))
    h, w = src.shape[:2]
    mk = overlay_mask(m, w, h, a.grow)
    bgr = cv2.cvtColor(src, cv2.COLOR_RGB2BGR)
    # twee schalen: grof vullen (structuur), daarna fijn (randen) — nog steeds alleen een startpunt
    small = cv2.resize(bgr, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    msmall = cv2.resize(mk, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
    coarse = cv2.inpaint(small, msmall, 9, cv2.INPAINT_TELEA)
    up = cv2.resize(coarse, (w, h), interpolation=cv2.INTER_CUBIC)
    seed = bgr.copy(); seed[mk > 0] = up[mk > 0]
    fine = cv2.inpaint(seed, cv2.dilate(mk, np.ones((3, 3), np.uint8)) & cv2.erode(mk, np.ones((9, 9), np.uint8)) * 0 + mk, 5, cv2.INPAINT_TELEA)
    out = private_path(os.path.join(a.out, 'draft-cleanplate.png'))
    Image.fromarray(cv2.cvtColor(fine, cv2.COLOR_BGR2RGB)).save(out)
    print(f'draft: {os.path.relpath(out, REPO)}  (automatische eerste versie — GEEN eindbeeld)')


def cmd_qa(a):
    import cv2
    m = load_map()
    cand_path = a.candidate or os.path.join(a.out, 'draft-cleanplate.png')
    cand = np.array(Image.open(cand_path if os.path.isabs(cand_path) else os.path.join(REPO, cand_path)).convert('RGB'))
    h, w = cand.shape[:2]
    if (w, h) != (m['master']['w'], m['master']['h']):
        sys.exit(f'Kandidaat {w}x{h} wijkt af van master {m["master"]["w"]}x{m["master"]["h"]}')
    gray = cv2.cvtColor(cand, cv2.COLOR_RGB2GRAY)
    rows, worst = [], 'OK'
    for o in m['overlays']:
        reg = overlay_mask(m, w, h, 2, only=o['id'])
        ring = cv2.dilate(reg, np.ones((25, 25), np.uint8)) & ~cv2.dilate(reg, np.ones((7, 7), np.uint8))
        inner, outer = region_stats(gray, reg, ring)
        detail = inner / outer if outer > 1e-6 else 0
        text_frac, cyan_frac = ui_residue(cand, reg)
        status = 'OK'
        if text_frac > 0.004 or cyan_frac > 0.004: status = 'RESTANT'
        elif detail < 0.45: status = 'TE VLAK'
        elif detail < 0.7: status = 'CONTROLEREN'
        rank = ['OK', 'CONTROLEREN', 'TE VLAK', 'RESTANT']
        if rank.index(status) > rank.index(worst): worst = status
        rows.append({'id': o['id'], 'kind': o['kind'], 'difficulty': o['difficulty'], 'method': o['method'], 'detailRatio': round(detail, 2), 'uiTextResidue': round(text_frac, 4), 'neonResidue': round(cyan_frac, 4), 'status': status})
    report = {'candidate': os.path.basename(cand_path), 'size': [w, h], 'overall': worst, 'regions': rows,
              'legend': {'detailRatio': 'detail (Laplace) binnen het gebied / ring eromheen; < 0,45 = te vlak (typisch automatische inpainting)',
                         'uiTextResidue': 'aandeel bijna-witte onverzadigde pixels (tekstrest)', 'neonResidue': 'aandeel cyaan-neon pixels (stroomlijnrest)'}}
    out = private_path(os.path.join(a.out, 'qa-report.json'))
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f'QA {report["overall"]}: ' + ', '.join(f"{r['id']}={r['status']}" for r in rows))
    print(f'rapport: {os.path.relpath(out, REPO)}')
    return report


def cmd_sheet(a):
    m = load_map()
    master = Image.open(os.path.join(REPO, a.master)).convert('RGB')
    w, h = master.size
    mk = Image.fromarray(overlay_mask(m, w, h, a.grow))
    red = Image.new('RGB', (w, h), (255, 40, 90))
    over = master.copy(); over.paste(red, mask=mk.point(lambda v: int(v * 0.55)))
    cand = Image.open(a.candidate if a.candidate else os.path.join(a.out, 'draft-cleanplate.png')).convert('RGB')
    qa = cand.copy()
    rep_path = os.path.join(a.out, 'qa-report.json')
    if os.path.exists(rep_path):
        rep = json.load(open(rep_path, encoding='utf-8'))
        col = {'OK': (60, 220, 120), 'CONTROLEREN': (255, 200, 60), 'TE VLAK': (255, 120, 40), 'RESTANT': (255, 40, 60)}
        d = ImageDraw.Draw(qa)
        for r in rep['regions']:
            o = next(x for x in m['overlays'] if x['id'] == r['id'])
            if o['shape'] == 'rect':
                d.rectangle([o['x'] * w, o['y'] * h, (o['x'] + o['w']) * w, (o['y'] + o['h']) * h], outline=col[r['status']], width=3)
            else:
                d.line([(x * w, y * h) for x, y in o['points']], fill=col[r['status']], width=3)
    sheet = Image.new('RGB', (w * 2 + 12, h * 2 + 12), (10, 12, 18))
    for i, im in enumerate([master, over, cand, qa]):
        sheet.paste(im, ((i % 2) * (w + 12), (i // 2) * (h + 12)))
    out = private_path(os.path.join(a.out, 'cleanplate-sheet.jpg'))
    sheet.save(out, quality=85)
    print(f'overzicht: {os.path.relpath(out, REPO)}')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('command', choices=['mask', 'draft', 'qa', 'sheet', 'all'])
    p.add_argument('--master', default='preview/pve-03/reference/approved-visual-20261109.webp', help='pad t.o.v. de repository (of het originele PNG buiten de repo)')
    p.add_argument('--candidate', help='geretoucheerde kandidaat voor qa/sheet (standaard de draft)')
    p.add_argument('--out', default=os.path.join(PRIVATE, 'cleanplate'))
    p.add_argument('--grow', type=int, default=6, help='extra marge rond overlays (px) voor gloed/schaduw')
    a = p.parse_args()
    if a.command in ('mask', 'all'): cmd_mask(a)
    if a.command in ('draft', 'all'): cmd_draft(a)
    if a.command in ('qa', 'all'): cmd_qa(a)
    if a.command in ('sheet', 'all'): cmd_sheet(a)


if __name__ == '__main__':
    main()
