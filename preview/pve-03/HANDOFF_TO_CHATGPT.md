# Overdracht aan ChatGPT — PVE-03 reviewcorrecties (ronde 2)

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie.
Opgesteld door Claude Code, 9 november 2026. Reactie op de review van ChatGPT op `b0322af` (GO MET OPMERKINGEN).

## 1. Baseline, branch, commits en diff

| | |
|---|---|
| Baseline `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| Branch | `preview/claude-premium-pve03` |
| Gereviewde HEAD vorige ronde | `b0322afa6218cceba4005baefbafccf69152e78a` |
| Referentie (fast-forward overgenomen) | `2d934a74bae02b57cfb44d06527c894cded24975` — `approved-visual-20261109.webp` + `APPROVED_VISUAL_REFERENCE.md` |
| P1-correcties | `ef94d06` — EV-geldigheid, minteken net, stilstaande deeltjes, tijdstempeltolerantie |
| P2 visueel + tests | `5e55f1b` — scène v2, UI, browsertests, screenshots |
| HEAD na deze overdracht | de commit die dit bestand bijwerkt (direct na `5e55f1b`) |

De referentiecommit bouwde direct voort op `b0322af`. Mijn branch is daarom met een fast-forward vooruitgespoeld en de referentie-SHA's zijn ongewijzigd.
Diff `2d934a7..5e55f1b`: 26 bestanden, +606 / −409, **alles binnen `preview/pve-03/`**. Niet gewijzigd: `src/`, `energiehuis-card.js`, `hacs.json`, `scripts/`, `.github/`, productie-`tests/`, `reference/` (F2 SHA-256 gecontroleerd, referentiebestanden onaangeroerd) en `CLAUDE_CODE_OPDRACHT.md`.

## 2. Prioriteit 1 — engineering

| Reviewpunt | Oplossing | Bewijs |
|---|---|---|
| Negatieve/ongeldige EV-vermogens | `< −30 W` of `> 11,5 kW` ⇒ "Ongeldige laadmeting (negatief/te hoog)", waarde `—`, tegel rood, geen route, niet in de balans. `−29…29 W` = `0 W`. "Laden" alleen zolang de EV-route actief is (een fixture-label "Laden" bij 0 W wordt "Niet aan het laden"). Nieuw scenario "Negatieve laadmeting". | 3 nieuwe Node-tests (negatief, nulband/te hoog, unavailable/kWh/verouderd) + browsertest |
| Minteken bij export | `formatNet`: "−1,88 kW" (U+2212) + "Teruglevering aan het net"; afname "7,60 kW" + "Afname van het net"; ook bij gecorrigeerde P1 | Node-test + browsertest |
| Deeltjes direct stoppen | In `flows.js` beweegt een fase alleen nog bij `active`. Bij inactief staan de deeltjes onmiddellijk stil en doven ze alleen op hun plek. | Browsertest: offline, verouderd, onbekende eenheid en negatieve EV ⇒ eerst beweging, daarna DOM `data-active=false` en fases identiek na 250 ms |
| Tijdstempeltolerantie | Gedocumenteerd in `model.js` (`T.futureToleranceMs`) en de README: tot 120 s in de toekomst geaccepteerd, daarboven "Tijdstempel onbekend" en nooit actief. Geen verificatievlaggen. | Node-test (+119 s live, +121 s stale, +1 u route uit, geen `verif*`-exports) |

## 3. Prioriteit 2 — visueel

Ik heb de scène opnieuw gebouwd (`tools/scene.html` v2) naar de goedgekeurde referentie, als eigen tekstvrije 3D-render. Er zijn geen foto's, logo's of kentekens gebruikt.
- **Woning:** driekwart-aanzicht met de topgevel naar rechts, wit geschilderde baksteen, donker pannendak, panelen linksboven met een dakkapel eronder, en grote glazen pui plus lamellenraam in de topgevel. Verder warm interieur met meubels, wandlampen met lichtbundels omhoog en omlaag, potplanten en contactschaduwen.
- **Cupra:** knalgroene compacte EV in Born-stijl met een gemodelleerde carrosserie, zwart dak, koperen accenten, scherpe koplampen, honingraatgrille, donkere velgen met koperen ring, en een laadkabel naar een generieke wandlader op de garage.
- **Praktijkruimte:** houten bijgebouw links met een verlichte schuifpui (behandeltafel, plant), wandlampen en witte hortensia's.
- **Omgeving:** zonsonderganglucht met wolken, bomen, natte bestrating in visgraatverband, paaltjesverlichting en lichtreflecties.
- **UI:** compactere zwevende kaarten (maximaal 15 rem). De Cupra-kaart staat **boven** de auto, de praktijkkaart bij het bijgebouw, Net midden onder het huis. De tablet heeft compacte tegels zodat de auto grotendeels zichtbaar blijft.
- **Mobiel:** een eigen compositie (praktijk linksonder, auto rechtsonder, huis in het midden). Alle zes waarden staan zonder scrollen in beeld op 320×700 en 390×844.

| Laag | px | WebP | JPEG |
|---|---|---|---|
| desktop 2× | 2660×1496 | 133 000 B | 314 160 B |
| desktop 1× | 1330×748 | 52 010 B | 103 969 B |
| mobiel 2× | 1080×1920 | 63 054 B | 159 530 B |
| mobiel 1× | 540×960 | 25 762 B | 51 796 B |

## 4. Tests

Lokaal uitgevoerd op `5e55f1b` (werkkopie identiek). Node v22.23.4, Chromium 153.0.8010.12 headless.

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` | PASS (bundel byte-identiek, SHA-256 `9f4fce00…6388`) |
| `node --check energiehuis-card.js` | PASS |
| Productie-Node, UTC en Europe/Amsterdam | **359/359** en **359/359** |
| `tests/browser/mobile-visual.cjs`, `regisseur-cockpit.cjs`, `stroomvergelijker.cjs` | 3× PASS (stroomvergelijker zonder live tarieven) |
| PVE-03 Node, UTC en Europe/Amsterdam | **30/30** en **30/30** (was 24; +6 regressietests) |
| `node preview/pve-03/tests/browser.cjs --screenshots` | **17/17 PASS** |

De 17 browsercontroles:
- **Viewports:** 320, 390, 768, 1330 en 1440 px zonder overflow, overlap of afkapping, met targets ≥ 48 px en zonder consolefouten.
- **200 % tekst:** op 320, 390 en 1440 px.
- **Scenario's:** alle 13 komen in het DOM overeen met het model.
- **50 hertekeningen:** 0 structurele wijzigingen en 0 keer een route aan/uit.
- **Deeltjes:** staan stil bij offline, verouderd, onbekende eenheid en negatieve EV.
- **Negatieve EV, minteken en overgangen:** de reeks zon → offline → nacht → P1 gecorrigeerd → P1 fout → zon klopt.
- **Toetsenbord:** Tab, Enter, focus op "Sluiten", Escape met focusherstel.
- **Reduced motion:** 0 rAF-callbacks.
- **Verborgen tab:** animatie en interval stoppen.
- **Twee instanties:** werken onafhankelijk en laten na `destroy()` 0 intervals en 0 rAF-callbacks achter.
- **Performance:** 59,5 fps (1×) en 57,5 fps (4× CPU-throttling), heap 1,46 MB, +192 KB na 200 updates.

Screenshots (DPR 2) in `screenshots/`: `pve03-320x700`, `pve03-390x844`, `pve03-390x844-tekst200`, `pve03-768x1024`, `pve03-1330x748`, `pve03-1440x900`, en **`compare-reference-1330x748`** (van boven naar beneden: referentie, nieuwe scènelaag, volledige UI).

## 5. Onafhankelijke vergelijking met de referentie

**Komt overeen:**
- de compositie en objectposities: woning centraal met de topgevel rechts, panelen linksboven met de dakkapel eronder, een donkere garage met wandlader rechts, de groene EV voor de garage, het houten praktijkgebouw met schuifpui links, hortensia's, paaltjes langs het pad, wandlampen en natte bestrating;
- warm licht achter de ramen tegen een avondlucht;
- kaartposities: zon linksboven, Cupra boven de auto, praktijk links, huis midden en Net midden onder.

**Wijkt nog af:**
1. **Fotorealisme:** de referentie oogt als een foto. Mijn render is duidelijk CGI: vlakkere materialen, te weinig micro-detail in gevel en dak, en geen globale belichting of zachte omgevingsschaduw.
2. **Begroeiing:** de bomen en struiken bestaan uit bolvormige bladclusters en zijn daardoor als "bolletjes" herkenbaar. In de referentie zijn het fijne, natuurlijke silhouetten, met onscherpe planten op de voorgrond.
3. **Cupra Born:** de kleur en de grote lijnen kloppen (knalgroen, zwart dak, koper), maar het model is grover. Het front, de koplampvorm, de C-stijl en de velgen zijn niet zo herkenbaar als op de referentiefoto. Bewust zonder logo en kenteken.
4. **Lucht en kleurtoon:** de referentie heeft een warmere oranje-roze zonsondergang. Mijn lucht blijft meer mauve en de bestrating iets koeler.
5. **Gevel en interieur:** de referentie heeft geplaatste meubels en diepte achter het glas. Bij mij zijn dat geschilderde interieurtexturen.
6. **Ontbreekt bewust:** het logo in de kop, de datum/tijd/temperatuur-strook en "Vandaag … kWh". Die waarden zijn fictief in de referentie en vallen buiten het DEMO-model.

**Twee punten waarop de referentie zelf afwijkt van de geschreven specificatie (keuze nodig):**
- **Virtuele batterij:** in het beeld staat die **linksonder**; de opdracht en `APPROVED_VISUAL_REFERENCE.md` zeggen **rechtsboven**. Ik heb de geschreven tekst gevolgd (rechtsboven).
- **Routekleuren:** in het beeld is huis → net cyaan en huis → Cupra groen. Het routecontract zegt huis → net groen en huis → Cupra cyaan; dat contract heb ik aangehouden.

## 6. Niet geverifieerd / risico's

- Safari/WebKit, een echte iPhone of Android en een fysieke tablet zijn niet getest. De fps zijn headless-metingen.
- Op mobiel bedekt de huiskaart een deel van de gevel; huis, auto en praktijk blijven wel herkenbaar.
- Een echte stap naar fotorealisme vraagt waarschijnlijk een andere aanpak dan procedurele three.js-geometrie. Bijvoorbeeld een pathtracer (Blender/Cycles) met gelicenseerde of eigen modellen en texturen, of door de eigenaar aangeleverde tekstvrije fotolagen met duidelijke rechten. Dat is een besluit voor de eigenaar.

## 7. Reviewvragen

1. Is de nieuwe scène voldoende als DEMO-richting, of is fotorealisme (zie §6) een harde eis vóór de volgende fase?
2. Batterij: rechtsboven (tekst) of linksonder (beeld)?
3. Routekleuren huis → net en huis → Cupra: contract of beeld?
4. Moet de datum/tijd/temperatuur-strook uit de referentie als fictief DEMO-element worden toegevoegd?

## 8. Status

**DEMO / niet productie.** Er is alleen gecommit en gepusht op `preview/claude-premium-pve03`. Geen PR, merge, tag, release, HACS-publicatie, productiecodewijziging of laadbediening.
