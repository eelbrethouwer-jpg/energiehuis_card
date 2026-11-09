# PVE-04 — Fotorealistische Premium Live Cockpit (stap 0: beeldinfrastructuur)

> **DEMO — fictieve meetwaarden.** Zelfstandige browserpreview zonder Home Assistant, zonder bediening en zonder opslag. Geen productiekaart, geen HACS-resource.
>
> **Tijdelijk beeld — niet visueel goedgekeurd.** De huidige scènelaag is de PVE-03-CGI, uitsluitend als placeholder. Fotorealisme is een harde acceptatie-eis voor de definitieve lagen (stap 1).

Branch `preview/claude-premium-pve04`, technische basis PVE-03 `cae8edf`. Alles staat in `preview/pve-04/`. Overdracht: [HANDOFF_TO_CHATGPT.md](HANDOFF_TO_CHATGPT.md) · Rechten: [ASSET_RIGHTS.md](ASSET_RIGHTS.md) · Visuele norm: [goedgekeurde referentie (PVE-03)](../pve-03/reference/APPROVED_VISUAL_REFERENCE.md).

![Desktop 1440×900](screenshots/pve04-1440x900.jpg)

## Starten

```sh
cd preview/pve-04
python3 -m http.server 8000      # open http://localhost:8000
```

Ook direct te openen als `index.html` (file://): manifest, beeldlagen en maskers laden zonder netwerk.
URL-opties: `?scenario=<id>`, `?ticker=0`, `?instances=2`, en de testhaak `?manifest=0` (simuleert een ontbrekend manifest).

## Architectuur

```
fotorealistische, tekstvrije beeldlaag (<picture>, WebP + JPEG, 1×/2×)     ← scene-manifest.js
  └ SVG-routelijnen + canvas-lichtdeeltjes (flows.js)                       ← model.js (routes, veiligheid)
      └ occlusiemasker (PNG, alfa = voorgrond): deeltjes/lijnen verdwijnen achter auto, struiken, paaltjes
  └ UI-kaarten, labels, waarden (app.js)  — altijd boven routes en maskers
```

| Bestand | Rol |
|---|---|
| `scene-manifest.js` | **Gegenereerd, schema v2.** Coördinatenstelsel `normalized-image`. Per compositie (desktop 16:9, mobiel 9:16): beeldlagen en maskers (type, afmetingen, bytes, SHA-256, maskerkader), budget, ankerpunten, `uiZones`, `keyObjects`, `protectedAreas`, optionele `lightLayers`; plus status en rechten. Puur data, laadt als script. |
| `manifest-validate.js` | Pure `validateManifest()`: gooit nooit, accepteert v1 en v2; de runtime bouwt de scène alleen bij een geldig manifest. |
| `ASSET_RIGHTS.md` | Rechtenregister met per asset de herkomst, licentie, bewijs en SHA-256, plus het sjabloon voor stap 1. |
| `.gitignore` | Blokkeert ruwe en betaalde bronbestanden (`.blend`, `.fbx`, `.glb`, `.exr`, `.hdr`, `.psd`, …). |
| `tools/build-manifest.cjs` | Bouwt het manifest uit de echte bestanden; `--check` faalt bij elke afwijking. |
| `tools/render-scene.cjs` + `tools/scene.html` | Generator voor de **placeholder**-laag en de occlusiemaskers. Niet de stap-1-pipeline. |
| `tools/rights.json`, `tools/render-output.json` | Bron voor de rechten en de ankerpunten van het manifest. |
| `model.js`, `flows.js`, `app.js`, `styles.css`, `index.html` | Uit PVE-03; `app.js` leest nu het manifest en `flows.js` ondersteunt maskers. |

### Terugvalgedrag

| Situatie | Gedrag |
|---|---|
| Manifest ontbreekt | Melding "Scènelaag ontbreekt — alleen interface"; geen scène of routes; kaarten en waarden werken volledig |
| Beeldlaag laadt niet | Melding "Beeldlaag kon niet laden — alleen interface"; scène en routes verborgen |
| Manifest ongeldig | Melding "Scènemanifest ongeldig — alleen interface"; geen scène of routes; interface volledig |
| Masker laadt niet | Scène en routes blijven; deeltjes worden niet gemaskeerd (alleen visueel, nooit een datawijziging) |
| Status `placeholder` | Permanente melding "Tijdelijk beeld — niet visueel goedgekeurd" |

## Placeholder-generator en manifest bijwerken

```sh
npm install --prefix /tmp/pve04-three three@0.170.0
THREE_DIR=/tmp/pve04-three/node_modules/three node preview/pve-04/tools/render-scene.cjs
node preview/pve-04/tools/build-manifest.cjs
```

Bij stap 1 vervangen de Blender-renders de bestanden. Daarna worden `tools/render-output.json` (ankerpunten), `tools/rights.json` en het `SCENE`-blok in `build-manifest.cjs` bijgewerkt en het manifest opnieuw gebouwd. De UI en de tests blijven gelijk.

## Privébeeldlaag (stap 1A: clean plate van de goedgekeurde master)

De fotorealistische basislaag wordt een **clean plate** van de goedgekeurde master: zonder kaarten, tekst, logo's, kenteken en stromen. Die laag is **privé** en komt nooit in deze publieke repository. De volledige workflow, analyse en criteria staan in [cleanplate/CLEANPLATE.md](cleanplate/CLEANPLATE.md).

```sh
python3 preview/pve-04/tools/cleanplate.py all                      # masker, draft, QA, overzicht → private/cleanplate/
node preview/pve-04/tools/build-manifest.cjs --private preview/pve-04/private/<map>
# open index.html?scene=private&privateManifest=private/<map>/scene-manifest.private.js
```

- `?scene=private` laadt een privémanifest (standaard `private/scene-manifest.private.js`; in Home Assistant `/local/energiehuis/pve04/…`). Alleen same-origin `.js`-paden onder `private/` of `/local/` worden geaccepteerd.
- Per compositie geldt: privélaag aanwezig ⇒ "Privébeeldlaag (concept) — niet visueel goedgekeurd"; geen privélaag voor die weergave ⇒ terugval op de placeholder, met melding. Een ontbrekend, ongeldig of onveilig manifest ⇒ placeholder, zonder fouten.
- `private/` staat in `.gitignore`. De tools weigeren output elders, en de validator eist `publicAllowed: false` voor privé-assets.

## Coördinaten, zones en beschermde gebieden (v2)

- **Coördinaten:** alles in fracties (0..1) van de natuurlijke beeldmaat, met de oorsprong linksboven, x naar rechts en y naar beneden. Op het scherm via `object-fit: cover`, gecentreerd (`flows.coverTransform`).
- **`uiZones`:** per kaart een gebied waarin het midden van die kaart moet liggen. Zones overlappen onderling niet.
- **`keyObjects`:** kaders van woning, garage, auto, praktijk, panelen en wandlader, geprojecteerd vanuit de 3D-scène. Objecten volledig buiten beeld staan in `outOfView`.
- **`protectedAreas`:** de herkenbare kern van auto, praktijkpui, panelen en dak/topgevel (een kader minus marges per object). **Geen kaart mag een beschermd gebied raken**; dit wordt getest op 320, 390, 768, 1330 en 1440 px.
- **`lightLayers`:** optioneel. Nu wordt alleen trigger `always` getoond; andere triggers zijn voor later en worden genegeerd. Extra velden breken niets.

## Prestaties en maskeringsmodus

Standaard is de modus `bbox`: het masker wordt per resize één keer voorgeschaald, en per frame wordt alleen het maskerkader weggesneden. De SVG-routelaag heeft een eigen compositielaag. Alternatieven voor metingen: `?maskmode=full|css` en `?svgmask=0`. Meten:

```sh
node preview/pve-04/tests/perf.cjs --write     # PVE-03 vs PVE-04-varianten, 3 runs, 1× en 4× CPU
```

Doel bij 4×: ≥ 50 fps en p95 ≤ 33 ms (45–49 fps = waarschuwing, < 45 = doel niet gehaald, < 30 = harde fout). Laatste resultaten: `screenshots/perf.json`.

## Tests

```sh
TZ=UTC node --test preview/pve-04/tests/*.test.cjs
TZ=Europe/Amsterdam node --test preview/pve-04/tests/*.test.cjs
node preview/pve-04/tests/browser.cjs --screenshots                   # Chromium
node preview/pve-04/tests/browser.cjs --browser=webkit --screenshots  # WebKit (Playwright)
node preview/pve-04/tests/perf.cjs --write
```

- **Node (79 tests):** model en veiligheid, routes, manifest (actualiteit, hashes, afmetingen, budgetten, rechten, ruwe bestanden, ankerpunten, geen netwerk), plus manifest v2 en de validator: v1-compatibiliteit, lichtlagen, **25 negatieve gevallen**, padveiligheid, geometrie van zones en beschermde gebieden, en de responsieve omzetting; plus de clean-plate- en privacytests (overlay-map, geen getrackte privébestanden, weigering van output buiten `private/`, privémanifest, veilige URL's).
- **Browser (26 controles, Chromium én WebKit):** o.a. het laden van de privélaag via een synthetische testlaag, met mobiele terugval en terugval bij een ontbrekend of onveilig manifest; viewports, 200 % tekst, scenario's, 50 hertekeningen, stilstaande deeltjes, EV/minteken/overgangen, maskers (pixelmeting), placeholder, terugval, validatie in de browser, beschermde gebieden en zones op 5 breedtes, **visuele SVG-maskercontrole** (screenshotvergelijking), toetsenbord, reduced motion, verborgen tab, twee instanties en performance (alleen Chromium/CDP).

## Beperkingen

- De scènelaag is een **placeholder** (CGI) en geen visueel eindbeeld.
- Getest in Chromium 153 en Playwright-WebKit 26.6 (Linux, headless). **Echte Safari op iPhone/macOS is niet getest** en blijft vereist vóór acceptatie.
- Fps-metingen zijn headless-metingen en geen meting op een echt toestel.
