# PVE-03 — Cinematic Energy Experience (DEMO)

> **DEMO — fictieve meetwaarden.** Zelfstandige browserpreview. Geen Home Assistant-verbinding, geen bediening, geen opslag, geen productiekaart, geen HACS-resource.

Fase 1 van de Premium Live Cockpit, gebouwd door Claude Code op branch `preview/claude-premium-pve03`.
Opdracht: [CLAUDE_CODE_OPDRACHT.md](CLAUDE_CODE_OPDRACHT.md) · Overdracht: [HANDOFF_TO_CHATGPT.md](HANDOFF_TO_CHATGPT.md)
Baseline `main`: `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9`.

![Desktop 1440×900](screenshots/pve03-1440x900.jpg)

## Starten

```sh
cd preview/pve-03
python3 -m http.server 8000
# open http://localhost:8000
```

Direct openen van `index.html` (file://) werkt ook: er zijn geen modules, geen build en geen netwerkverzoeken.
URL-opties: `?scenario=<id>` (zie `model.js` → `SCENARIOS`), `?ticker=0` (geen schommeling), `?instances=2` (twee gelijktijdige cockpits).

## Opbouw

| Bestand | Rol |
|---|---|
| `index.html` | Startpagina met permanente DEMO-aanduiding; mount één of meer cockpits |
| `styles.css` | Design tokens, glaspanelen, desktop- (16:9) en eigen mobiele (9:16) compositie, tablet, 200 % tekst, reduced motion |
| `model.js` | Pure DEMO-logica + 12 fixturescenario's. Leest HA-achtige state-objecten (waarde, eenheid, tijdstempel) maar maakt **geen** verbinding |
| `flows.js` | Routegeometrie (pure functies) + SVG-routes en canvas-lichtdeeltjes |
| `app.js` | Cockpit: DOM één keer opbouwen, daarna alleen tekst/attributen patchen; detailpaneel, toetsenbord, lifecycle |
| `assets/` | Tekstvrije scènelagen (WebP + JPEG-fallback) en `scene-anchors.js` (objectposities per compositie) |
| `tools/` | Offline scènegenerator (three.js, alleen build-tool, niet nodig om de preview te draaien) |
| `tests/` | Node-tests (`*.test.cjs`) en Playwright-browsertest (`browser.cjs`) |
| `screenshots/` | Screenshots per viewport (DPR 2) + `metrics.json` |
| `reference/` | Ongewijzigde F2-bron (byte-identiek, SHA-256 gecontroleerd in de tests) |

## Route-contract (DEMO)

| Route | Kleur | Wanneer actief |
|---|---|---|
| Zon → huis | goud `#FFC23D` | PV actueel en ≥ 30 W |
| Net → huis | warm oranje `#FF8A5B` | P1 actueel, afname ≥ 80 W (dode band 40–80 W houdt alleen dezelfde richting vast) |
| Huis → net | groen `#4BE38A` | P1 actueel, teruglevering ≥ 80 W |
| Huis → Cupra | cyaan `#33DDFF` | laadvermogen actueel en ≥ 30 W |
| Huis → praktijk | turkoois, gestippeld | **alleen** in het scenario "Praktijk (simulatie)", gelabeld SIMULATIE; standaard "Nog niet gekoppeld", geen kW |
| Virtuele batterij | paars, alleen tegel | **nooit** een route: simulatie, geen fysieke opslag |

Veiligheidsregels in `model.js`:
- **Geen grace-periode.** Ontbrekend, verouderd (> 60 s), onbekende eenheid of ongeldig ⇒ route direct `active: false`. Alleen de weergave dooft passief uit. De F2-semantiek `graceMs: 10000` is bewust niet overgenomen.
- Offline ⇒ geen routes en geen waarden.
- Negatieve huissensor of een balans die > 150 W afwijkt ⇒ "Controle nodig", alle routes stil.
- P1-tekenomkering: corrigeerbaar via configuratie (`p1Sign: 'export_positive'`); een foute configuratie wordt via de balans gedetecteerd en stopt alle routes.
- Een sluitende balans wordt getoond als "rekenkundig, niet geverifieerd". Er zijn geen verificatievlaggen.

## Beeldlagen: herkomst, afmetingen, gewicht

Alle beeldlagen zijn **eigen renders** van een procedureel opgebouwde 3D-scène (`tools/scene.html`). Er zijn geen foto's, logo's, merkbadges of 3D-modellen van derden gebruikt. Alle texturen (gevelstuc, baksteen, dakpannen, hout, bestrating, gras, zonnecellen, interieurlicht) worden met canvas en een vaste seed gegenereerd. Renderer: three.js 0.170.0 (MIT), alleen tijdens het genereren. De auto is een generieke, ongebadgede compacte EV-hatchback in knalgroen; het is geen exacte replica van de Cupra Born.

| Bestand | Afmeting | Bytes |
|---|---|---|
| `scene-desktop-2660.webp` / `.jpg` | 2660×1496 | 96 764 / 274 039 |
| `scene-desktop-1330.webp` / `.jpg` | 1330×748 | 33 584 / 83 464 |
| `scene-mobile-1080.webp` / `.jpg` | 1080×1920 | 43 152 / 130 057 |
| `scene-mobile-540.webp` / `.jpg` | 540×960 | 15 598 / 37 640 |

Startweergave (gemeten via de testserver, DPR 1): desktop 94,5 KiB, mobiel 42,1 KiB. Het budget is 1,5 MB / 1 MB. WebP q0,80, JPEG q0,82. `srcset` + `sizes` op de werkelijke scènebreedte kiest de 1×- of 2×-laag.

Opnieuw genereren:

```sh
npm install --prefix /tmp/pve03-three three@0.170.0
THREE_DIR=/tmp/pve03-three/node_modules/three node preview/pve-03/tools/render-scene.cjs
```

**Visuele norm:** de door de eigenaar goedgekeurde fotorealistische afbeelding (`image(20261109-092713).png`) stond niet in deze sessie of op GitHub. Er is dus geen pixelvergelijking gedaan. De scène is gebouwd naar de beschrijving in de opdracht.

## Tests

```sh
# Node (model, routes, veiligheid, assets, F2-hash)
TZ=UTC node --test preview/pve-03/tests/*.test.cjs
TZ=Europe/Amsterdam node --test preview/pve-03/tests/*.test.cjs
# Browser (Playwright + Chromium); --screenshots schrijft screenshots/ en metrics.json
node preview/pve-03/tests/browser.cjs --screenshots
```

De laatste resultaten staan in [HANDOFF_TO_CHATGPT.md](HANDOFF_TO_CHATGPT.md).

## Screenshots

| Viewport | Bestand |
|---|---|
| Desktop 1440×900 | [pve03-1440x900.jpg](screenshots/pve03-1440x900.jpg) |
| Desktop 1330×748 | [pve03-1330x748.jpg](screenshots/pve03-1330x748.jpg) |
| Tablet 768×1024 | [pve03-768x1024.jpg](screenshots/pve03-768x1024.jpg) |
| Mobiel 390×844 | [pve03-390x844.jpg](screenshots/pve03-390x844.jpg) |
| Mobiel 390×844, 200 % tekst | [pve03-390x844-tekst200.jpg](screenshots/pve03-390x844-tekst200.jpg) |
| Mobiel 320×700 | [pve03-320x700.jpg](screenshots/pve03-320x700.jpg) |
| Vergelijking PVE-01 (`7f04771`), 1330×748 | [compare-pve01-1330x748.jpg](screenshots/compare-pve01-1330x748.jpg) |

## Beperkingen

- **DEMO.** Geen LIVE-modus, geen HA-koppeling en geen verificatie van de meetketen (P1, GoodWe AC, Alfen, huissensor).
- Het is een eigen 3D-render, geen foto: de beelden ogen realistisch, maar zijn niet fotorealistisch. Er is geen vergelijking gemaakt met de goedgekeurde referentiefoto.
- Op tablet 768 px valt de Cupra grotendeels achter de Cupra-tegel.
- Alleen getest in Chromium 153 (headless). **Safari/WebKit en een echte iPhone zijn niet getest.**
