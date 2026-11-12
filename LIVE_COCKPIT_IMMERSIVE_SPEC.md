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

## 8. Landscape first (branch `feature/live-cockpit-landscape-first`, PR #58)

Alleen actief bij `live_cockpit_immersive: true`. Ontwerpbesluit: de bestaande goedgekeurde brede scène (woning, praktijkruimte, groene Cupra) is in liggende stand het dominante hoofdbeeld. Geen nieuw beeld of ontwerp, geen uitsnede, geen vervorming; de bestaande kaarten, klikroutes en energiestromen staan erover. Op een laag, liggend scherm (`max-height: 500px` en `orientation: landscape`) geldt:

| Onderdeel | Uitvoering |
|---|---|
| Scène | De scène (contain-fit, verhouding 1330:748) krijgt bijna de volle hoogte en 70 % van de breedte. De vervaagde achtergrond uit dezelfde master vult de hele kaart. Op 844×390 en 932×430 was de scène op main (v1.28.0) 313×176 px; nu is ze 590×332 px (85 % van de hoogte, 70 % van de breedte) en 661×372 px (87 % van de hoogte, 71 % van de breedte). Door de grotere schaal staan de kaarten met titel op het beeld. |
| Navigatie | Een slanke rail links (76 px + veilige zone; Home, Laden, Inzicht, Meer, elk ≥ 44 px) in plaats van een balk onder de scène. Dat levert de hoogte op. De appbalk is slank (±37 px). Alle pagina's (Slim laden, Cupra, Batterij, kosten, Zon, Huis, Net, Alle metingen) gebruiken dezelfde rail. Het Inzicht-menu opent rechts van de rail, in 2 kolommen, met een maximale hoogte en scrollen zo nodig. |
| Tekst | Status, samenvatting en legenda staan als lichte tekst rechts naast de scène, op de vervaagde achtergrond (geen paneel). |
| Veilige zones | `env(safe-area-inset-left/right/bottom)` als marge, alleen in deze liggende stand. De tests simuleren een notch via `--eh-safe-test-l/r/b`. |
| Meting en rotatie | **Bugfix:** de resize-listener werd pas na een suspend/resume geplaatst, dus de hoogte volgde niet na een eerste draai. Nu wordt hij bij het aanmaken geplaatst (ook voor `orientationchange`), met één extra meting op het volgende frame na elke render. Een wissel van portret naar liggend past de laag direct toe (`relayout(true)`), zonder tussenframe. De navigatiehoogte telt niet mee als de navigatie een rail is. |
| Gevolg buiten landscape | Door de herstelde meting vult de kaart op portret en tablet de beschikbare hoogte (navigatie onderaan). Inhoud en compositie zijn ongewijzigd; vergelijking met main toont alleen die extra hoogte. |
| Niet gewijzigd | Hotspots/kaarten op de master (`covers`), routes, detailpagina's, het `live_cockpit_immersive: false`-gedrag en alle HA-gegevens (alleen lezen). Geen nieuwe servicecalls, geen wijziging aan de laadlogica of aan opslag. |

Tests (`tests/browser/live-cockpit-immersive.cjs`, 32 controles): landscape 844×390, 932×430 en 667×375 (scène ≥ 80 % van de hoogte en ≥ 60 % van de breedte, 667×375 ≥ 60 % en ≥ 55 % vanwege de breedte; zes kaarten binnen de scène, rail links, tekst naast de scène, geen overflow of overlap); veilige zones; alle functies via echte touch-tikken in liggend (Laden → Slim laden, Inzicht-menu met alle items, Meer, Cupra, Batterij, historie, kosten/contracten, Alle metingen); rotatie portret ⇄ liggend (zelfde host en beeld, 0 nieuwe resolves, 0 extra listeners of observers, geen frame zonder scène of beeld, huidige pagina en meetdata blijven staan); landscape zonder meting, zonder beeld en offline; landscape met reduced motion.

**Alleen te verifiëren op een echte iPhone:** werkelijke safe-areas en adresbalk in Safari en de Companion-app, het gedrag van `orientationchange` en `innerHeight` bij het draaien in iOS, de leesbaarheid van de kaarten en de rail op het scherm in de hand, en het gedrag van de rail binnen de Home Assistant-toolbar.

## 9. Definitieve Home: scène + vakjes + kwartierprijs (PR #58)

Alleen actief bij `live_cockpit_immersive: true`. De Home bestaat uit de bestaande goedgekeurde scène, de bestaande interactieve vakjes en een kleine kwartierprijs-overlay. Het live-paneel naast het beeld en het tekstblok eronder zijn weg.

| Onderdeel | Uitvoering |
|---|---|
| Geen panelen | Status, samenvatting en legenda staan niet meer naast of onder het beeld. Ze blijven bestaan voor schermlezers (visueel verborgen, `aria-live` blijft); de LIVE/OFFLINE-pil staat in de scène. Een waarschuwing bij een tegenstrijdige meetketen blijft zichtbaar, als dunne balk bovenaan de scène. De decoratienotitie ("lichtlijnen in het beeld zijn decoratief") is niet meer zichtbaar op Home; die tekst staat nog in de toegankelijke beschrijving van het beeld. Dit is een bewuste keuze en moet door de eigenaar worden bevestigd. |
| Vakjes | Per vakje de grote livewaarde met een kleine regel eronder. Op de scène zijn de vakjes iets hoger (naar beneden) zodat de regels passen; ze blijven over de afgedekte ingebakken kaart. In portret (lijst) staan ze onder de scène. |
| Zonnepanelen | `Vandaag: x kWh`, rechtstreeks uit de dagsensor van de omvormer (`zonne_energie`): alleen kWh/Wh, ≥ 0 en vandaag bijgewerkt. Anders uit de statistieken (zie §10). |
| Huis | `Vandaag: x kWh` (huis exclusief Cupra): de eigen kWh-teller (`huis_energie`), anders afname − teruglevering + opwek − laden, alleen als alle vier volledig zijn gemeten. Anders `onvolledig`; nooit een getal uit een deel van de bronnen (zie §10). |
| Cupra | `Vandaag: x kWh` (Alfen-teller) en `Sessie: x kWh`. De sessie komt NIET meer uit `cupra_charged_energy` (de betekenis daarvan is niet bewezen), maar uit het verschil van de Alfen-teller sinds de gemeten sessiestart (zie §10). Onzeker ⇒ `Sessie: niet beschikbaar`. |
| Net | Gescheiden `Afname: x kWh`, `Teruggeleverd: x kWh` en `Kosten: € x,xx` (kosten uit `cost_zonneplan_day`, alleen een bedrag in euro dat vandaag is bijgewerkt). Er is geen nettoformule meer. |
| Praktijkruimte en batterij | Praktijkruimte: "Nog niet gekoppeld", geen cijfers. Virtuele batterij: het label "Simulatie" blijft. |
| Dagtotalen | Eén gedeelde, read-only `recorder/statistics_during_period`-vraag (zie §10). |
| Kwartierprijs | Knop (≥ 44×44 px) rechtsonder op de scène (in portret een rij onder de vakjes) met label, actuele prijs, kwartiertijd en één staafje per kwartier. Opent het bestaande prijsoverzicht (Slim laden). Zie §10. |
| Beeldgrootte | Door het wegvallen van de tekstregels is de scène op tablet en desktop groter geworden. In landscape staat de navigatie als rail links (zie §8). |
| Niet gewijzigd | Hotspots/covers, routes, detailpagina's, het `live_cockpit_immersive: false`-gedrag (DOM en pixels identiek aan v1.28.0), alle bestaande functies en HA-gegevens. |

Tests (`tests/browser/live-cockpit-immersive.cjs`, 38 controles): vier schermmaten (844×390, 932×430, 390×844, 1280×800) op de definitieve samenstelling (dagregels, prijs, geen panelen, geen overlap met vakjes, hotspots); ontbrekende statistieken, kostensensor, sessie, kwartierdata, prijssensor en offline; één statistiekvraag per 60 hass-updates en geen servicecalls. Testdata is gesimuleerd.

**Alleen te verifiëren op een echte HA/iPhone:** werkelijke statistieken (Alfen, P1, GoodWe), de betekenis van `cupra_charged_energy` en `cost_zonneplan_day`, de Zonneplan-kwartierattributen, de leesbaarheid van de kleine regels en de prijsoverlay op het scherm.

### 9.1 Datum en temperatuur in de pil bovenaan

Naast de tijd in de pil bovenaan de scène staan nu de datum en de buitentemperatuur (bijvoorbeeld `LIVE 09:41 | do 12 nov · 14°`). De datum komt uit de klok van het toestel. De temperatuur komt uit de optionele weer-entiteit (`weather`, attribuut `temperature`), anders uit de buitentemperatuur van de Cupra (`cupra_outside_temp`). Alleen °C en °F (omgerekend), niet ouder dan 3 uur en tussen −60 en 70 °; anders alleen de datum. Offline: geen extra tekst. De tekst "alleen-lezen" in de pil vervalt (die staat al in de appbalk). In portret loopt de pil naar links door in de lucht boven het huis. Op zeer kleine scènes (< 330 px breed) verdwijnt de extra tekst. Let op: de Cupra-temperatuur is een autosensor, geen weerstation. Voor een echte buitentemperatuur is een `weather.`-entiteit in de kaartconfiguratie beter.

## 10. Kwaliteitsronde: betrouwbare dagtotalen, sessie, kwartierprijs (PR #58)

**Dagtotalen (`ehImmCounterDay`).** Eén gedeelde vraag per 5 minuten (2 minuten na een mislukking): `recorder/statistics_during_period`, uurperiode, van de uurstand vóór lokale middernacht tot nu, types `change`, `sum` en `state`, eenheid kWh. Per teller (afname, teruglevering, Alfen, optioneel `huis_energie`):
- *Dekking:* elk voltooid uur sinds lokale middernacht (einde ≥ 10 min geleden, vanwege de HA-compilatie) moet aanwezig zijn, met een geldige `change` (≥ 0 en ≤ 50 kWh per uur). Het lopende, onvolledige uur wordt gedekt met de live tellerstand min de eindstand van het laatste voltooide uur (maximaal 30 min oud, plausibel, geen reset).
- *Status:* `complete` (alles aanwezig), `partial` (een ondergrens: er ontbreekt een uur, er is een reset of het live deel ontbreekt; getoond met `≥`) of `missing` (niets bruikbaars: geen regel). Huis wordt nooit uit een deel van de bronnen berekend (`onvolledig`).
- *Zomer-/wintertijd:* uren zijn echte tijdstippen vanaf de echte lokale middernacht (23, 24 of 25 uur); het dubbele uur bij het terugklokken telt dus als twee uren.
- *Eenheden:* kWh, Wh en MWh; een onbekende eenheid geeft geen live deel (dus `partial`).
- *Schattingen:* de eerdere schatting uit gemiddeld vermogen is vervallen. Er wordt niets als geschat getoond.

**Laadsessie (`ehImmCurrentSession`).** Uit de Alfen-tellerhistorie (`history/history_during_period`, laatste 36 uur, alleen tijdens het laden, hooguit één vraag per 150 s) plus de live stand. Een sessie is een aaneengesloten laadblok; pauzes tot 45 minuten horen bij dezelfde sessie (dezelfde grens als `eh17SessionsFromHistory`), langere pauzes starten een nieuwe sessie. Sessie-kWh = live stand − teller bij de sessiestart. Onbetrouwbaar ⇒ `Sessie: niet beschikbaar`: live stand ouder dan 10 minuten, onbekende eenheid, geen of te weinig historie, tellerreset of meetgat vlak voor of tijdens de sessie, onmogelijke sprong (> 12 kW), geschiedenis die midden in de sessie begint. De sessie loopt over middernacht door (er is geen dagrand in de berekening). Betekenis: één "sessie" kan korter zijn dan wat de auto als sessie rapporteert als een slimme pauze langer dan 45 minuten duurt.

**Schaarse tellerhistorie (reviewfix PR #58).** Een stijgend interval langer dan 45 minuten maakt de sessiegrens onzeker, ook bij plausibel gemiddeld vermogen. Er verschijnt dan `Sessie: niet beschikbaar`; er wordt geen nieuwe startstand geschat. Na aantoonbare lange stilstand en een opnieuw gemeten start kan een nieuwe sessie weer beschikbaar worden. Regressietests dekken change-only historie met een gat van 90 minuten, de grens 45/46 minuten en herstel na stilstand.

**Net.** Afname, teruglevering en kosten zijn gescheiden. `cost_zonneplan_day` wordt alleen getoond bij eenheid `EUR`/`€` (of leeg) en een bijwerking van vandaag; onbekend is nooit € 0. Of deze sensor de totale Zonneplan-stroomkosten van de dag is, volgt uit de bestaande kostenpagina (`Zonneplan vandaag`) maar is niet tegen een echte HA gevalideerd.

**Kwartierprijs.** Het aantal kwartieren volgt de echte dag (92, 96 of 100), de positie van een kwartier volgt zijn echte tijdstempel, en de staven hebben een nulbasislijn zodat negatieve prijzen eronder hangen. Ontbrekende kwartieren blijven leeg (geen interpolatie, geen gekopieerde uurprijs). De handtekening van de grafiek is een hash over de echte prijsdata (inclusief toekomstige kwartieren), zodat een gewijzigde Zonneplan-forecast altijd opnieuw rendert. De knop opent via de bestaande route (`_view = 'charge'`, Slim laden, dat de kwartierprijzen toont); terug naar Home zet de focus terug op de knop.

**Kleine liggende schermen.** De dagregels hebben vier vormen naar de breedte van de scène (≥ 800, ≥ 560, ≥ 330 px en kleiner; in de lijstweergave altijd de volledige vorm) met een minimum van 9 px en zonder afkappen. Op kleine schermen blijven de belangrijkste gegevens staan in een korte vorm (`Dag 21,8 kWh`, `Af 7,21 · € 0,31`, `Sessie 1,99 kWh`); de toegankelijke naam van het vakje bevat altijd de volledige zin. Niets wordt meer verborgen.

**Screenshots in CI.** De workflow bewaart de Home-screenshots (844×390, 932×430, 390×844 en 1280×800, in Chromium en WebKit, plus extra maten) als artifact `home-screenshots-fictive-data`, controleert dat de vier verplichte bestanden bestaan en zet op elke PNG een rode balk dat de data fictief is (gesimuleerde HA-gegevens en een synthetisch beeld, niet de goedgekeurde master) met de commit-SHA.

Tests: `tests/v128-immersive-day-session-price.test.cjs` (25 Node-tests, UTC en Europe/Amsterdam, DST via `process.env.TZ`) en `tests/browser/live-cockpit-immersive.cjs` (47 controles). De browsertests draaien met een vaste klok (`page.clock.setFixedTime`) en een consistente gesimuleerde HA (tellers, historie, sessies, gaten, resets).

## 11. Praktijkfix: flikkeren bij meetupdates

Op de iPhone is flikkeren gemeld zodra een meetwaarde verandert. De bestaande renderketen verving de buitenste shadow-DOM en plaatste dezelfde cockpit terug; behoud van alleen de cockpit/afbeeldingsidentiteit voorkwam die tijdelijke loskoppeling niet.

Bij een bestaande, actieve immersive Home verversen meetupdates nu alleen het cockpitmodel en de extra gegevens. De shell blijft verbonden. Navigatie, configuratie, dichtheid, menu en verbindingstatus van de werkbalk gebruiken bij wijziging de volledige renderketen. Andere schermen en de uitgeschakelde opt-in behouden hun renderpad. De lifecycle-browsercontrole observeert expliciet verwijderingen en controleert de shell-identiteit tijdens 60 meetupdates; navigatie heen en terug blijft onderdeel van dezelfde controle. Dit moet opnieuw op een fysieke iPhone worden beoordeeld.
