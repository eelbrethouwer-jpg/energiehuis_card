# Overdracht aan ChatGPT — PVE-04 stap 0, correctieronde

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie. De scènelaag blijft **placeholder, niet visueel goedgekeurd**. Fotorealisme blijft een harde eis voor stap 1.
Opgesteld door Claude Code, 9 november 2026. Reactie op de ChatGPT-review van `83d9cfc` (GO MET OPMERKINGEN).

## 1. Branch, baseline, commits, diff

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Verplichte uitgangs-HEAD | `83d9cfc9402275ba6dc680535eacd4c4f3653995` (gecontroleerd: remote = lokaal vóór aanvang) |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| Correcties | `c70b544` — manifest v2, validatie, performance, WebKit |
| HEAD na deze overdracht | de commit die dit bestand bijwerkt (direct na `c70b544`) |

Diff `83d9cfc..c70b544`: 32 bestanden, +1509 / −55, **uitsluitend `preview/pve-04/`**. De beeldbestanden zijn opnieuw gegenereerd en byte voor byte gecontroleerd: alle 10 zijn **identiek** (SHA-256 ongewijzigd). Alleen `tools/render-output.json` kreeg objectkaders en maskerkaders.

**Omgeving (geen repo-wijziging):**
- Er is een persoonlijke cloudomgeving "energiehuis_card" aangemaakt, met akkoord van de eigenaar via de goedkeuringsprompt. Die staat de Playwright-downloadhosts `cdn.playwright.dev` en `playwright.download.prss.microsoft.com` toe.
- Playwright WebKit 26.6 en de systeembibliotheken zijn in de container geïnstalleerd.
- `package.json`, lockfiles en dependencies zijn niet gewijzigd.

## 2. Correcties

### P1-A — Manifest v2 (v1 blijft geldig)
- **Coördinatenstelsel:** `coordinateSystem.id = "normalized-image"`: fracties 0..1 van de natuurlijke beeldmaat, oorsprong linksboven, x naar rechts, y naar beneden, omzetting via gecentreerde `object-fit: cover`.
- **`uiZones`:** per compositie zes zones waarin het kaartmidden moet liggen. Ze overlappen niet (getest).
- **`keyObjects`:** kaders voor woning, garage, auto, praktijk, panelen en wandlader, **geprojecteerd vanuit de 3D-scène**. Objecten volledig buiten beeld staan in `outOfView`; op mobiel is dat de wandlader.
- **`protectedAreas`:** dit vervangt de starre 10 %-grens. De herkenbare kern van auto, praktijkpui, panelen en dak/topgevel is beschermd, met marges per object. **Geen enkele kaart raakt een beschermd gebied** op 320, 390, 768, 1330 en 1440 px, in Chromium én WebKit.
- **`lightLayers`:** optioneel en uitbreidbaar. Extra velden zijn toegestaan; de runtime toont nu alleen trigger `always` en negeert onbekende triggers (getest met een testmanifest).
- **Maskerkaders** (`masks[].bbox`): berekend in de generator uit de maskerpixels.

### P1-B — Runtimevalidatie
- **Validator:** `manifest-validate.js` → `validateManifest(mf)` geeft `{ok, version, errors}` en **gooit nooit**; getest met een getter die gooit, met `null`, een getal en een array.
- **Wat er gecontroleerd wordt:**
  - schema v1/v2, status en `statusLabel`, rechten;
  - beide composities, en `natural` als positieve gehele getallen;
  - `base` niet leeg en met WebP en JPEG;
  - per beeld bestand, type, extensie, afmetingen, beeldverhouding, bytes, SHA-256 en rechten-ID;
  - per masker PNG, `alpha:true`, `semantics` en `id`;
  - **veilige paden** (alleen `assets/<naam>`; geen `..`, `/`, `//`, schema's of submappen);
  - de verplichte ankers als eindige getallen;
  - de v2-velden.
- **Runtime:** `app.js` valideert vóór het opbouwen. Bij een ongeldig manifest verschijnt "Scènemanifest ongeldig — alleen interface", worden scène en routes verborgen en blijven waarden en kaarten werken. Er treden geen excepties op, in Chromium noch WebKit.
- **Tests:** **25 negatieve tests** (er waren er minimaal 12 gevraagd). Daaronder: geen of lege `base`, geen JPEG, `natural` ontbrekend of 0, compositie ontbrekend, masker zonder `alpha` of `semantics` of als JPEG, `..`-pad, absolute URL, `javascript:`, pad buiten `assets/`, verkeerde extensie, ongeldige SHA-256, ontbrekend of NaN-anker, zone buiten beeld of ontbrekend, en een onbekende rechten-ID.

### P2-A — Performance
- **Oorzaak:** gemeten, niet aangenomen. De grootste kostenpost was de SVG-routelaag met masker, die elk frame opnieuw werd gerasterd omdat het canvas erboven veranderde. Daarnaast kostte het per frame herschalen van het volledige masker.
- **Oplossing:**
  1. maskeringsmodus `bbox` (standaard): het masker wordt één keer per resize voorgeschaald naar canvaspixels, en per frame snijdt `destination-out` alleen het maskerkader weg (~21 % van de desktopscène);
  2. `will-change: transform` geeft de SVG- en canvaslaag elk een eigen compositielaag.
- **Correctheid ongewijzigd:** de pixeltest blijft 0, de visuele SVG-test blijft 0, en reduced motion en routeveiligheid zijn ongewijzigd.
- **Meting** (`tests/perf.cjs --write` → `screenshots/perf.json`): Chromium headless, DPR 1, scenario praktijk-sim (4 routes), schommeling uit, 3 runs van 3 s per meting.

| Variant (desktop 1440×900) | 1× fps | 4× fps | p95 4× | Δ t.o.v. PVE-03 (4×) |
|---|---|---|---|---|
| PVE-03, geen masker (nulmeting) | 60,0 | 60,0 | 16,8 ms | — |
| PVE-04 `full` (methode vorige ronde) | 59,7 | **38,6** | 33,4 ms | −35,7 % |
| **PVE-04 `bbox` (standaard)** | 59,7 | **59,7** | **16,8 ms** | **−0,5 %** → **DOEL** |
| PVE-04 `css` (CSS mask-image) | 50,1 | 48,7 | 33,4 ms | −18,8 % |
| PVE-04 `bbox` zonder SVG-masker (diagnose) | 60,0 | 60,0 | 16,7 ms | 0 % |

Mobiel 390×844: alle varianten 60 fps bij 1× en 4×. Een eerdere meetrun vóór de compositielaag-fix gaf voor `bbox` 49,3 fps en p95 33,4 ms (WAARSCHUWING); die run toont waar de winst zit. De perftest geeft **WAARSCHUWING** bij 45–49 fps, **DOEL NIET GEHAALD** onder 45 en een **harde fout** onder 30 fps.

### P2-B — WebKit
- Dezelfde browsersuite draait in **Playwright-WebKit 26.6: 25/25**. Alleen de CDP-prestatiemeting is overgeslagen, omdat die alleen in Chromium bestaat.
- Er is een **visuele SVG-maskercontrole** bijgekomen: een screenshot met en zonder routelaag, vergeleken op punten op de route.

| Engine | Viewport | Routepunten onder masker zichtbaar | Vrije punten zichtbaar |
|---|---|---|---|
| Chromium | 1440 | 0/69 | 221/258 |
| Chromium | 390 | 0/61 | 166/262 |
| WebKit | 1440 | 0/70 | 258/258 |
| WebKit | 390 | 0/61 | 262/262 |

- De canvasmaskering laat in WebKit 0 deeltjespixels onder het masker zien. Terugval, validatie, toetsenbord, reduced motion en twee instanties slagen in WebKit. Via `file://` werken in beide engines scène, masker (`bbox`) en SVG-masker.
- **Beperkingen:**
  - Playwright-WebKit op Linux is niet gelijk aan Safari op iOS of macOS: andere GPU-paden, en `backdrop-filter` rendert in WebKit iets transparanter (zie `screenshots/compare-chromium-webkit.jpg`).
  - **Een echte iPhone-test blijft vereist.**
  - Voor de terugval is `?svgmask=0` beschikbaar; die zet alleen de lijnmaskering uit (visueel, geen datawijziging).

## 3. Testresultaten (lokaal; Node v22.23.4, Chromium 153.0.8010.12, WebKit 26.6)

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` / `node --check energiehuis-card.js` | PASS / PASS |
| Productie-Node UTC / Amsterdam | **359/359 / 359/359** |
| Productie-Chromium `mobile-visual`, `regisseur-cockpit`, `stroomvergelijker` | 3× PASS (stroomvergelijker zonder live tarieven) |
| **PVE-04 Node UTC / Amsterdam** | **70/70 / 70/70** (was 38) |
| **PVE-04 browser Chromium** | **25/25** (was 21) |
| **PVE-04 browser WebKit** | **25/25** (1 CDP-meting overgeslagen) |
| `tests/perf.cjs` | exit 0; standaardvariant DOEL op desktop en mobiel |
| `tools/build-manifest.cjs --check` | PASS |

Screenshots in `screenshots/`:
- Chromium en WebKit op 320, 390, 390 bij 200 % tekst, 768, 1330 en 1440 (`*-webkit.jpg` voor WebKit);
- `compare-chromium-webkit.jpg`, `mask-overlay-desktop.jpg` en `mask-overlay-mobile.jpg`;
- `metrics.json`, `metrics-webkit.json` en `perf.json`.

## 4. Productie ongewijzigd
- `git diff --name-only 83d9cfc..c70b544` bevat alleen `preview/pve-04/…`; `main` staat op `62fa09c`, en `preview/pve-03/` is ongewijzigd.
- De build-check is byte-identiek en de productietests en -suites zijn groen.

## 5. Stap 1 — ongewijzigd voorstel (NIET gestart; apart akkoord nodig)

Het voorstel is Blender Cycles lokaal op de GPU van de eigenaar, met twee camera's (2660×1496 en 1080×1920). Per camera komen er:
- de basisplaat;
- een occlusiemasker (Cryptomatte of holdout);
- **ankerpunten, `keyObjects` en maskerkaders**, met hetzelfde projectiescript als de placeholdergenerator; de vorm in `render-output.json` is nu vastgelegd;
- optioneel `lightLayers`.

Assets: CC0 (Poly Haven, ambientCG), eigen modellen van woning, garage en praktijk, en een gelicentieerd, niet-redactioneel EV-model of eigen foto's. Ruwe bestanden komen nooit op GitHub. Daarna werk ik `uiZones` en `protectedAreas` bij voor de nieuwe compositie, draai ik `build-manifest.cjs`, en blijven UI en tests gelijk.

Nodig van de eigenaar:
- welke GPU en welk besturingssysteem;
- budget en akkoord voor het automodel, of eigen foto's;
- wie modelleert;
- akkoord om de CC0-assets te downloaden.

Status `approved` komt pas na visueel akkoord van de eigenaar.

## 6. Open punten en risico's
- Er is geen test op een echte iPhone of in Safari op macOS.
- Fps zijn headless-metingen; een meting op een echte telefoon ontbreekt.
- De beschermde gebieden en zones zijn afgestemd op de placeholdercompositie en moeten bij stap 1 opnieuw worden vastgesteld; de tests dwingen dat af.
- De `css`-maskeringsvariant is niet als standaard gekozen: die is trager in software-rendering en niet pixelverifieerbaar via canvas-uitlezing.

## 7. Reviewvragen (read-only)
1. Zijn de beschermde gebieden (kern van auto, praktijkpui, panelen, dak/topgevel) de juiste interpretatie van "beschermde visuele gebieden"?
2. Is de semantiek van `lightLayers` (alleen `always` actief; andere triggers gereserveerd) voldoende als uitbreidingspunt?
3. Zijn de prestatiedoelen en de meetopzet (3 runs, 1× en 4×, nulmeting PVE-03) akkoord als vaste regressiecontrole?
