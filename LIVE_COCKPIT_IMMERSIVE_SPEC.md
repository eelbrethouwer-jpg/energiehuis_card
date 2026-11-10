# Energiehuis — Immersive Home & klikbare energieroutes

**Ontwerpstatus:** geïmplementeerd op de featurebranch en **automatisch getest** (zie §7). **Niet praktisch getest** in een echte Home Assistant of op een iPhone. Niet gemerged en niet gepubliceerd.
**Productiebaseline:** `main` op `608d1f6bc78a19e582900fae338533618048650b` (gepubliceerde v1.27.0).
**Werkbranch:** `feature/live-cockpit-immersive-home-navigation`.
**Goedgekeurde master:** `preview/pve-03/reference/approved-visual-20261109.webp` (ongewijzigd).
**Doelversie:** voorstel v1.28.0; versie pas in een **aparte release-PR** ophogen.

## 1. Doel en grenzen

Maak de bestaande PVE-04 Live Cockpit het **schermvullende startscherm** van dezelfde `<energiehuis-card>` (geen tweede Lovelace-kaart of Cloudflare-app). De foto, de daadwerkelijke animatiedeeltjes en interactieve energietegels vormen de primaire navigatie. Het oude voorblad met “Overzicht”, dubbele KPI's, grafiekblok en Slimme energiecoach hoort niet meer onder elkaar op het Home-scherm te staan wanneer de nieuwe modus aan staat. Behoud die functionaliteit via Inzicht / detailpagina's.

Maak een afzonderlijke configuratieoptie `live_cockpit_immersive: true`, alleen bruikbaar als `live_cockpit: true`; standaard uit tot fysieke acceptatie. Met de opt-in uit moet v1.27.0 gedrag identiek blijven.

## 2. Interactieve routes

| Klikvlak in master | Bestemming | Bron en bijzonderheden |
|---|---|---|
| Groene Cupra-tegel / auto | Bestaande Cupra-pagina; zichtbare vervolgnavigatie naar bestaand Slim laden | `_view = 'cupra'`, `_view = 'charge'`; geen directe laadopdracht |
| Zonnepanelen | Nieuwe volledige Zonnepanelen-pagina | Hergebruik bestaande `sun`-detail, grafiek/historie en GoodWe-entiteit; status bij stale |
| Huisverbruik | Nieuwe Huis-pagina | Hergebruik `home`-detail/historie; huis excl. Cupra, geen nieuwe berekening |
| Net | Nieuwe Net-pagina | Hergebruik `grid`-detail/historie, P1-tekenconfiguratie en richtingcontrole |
| Virtuele batterij | Bestaande Batterij-pagina | Expliciet `simulatie`, geen fysieke opslag claimen |
| Praktijkruimte | Nieuwe read-only Praktijkruimte-pagina | Nog niet gekoppeld; geen fictieve kWh/W, geen automatische dubbeltelling |

Klikbare hotspots moeten uit bestaande `S.covers`/PVE-04-tegels komen, niet uit een nieuw handmatig getekende afbeelding. Eén tik start navigatie; behoud optioneel de bestaande technische meetdetails via een aparte knop “Meetdetails”. Vanuit elk scherm een duidelijke “Terug naar Home”-actie. Bestaande onderste navigatie blijft werken.

## 3. Schermvullende responsive compositie

- In immersieve modus: verwijder de hoge “Overzicht”-hero en de standaard `.eh26-legacy`, de Energiecoach en de onderste oude Home-modules uit de **zichtbare Home-compositie**. Behoud hun data en functies en maak de bestaande meetgrafieken bereikbaar vanuit Inzicht.
- Behoud de exacte goedgekeurde WebP; geen re-render, geen externe assets, geen ontwerpwijziging aan het huis/de Cupra/de lichtlijnen.
- Desktop/tablet: visuele cockpit vult de beschikbare Home-ruimte zo veel mogelijk; stel af op lokale toolbar en ondernavigatie.
- **Mobiel:** originele master is liggend. Een pure `object-fit: cover` voor een staand scherm zou de zonnepanelen/praktijkruimte en Cupra kunnen afsnijden en hotspots misplaatsen. Gebruik daarom een volledig zichtbare, proportionele voorgrondscène (`contain`) met sfeervolle achtergrondverlenging van dezelfde master als schermvulling; geometrie van hotspots, covers en animatiecanvas moet op de werkelijke voorgrondscène blijven uitgelijnd.
- Geen horizontale scroll, geen cut-off van de master of dubbele kaartwaarden, geen content achter de sticky bottomnav; op 320/390/430 px bruikbare tikvlakken >= 44×44 px, met leesbare labels en een toegankelijke fallback voor vergroting/reduced motion.
- Eén visual first: data zoals status en waarschuwingen compact geïntegreerd en niet herhaald onder het beeld. De status moet OFFLINE of verouderd correct tonen.

## 4. Technische vereisten

- Inspecteer actuele `AGENTS.md` en `main`. Bron in `src/legacy/`, HACS-bundel uitsluitend via `node scripts/build.cjs --write`.
- De PVE-04-scène bestaat nu in `src/legacy/16-live-cockpit.js`, met `EhPve04Master.createMasterCockpit()`. Voeg een optionele callback `onTileNavigate(key)` toe die uitsluitend in de geïntegreerde LIVE-immersive modus actief wordt. Bewaar huidige detail-dialoog in de gewone modus.
- Kaartnavigatie gebruikt de bestaande `_view`/`_detail`-controller; centrale whitelist voor bestemmingen, geen externe URLs of `history.pushState`. Voeg nieuwe views voor zonne/house/net/practice gecontroleerd toe of hergebruik `_energyDetailHtml` met echte afzonderlijke secties.
- Behoud `hass.states` en bestaande stale/sync/invalid-datacontroles, Media Source-afbeeldingsresolver (same-origin `/media/`) en read-only karakter; geen servicecalls of opslagmutaties.
- Tijdens `hass`-updates blijft de huidige scène-DOM/masterafbeelding identiek; geen heraanmaak of dubbel uitgevoerde eventhandlers, timers of ResizeObservers. Bij wisselen van views suspend/resume correct.
- Bij ontbrekende afbeelding, verouderde sensoren of smal scherm: bruikbare navigatie naar alle bestemmingen blijft mogelijk, geen kapotte/lege Home.

## 5. Acceptatie en regressies

Test minimaal: 320×568, 390×844 (iPhone), 430×932, 768×1024, 1280×800, landschapsstand; desktop Chrome, mobiel Chromium, WebKit. Toets per hotspot de juiste pagina, terug naar Home, back via navigatie, alle functies bereikbaar, focus en VoiceOver-semantiek, lage contrasten, offline, ontbrekende master en stale Alfen. Visual regressions met screenshots, geen demo-entiteiten tijdens LIVE.

Verplicht: `node scripts/build.cjs --check`, `node --check energiehuis-card.js`, Node tests in UTC en Europe/Amsterdam, alle bestaande relevante Playwright-tests (energie, Slim laden, batterij, Cupra, tarieven, contracten), plus nieuwe click-through en lifecycle-tests. Voer geen fysieke laadcommando's uit.

## 6. Releasegrenzen

Maak codecommits op de featurebranch. Open een draft-PR met testresultaten en documenteer wat alleen op echte HA/iPhone kan. **Geen merge, tag, release of HACS-publicatie zonder afzonderlijk expliciet akkoord van de eigenaar voor deze wijziging.** v1.27.0 blijft werkende fallback; `live_cockpit_immersive: false` herstelt de huidige interface.

## 7. Implementatie en automatische tests (featurebranch)

| Onderdeel | Uitvoering |
|---|---|
| Opt-in | `live_cockpit_immersive: true` werkt alleen met `live_cockpit: true` (`EhLiveCockpit.immersiveEnabled`). Met de opt-in uit doet de nieuwe laag niets: v1.27.0-gedrag. |
| `src/legacy/16-live-cockpit.js` | `createMasterCockpit` kreeg de optionele `onTileNavigate(key)` en `onImageLoad(img)`; zonder die opties is het gedrag ongewijzigd (detaildialoog). Verder: de controller weet of hij immersive draait (signatuur `createController(card, cfg)` ongewijzigd); er is CSS voor `:host([data-immersive])`. De beschikbare hoogte wordt gemeten (bovenkant van de cockpit, ondernavigatie), met alleen tijdens zichtbaarheid een resize-listener. De achtergrondverlenging is een canvas van 160 × 90 uit dezelfde, al geladen master (geen tweede beeldaanvraag). Bij een kleine scène is de laagkeuze afhankelijk van de scènebreedte. **Bugfix:** de focus wordt niet teruggezet in de cockpit terwijl het Inzicht-menu open staat; anders sluit het menu meteen (iOS/Safari). |
| `src/legacy/17-live-immersive.js` (nieuw, laatste fragment) | Centrale whitelist `EH_IMM_ROUTES`/`EH_IMM_VIEWS`, navigatie via `_view`/`_detail`, nieuwe views `sun`/`home`/`grid`/`practice` (hergebruik van `_energyDetailHtml` via het bestaande detailpaneel), "Alle metingen" (oude Home-inhoud, cockpit gepauzeerd), "Terug naar Home" op elk scherm, "Naar Slim laden" op de Cupra-pagina, items in het Inzicht-menu, en focusbeheer (paginakop ↔ originerende kaart). Geen externe URL's, `pushState`, servicecalls of opslag. |
| `scripts/build.cjs` | Fragment `17-live-immersive.js` na `16-regisseur-cockpit.js`. |
| Net-pagina (correctie review) | De hoofdweergave gebruikt `EhPve04Model.netPresentation(m)`, net als de Net-kaart op Home. Een richting (minteken, "Afname/Teruglevering") verschijnt alleen bij een actieve netroute. Anders toont de pagina het absolute P1-vermogen met "P1-meting · richting niet bevestigd (…)". De ruwe, ondertekende P1-waarde staat uitsluitend in de technische diagnose ("Ruwe P1-sensorwaarde (ondertekend)"), samen met "Bevestigde richting" en bij hold of kritiek ook "Meetketen". Het vorige cockpitmodel gaat mee als `prev`, zodat de dode band (40–80 W) dezelfde richting geeft als op Home. |
| Portretcompositie (visuele acceptatie) | Een 16:9-master past zonder uitsnede op een smal, hoog scherm alleen klein. Vóór de correctie was dat op 390×844 een scène van 354×199 in ±640 px waas. Daarom zet `measure()` bij hostbreedte < 600 px en beschikbare hoogte ≥ 1,1 × breedte `data-imm-portrait`. De scène loopt dan (vrijwel) over de volle breedte bovenaan, met de zes routes als leesbare kaarten eronder (2 kolommen vanaf 21rem, anders 1). De glasvlakken op de master zijn óók aantikbaar met muis of touch, met een tikvlak ≥ 44 px. Ze blijven `aria-hidden`; toetsenbord en schermlezer gebruiken de kaarten. Tablet, desktop en liggend houden de kaarten op de master. Geen bijsnijding, vervorming of nieuw beeld. |
| Tests | Nieuw: `tests/browser/live-cockpit-immersive.cjs` (21 controles, Chromium en WebKit, ook in de CI-workflow `stroomvergelijker-browser.yml`). Daarin onder meer echte muisklikken en touch-tikken (`page.mouse.click` en `page.touchscreen.tap` met `hasTouch`) op 320, 390 en 430 px, voor zes routekaarten, zes vlakken op de master en "Terug". Ook tablet-touch en desktop-muis op de kaarten op de master. Per tikpunt wordt gecontroleerd dat het element zichtbaar is, in beeld staat en niet bedekt wordt (`elementFromPoint` door alle shadow-roots). `tests/v128-live-immersive-net.test.cjs` dekt synchrone afname, teruglevering, een niet-synchrone keten, kritieke tegenstrijdigheid, verouderde P1, 0 W en de dode band. Bijgewerkt: de fragmentvolgorde en -telling in `v126-visual-experience`, `v127-live-cockpit-home` en `v2-build-parity`. |

**Alleen te verifiëren op een echte HA/iPhone:**
- de werkelijke hoogte onder de HA-toolbar en de Companion-app (safe-areas, dynamische adresbalk);
- VoiceOver-uitspraak van de kaarten ("Pagina openen");
- de echte Media Source-authenticatie;
- gedrag met echte sensoren (stale Alfen, offline).
