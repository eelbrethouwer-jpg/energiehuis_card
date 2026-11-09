# Overdracht aan ChatGPT — PVE-04 RC2 (aangepaste uitvoering: P2, P3, P4)

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie. Geen nieuwe master. De productiekaart is ongewijzigd.
Opgesteld door Claude Code, 9 november 2026. Opdracht: "RC2 aangepaste uitvoering": P1 gestopt, alleen P2, P3 en P4.

## 1. Branchstatus

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Uitgangs-HEAD (gecontroleerd) | `b6259fdc1e401c670a120d623e2b425998e79415` (remote = lokaal vóór aanvang) |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| HEAD na deze ronde | de commit die dit bestand bevat (exacte SHA in het chatbericht) |

## 2. P1 — NIET opgelost (expliciet)

De ingebakken lichtlijnen blijven bij 0 W en offline zichtbaar. Op basis van het besluit worden ze **niet meer automatisch bewerkt**:

- De RC1-rustlagen (zichtbare wazige banen) zijn uit de cockpit verwijderd.
- Het RC2-prototype (zonegebonden correctie) haalde de kwaliteitseis niet: zon, net en Cupra NO-GO. Dat prototype is niet gecommit.

De master is nu **exact en onbewerkt** de achtergrond. De lijnen zijn expliciet **decoratief**:

- **Legenda** onder het beeld: "De lichtlijnen in de afbeelding zijn decoratief en tonen geen actuele stroom. Actuele stroom: bewegende lichtpunten en de kaarten."
- **Alt-tekst** en **detailpaneel**: regel "Lichtlijn in beeld: decoratief — geen actuele stroomindicator".

## 3. Wat is gebouwd

| Punt | Uitvoering |
|---|---|
| **P2 Glaskaarten** | Elke kaart heeft een **ondoorzichtig basisvlak**. Het kleurverloop wordt eenmalig in de browser bemonsterd uit de rand boven en onder de ingebakken kaart (~16–20 ms op de hoofdthread). Daarover ligt een halfdoorzichtige glaslaag (55 %), met een gekleurde rand (accent 82 %), binnen- en buitengloed, radius 24 (mastermaat) en groot wit type met een kleinere eenheid. Iconen hebben de accentkleur en gloed. De praktijkstatus "Nog niet gekoppeld" is een knop-pil, zoals in de referentie. Posities zijn ongewijzigd (afdekmaat uit `master-scene.js`). Zonder leesbare canvas valt het basisvlak terug op een vaste tint. |
| **P3 Mobiel** | Drie weergaven. **Compact** (onder 900 px): dezelfde glaskaarten op de master, alleen de waarde (plus pijl bij het net of "Simulatie" bij de batterij). Geen dubbele tegelset, tikvlakken onzichtbaar vergroot tot ≥ 48 px, scenario's standaard ingeklapt (`<details>`). Huis, praktijk en Cupra blijven volledig in beeld; beeld, legenda en samenvatting passen in de eerste schermhoogte (390 × 844: samenvatting eindigt op 425 px). **Lijst** (smaller dan 21 × de tekstgrootte, of tekst > 125 %): lege glasvlakken op het beeld en een leesbare lijst eronder. Op desktop staan de scenario's standaard open; dezelfde inklapknop werkt daar ook. |
| **P4 Netrichting** | Teruglevering = cyaan kaartaccent, "↓ naar net", lichtpunten cyaan huis → net. Afname = oranje kaartaccent, "↑ van net", lichtpunten oranje net → huis. De **ingebakken netlijn blijft cyaan**; de cockpit claimt niets anders. Richting, pijl en kleur verschijnen **alleen bij een actieve netroute**. Anders: "Richting niet bevestigd" (bij een tegenstrijdige meetketen met toelichting). Lichtpunten alleen bij geldige, actuele, actieve routes; bij 0 W, offline en verouderd staan ze stil en verdwijnen ze. Bij reduced motion: pijlen in de routekleur. |

**Bevinding tijdens het testen (opgelost):** bij "P1 omgekeerd (niet gecorrigeerd)" en "Negatieve huissensor" toonde de Net-kaart eerst een richtingspijl en -kleur terwijl de route stilstond. Dat is nu "Richting niet bevestigd (meetketen tegenstrijdig)", zonder pijl of richtingskleur.

## 4. Tests (lokaal uitgevoerd in deze sessie)

| Controle | Resultaat |
|---|---|
| PVE-04 node-tests (UTC en Europe/Amsterdam) | **84/84** per tijdzone |
| Productietests (UTC en Europe/Amsterdam) | **359/359** per tijdzone |
| `node scripts/build.cjs --check` | Byte-identiek, SHA-256 `9f4fce00…6388` |
| Master-suite `tests/master.cjs` | **Chromium 153: 31/31**, **WebKit 26.6: 31/31** |
| Regressie placeholder/privélaag `tests/browser.cjs` | **Chromium 26/26**, **WebKit 26/26** |
| Kaartdekking en ondoorzichtigheid | 8 viewports (320–1920 px) × 2 scenario's (incl. grote waarden en lange labels): geslaagd; 200 % tekst ⇒ lijst, geslaagd |
| Doorschijntoets (kaartinhoud verborgen) | Witte glyfpixels **0,0000** voor alle kaarten en de pil op 390, 768 en 1440 px |
| Netrichting voor alle 14 scenario's | Kaart, kleur, pijl, tekst en lichtpunten consistent; 0 W en offline zonder lichtpunten |
| Master onaangetast | Stage = alleen beeld + lichtpuntlaag + afdekvlakken; lichtpuntlaag leeg (0 pixels) bij 0 W en offline |
| Performance | 60 fps, p95 16,7 ms bij 4× CPU (desktop en mobiel, `perf.cjs`); hoofdthread 16–20 ms; heapgroei ~0,23 MB na 200 updates |

Screenshots (Chromium en WebKit): `screenshots/master-{desktop,mobiel}-{actief,0w,offline,afname}[-webkit].jpg`.

## 5. Beperkingen

1. **P1 niet opgelost:** bij 0 W en offline blijven de gloeiende ingebakken lijnen zichtbaar (decoratief, met legenda).
2. Compact op 360–390 px: waarden ~11 px, titels pas vanaf ~560 px beeldbreedte.
3. De netlijn in het beeld blijft cyaan bij afname; alleen de kaart en de lichtpunten worden oranje.
4. Niet getest op echte Safari of een fysiek toestel (alleen Playwright-WebKit, headless).
5. Kenteken "CUPRA BORN" en merklogo blijven in beeld (geaccepteerd).

## 6. Bevestigingen

Geen nieuwe master, geen beeldbewerking van de master, geen hand- of generatieve retouche, geen PR, merge, tag of release, geen HA/HACS-integratie en geen productiewijziging. Geen privébestanden gecommit; het RC2-P1-prototype staat alleen privé.

## 7. Voorgestelde volgende stap

Visuele beoordeling door de eigenaar en ChatGPT van de screenshots (desktop/mobiel × actief, 0 W, offline en afname). Daarna een besluit of de decoratieve lijnen bij 0 W/offline acceptabel zijn, of dat P1 later via een apart traject (nieuwe master zonder ingebakken lijnen) wordt opgepakt.
