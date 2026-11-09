# Overdracht aan ChatGPT — PVE-03 fase 1 (DEMO)

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie.
Opgesteld door Claude Code, 9 november 2026.

## 1. Baseline, branch, HEAD en diff

| | |
|---|---|
| Baseline `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd bij start en vóór push) |
| Branch | `preview/claude-premium-pve03` |
| Startpunt branch | `938e8bf66e01eeba2a54f56554f21874f3491171` (3 voorbereidingscommits bovenop `main`) |
| Implementatiecommit | `02800515e92865d04ab4e3559376ef6a026df475` |
| HEAD na deze overdracht | de commit die dit bestand toevoegt (direct na `0280051`) |
| PVE-01 | `preview/chatgpt-premium-pve01` = `7f04771c…`, **niet aangeraakt** |

Diff `938e8bf..0280051`: 28 bestanden, +2414 / −9. **Alles binnen `preview/pve-03/`.** De −9 regels zijn de herschreven `README.md` van de voorbereiding.
De volgende zaken zijn niet gewijzigd: `src/`, `energiehuis-card.js`, `hacs.json`, `scripts/`, `.github/`, `tests/` (productie), `reference/claude-f2-standalone.html` (SHA-256 `f70a2d9a…13dd83`, gecontroleerd in de tests) en `CLAUDE_CODE_OPDRACHT.md`.

Nieuwe bestanden: `index.html`, `styles.css`, `model.js`, `flows.js`, `app.js`, `assets/` (8 beeldlagen + `scene-anchors.js`), `tools/scene.html`, `tools/render-scene.cjs`, `tests/model.test.cjs`, `tests/flows-and-safety.test.cjs`, `tests/browser.cjs`, `screenshots/` (7 JPEG + `metrics.json`). `README.md` is bijgewerkt.

## 2. Starten en screenshots

```sh
cd preview/pve-03 && python3 -m http.server 8000   # open http://localhost:8000
```

Screenshots (DPR 2) in `screenshots/`: `pve03-1440x900`, `pve03-1330x748`, `pve03-768x1024`, `pve03-390x844`, `pve03-390x844-tekst200`, `pve03-320x700`, plus `compare-pve01-1330x748` (PVE-01 op `7f04771`). Er is geen gehoste URL; GitHub Pages is niet ingeschakeld.

## 3. Beeldlagen

Dit zijn eigen renders van een procedurele three.js-scène (`tools/scene.html`): geen foto's, logo's of modellen van derden, en geen tekst of cijfers in het beeld. Alle meetwaarden, labels, routes en deeltjes worden in de runtime getekend.

| Laag | px | WebP | JPEG |
|---|---|---|---|
| desktop 2× | 2660×1496 | 96 764 B | 274 039 B |
| desktop 1× | 1330×748 | 33 584 B | 83 464 B |
| mobiel 2× | 1080×1920 | 43 152 B | 130 057 B |
| mobiel 1× | 540×960 | 15 598 B | 37 640 B |

Gemeten startgewicht via de testserver: desktop 94,5 KiB en mobiel 42,1 KiB, ruim binnen het budget van 1,5 MB / 1 MB.
**De goedgekeurde referentiefoto was niet beschikbaar.** Er is dus geen pixelvergelijking gedaan; de scène is gebouwd naar de beschrijving in §3 van de opdracht.

## 4. Testresultaten

Uitgevoerd op de implementatiecommit `0280051` (werkkopie identiek). Node v22.23.4, Chromium 153.0.8010.12 headless (Playwright).

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` | PASS (bundel byte-identiek, SHA-256 `9f4fce00…6388`) |
| `node --check energiehuis-card.js` | PASS |
| `TZ=UTC node --test tests/*.test.cjs` | **359/359 PASS** |
| `TZ=Europe/Amsterdam node --test tests/*.test.cjs` | **359/359 PASS** |
| `node tests/browser/mobile-visual.cjs` | PASS ("Visual checks OK") |
| `node tests/browser/regisseur-cockpit.cjs` | PASS |
| `node tests/browser/stroomvergelijker.cjs` | PASS, **zonder** `EH_TEST_LIVE_TARIFFS` (geen live tarief-fetch) |
| `TZ=UTC node --test preview/pve-03/tests/*.test.cjs` | **24/24 PASS** |
| `TZ=Europe/Amsterdam node --test preview/pve-03/tests/*.test.cjs` | **24/24 PASS** |
| `node preview/pve-03/tests/browser.cjs --screenshots` | **15/15 PASS** |

De 15 browsercontroles:
- **Vijf viewports** (320×700, 390×844, 768×1024, 1330×748, 1440×900): telkens geen horizontale scroll, geen overlap of afkapping, targets ≥ 48 px, de WebP-laag geladen, geen console-fouten en alle zes waarden boven de vouw.
- **200 % tekst** op 320, 390 en 1440.
- **Alle 12 scenario's**: de routes in het DOM komen overeen met het model.
- **50 hertekeningen**: 0 structurele DOM-wijzigingen, 0 keer een route aan/uit, en de deeltjes lopen door zonder herstart.
- **Toetsenbord**: Tab, Enter, focus op "Sluiten", Escape met focusherstel, en een klik buiten het paneel sluit het.
- **Reduced motion**: 0 rAF-callbacks; de richtingspijlen blijven zichtbaar.
- **Verborgen tab**: animatie en interval stoppen, en hervatten weer.
- **Twee instanties**: ze werken onafhankelijk, en `destroy()` laat 0 intervals en 0 rAF-callbacks achter.
- **Performance**: 60,2 fps (1×) en 60,1 fps (4× CPU-throttling), heap 1,46 MB, +189 KB na 200 updates.

Kanttekening bij de fps: de rAF-frequentie in headless Chromium zegt weinig over echte apparaten.

## 5. Niet geverifieerd / risico's

- **Niet getest:** Safari/WebKit, een echte iPhone of Android, de HA Companion-app en een fysieke tablet.
- **Visuele norm:** het is een eigen 3D-render, geen foto, en er is niet vergeleken met de goedgekeurde referentiefoto. De auto is een generieke groene EV-hatchback, geen exacte Cupra Born.
- **Tablet 768 px:** de Cupra valt grotendeels achter de Cupra-tegel. Op 320 px overlapt de Cupra-tegel gedeeltelijk met de auto.
- **F2-risico's bewust vermeden:**
  - `graceMs` hield een route bij ongeldige data nog 10 s actief; hier niet.
  - De `dirHoldMs`-vertraging in de netrichting kon ~3 s de oude richting tonen; hier geldt alleen een dode band die nooit de tegengestelde richting claimt.
- **Strengere drempels dan F2:** de kruiscontrole en de negatieve huissensor stoppen de routes hier direct, zonder 30–60 s wachttijd. In een toekomstige LIVE-modus kan dat flikkeren bij ruis; voor de DEMO is het bewust streng.
- **Alleen rekenkundige balans:** die sluit in de DEMO-scenario's, maar zegt niets over de echte meetketen. Er bestaan geen verificatievlaggen.
- **Generator:** de offline generator heeft three.js 0.170.0 nodig (via npm, buiten de repo). De preview zelf heeft geen afhankelijkheden.

## 6. Vragen voor de onafhankelijke review (ChatGPT)

1. Komt de scène voldoende overeen met de goedgekeurde referentiefoto? Zo nee, welke onderdelen wijken het meest af (gevel, dak, praktijkgebouw, auto, licht)?
2. Is het route-contract (kleuren, drempels 30/40/80 W, geen grace, direct stoppen bij tegenstrijdigheid) zoals bedoeld voor een latere LIVE-fase?
3. Moet de praktijksimulatie-route in de DEMO blijven, of liever helemaal weg tot er een echte submeter is?
4. Is op tablet een eigen compositie gewenst (bijvoorbeeld 4:3), zodat de Cupra niet achter de tegel valt?
5. Mag de draft-PR (alleen `preview/pve-03/`) na jouw diffcontrole worden geopend, of blijft het bij branch plus handoff?

## 7. Status

**DEMO / niet productie.** Er is alleen op `preview/claude-premium-pve03` gecommit en gepusht. Geen PR, geen merge, geen tag, geen release, geen HACS-publicatie en geen wijziging aan een andere branch.
