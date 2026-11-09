# Overdracht aan ChatGPT — PVE-04 stap 0 (beeldinfrastructuur)

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie. De scènelaag is een **placeholder** en is **niet visueel goedgekeurd**.
Opgesteld door Claude Code, 9 november 2026.

## 1. Branch, baseline, commits, diff

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` (nieuw, vanaf `cae8edf`) |
| Technische basis | PVE-03 `cae8edf7d087fb4d285430a00d3a9b88866145c7` |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| Implementatie stap 0 | `180f1bd` |
| HEAD na deze overdracht | de commit die dit bestand toevoegt (direct na `180f1bd`) |

Diff `cae8edf..180f1bd`: 37 bestanden, **+3293 / −0, uitsluitend nieuwe bestanden in `preview/pve-04/`**. `preview/pve-03/` en alle productiebestanden zijn ongewijzigd (`git diff --stat cae8edf -- . ':!preview/pve-04'` is leeg).

## 2. Implementatie

| Eis stap 0 | Uitvoering |
|---|---|
| Assetmanifest met SHA-256 en herkomst | `scene-manifest.js`, gegenereerd door `tools/build-manifest.cjs` uit de echte bestanden: type, afmetingen, alfa, bytes, SHA-256, rechten-ID, budget, ankerpunten, status. `--check` faalt bij elk gewijzigd byte (gecontroleerd met een tijdelijke manipulatie). |
| Licentiebewijs per asset | `ASSET_RIGHTS.md` + `tools/rights.json`; verplichte velden; tests eisen een rechtenregel en de SHA-256 in `ASSET_RIGHTS.md` per asset. |
| Geen betaalde ruwe modellen op GitHub | `preview/pve-04/.gitignore` blokkeert o.a. `.blend .fbx .obj .glb .gltf .usd* .exr .hdr .psd .zip`; een test faalt op elk zo'n bestand en op elk ongeregistreerd bestand in `assets/` (beide getest met een tijdelijk bestand). |
| Desktop- en mobiele ankerpunten en maskers | Per compositie in het manifest; occlusiemaskers `mask-desktop-1330.png` en `mask-mobile-540.png` (alfa = voorgrond: auto + laadkabel, hortensia's, haag, potten, paaltjes), gegenereerd in dezelfde render als de placeholderlaag en dus pixelgenauw. |
| Deeltjes achter objecten, niet achter UI | Canvas: `destination-out` met het masker; SVG-routelijnen: `<mask>` met geïnverteerd masker. Kaarten liggen in een hogere laag (z-index 2 > 1). |
| Manifest lokaal zonder netwerk | Gewoon `<script>` met data; werkt via `http.server` én `file://`. Test: geen fetch/XHR/import/URL's, alleen relatieve paden. |
| Fallbackgedrag | Geen manifest ⇒ "Scènelaag ontbreekt — alleen interface"; beeldlaag kapot ⇒ "Beeldlaag kon niet laden — alleen interface"; masker kapot ⇒ geen maskering (alleen visueel). Status `placeholder` ⇒ permanente melding "Tijdelijk beeld — niet visueel goedgekeurd". |
| Assetbudgetten | Desktop ≤ 1,5 MB, mobiel ≤ 1 MB (grootste startlaag + maskers, ook voor de JPEG-terugval). Nu: desktop 133 000 + 41 420 B, mobiel 63 054 + 22 418 B. |
| Ontwerpbesluiten | Virtuele batterij **linksonder** (desktop), Cupra-kaart bij de auto, routekleuren volgens het contract. |
| Geen wijziging productie/meetveiligheid | `model.js` ongewijzigd t.o.v. PVE-03 (alleen globale naam `EhPve04Model`); geen HA, geen opslag, geen laadbediening. |

## 3. Testresultaten (lokaal, Node v22.23.4, Chromium 153.0.8010.12)

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` | PASS (bundel byte-identiek, SHA-256 `9f4fce00…6388`) |
| `node --check energiehuis-card.js` | PASS |
| Productie-Node UTC / Europe/Amsterdam | **359/359** / **359/359** |
| Productie-Chromium: `mobile-visual`, `regisseur-cockpit`, `stroomvergelijker` | 3× PASS (stroomvergelijker zonder live tarieven) |
| PVE-03 Node UTC / Amsterdam (ter controle, ongewijzigd) | 30/30 / 30/30 |
| **PVE-04 Node UTC / Amsterdam** | **38/38 / 38/38** |
| **PVE-04 browser** (`tests/browser.cjs --screenshots`) | **21/21 PASS** |
| `tools/build-manifest.cjs --check` | PASS |

Maskertest (pixelmeting over 24 frames):

| Compositie | Deeltjespixels onder masker | Zichtbaar buiten masker | EV-route door masker |
|---|---|---|---|
| Desktop 1440 | **0** | 60 734 | 23 meetpunten |
| Mobiel 390 | **0** | 63 562 | 29 meetpunten |

Verder bevestigd: het SVG-masker ligt exact op de canvasrechthoek, en `elementFromPoint` geeft voor elke kaart de kaart zelf terug.
Performance: ~55 fps (1×), ~39 fps onder 4× CPU-throttling (PVE-03 zonder masker: ~58). Heap 1,47 MB.

Screenshots (DPR 2): `pve04-320x700`, `pve04-390x844`, `pve04-390x844-tekst200`, `pve04-768x1024`, `pve04-1330x748`, `pve04-1440x900`, plus `mask-overlay-desktop` en `mask-overlay-mobile`.

## 4. Bewijs dat productie ongewijzigd is

- `git diff --stat cae8edf..HEAD -- . ':!preview/pve-04'`: leeg; `cae8edf` heeft t.o.v. `main` alleen `preview/pve-03/`-wijzigingen.
- Build-check byte-identiek; productietests 359/359 in beide tijdzones; 3 productie-Chromium-suites groen.

## 5. Voorstel stap 1 — fotorealistische scène (NIET gestart; vraagt apart akkoord)

**Pipeline:** Blender (LTS) met Cycles, lokaal op de GPU van de eigenaar. De voorkeur gaat naar NVIDIA RTX met OptiX en ruisonderdrukking; AMD HIP, Apple Metal of Intel oneAPI kunnen ook. Eén `.blend`-scène met twee camera's: desktop 2660×1496 en mobiel 1080×1920. Per camera worden gerenderd:
1. de basisplaat (tekstvrij, met Filmic/AgX-kleurbeheer);
2. een occlusiemasker via een Cryptomatte- of holdout-pass van de voorgrondobjecten;
3. de ankerpunten, met een klein Python-script dat de 3D-punten (panelen, voordeur, laadklep, praktijkdeur, wandlader) via de camera projecteert naar `render-output.json`;
4. optioneel lichtlagen (praktijk aan/uit, laadpaal-led).

Daarna draait `build-manifest.cjs`; de UI en de tests blijven gelijk.

**Benodigde assets en voorgestelde herkomst:**

| Onderdeel | Bron (voorkeur) | Licentie | Aandachtspunt |
|---|---|---|---|
| Lucht/belichting zonsondergang | Poly Haven HDRI | CC0 | — |
| Materialen gevel, dak, hout, klinkers, gras | Poly Haven / ambientCG | CC0 | — |
| Bomen, struiken, hortensia's | Poly Haven-scans (CC0) of commerciële bibliotheek | CC0 / per product | licentietekst vastleggen |
| Woning, garage, praktijk | Eigen modellering naar foto's en maten van de eigenaar | eigen werk | maatvoering van de eigenaar |
| Groene EV (Born-lookalike) | Gekocht model met niet-redactionele licentie die aanpassen toestaat, **of** eigen lookalike | per product | geen "Editorial Use"; logo en kenteken verwijderen; niets kopen zonder akkoord |
| Aanvullend (pipeline B) | Eigen avondfoto's (beplanting, auto) | eigen rechten | kenteken en huisnummer retoucheren |

**Rechten:** per asset een regel in `rights.json` en `ASSET_RIGHTS.md` met ordernummer en datum. Licentiedocumenten blijven privé bij de eigenaar. Ruwe bestanden blijven buiten GitHub (afgedwongen door `.gitignore` en een test); alleen de tekstvrije renders worden gecommit.

**Acceptatie:** één vergelijkingsblad met (1) de referentie, (2) de desktoprender, (3) de mobiele render en (4) de volledige cockpit. Elk scoort 1–5 op fotorealisme, architectuur, auto, licht, beplanting, materialen, compositie, leesbaarheid van de UI en mobiele kwaliteit. De status `approved` komt pas na visueel akkoord van de eigenaar.

**Beslissingen nodig voor stap 1:** de GPU en het besturingssysteem van de eigenaar en het akkoord op een lokale Blender-installatie; budget en akkoord voor het automodel (of eigen foto's); wie modelleert (eigenaar, Claude via scripts lokaal, of een externe 3D-artiest); en akkoord op het downloaden van CC0-assets.

## 6. Risico's en open punten

- De placeholderlaag blijft CGI. Het fotorealisme is pas na stap 1 te beoordelen.
- Het maskeren kost ~20 fps onder zware CPU-throttling. Optimalisatie is mogelijk (een vooraf geschaald masker en `willReadFrequently` alleen in de tests) als het op echte telefoons merkbaar is.
- Safari/WebKit en echte apparaten zijn niet getest; `<mask>` met `<image>` in SVG werkt in Chromium, maar is op iOS niet geverifieerd.
- De globale namen zijn hernoemd naar `EhPve04*`. PVE-03 is volledig intact en los te gebruiken.

## 7. Reviewvragen (read-only)

1. Dekt het manifestschema (`energiehuis.scene-manifest/1`) alles wat stap 1 nodig heeft (maskers, lichtlagen, vrije kaartzones)?
2. Zijn de verplichte rechtenvelden en de `.gitignore`-blokkade voldoende voor betaalde modellen?
3. Is het terugvalgedrag (scène verbergen bij ontbrekende of kapotte laag) zoals gewenst, of moet de interface dan een vaste vervangende illustratie tonen?
4. Is de stap-1-route (lokale Blender/Cycles, CC0 plus één gelicentieerd automodel) akkoord?
