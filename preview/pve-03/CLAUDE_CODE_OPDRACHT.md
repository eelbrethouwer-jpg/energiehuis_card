# Energiehuis Premium Live Cockpit — Claude Code Fase 1 (PVE-03)

**Status:** opdracht voor een geïsoleerde, visueel hoogwaardige **DEMO**. Geen productie-inbouw, publicatie of fysieke energiebewering.
**Opdrachtgever:** eigenaar repository `eelbrethouwer-jpg/energiehuis_card`.
**Architect/reviewer:** ChatGPT. **Uitvoerder:** Claude Code.
**Datum:** 9 november 2026.

## 1. Exacte startpunten en branchstrategie

- Repository: `eelbrethouwer-jpg/energiehuis_card`.
- Gecontroleerde `main` bij voorbereiding: `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (merge PR #53).
- Werk uitsluitend op **`preview/claude-premium-pve03`**, vooraf aangemaakt vanaf deze exacte `main`, met deze opdracht en F2-referentie. Controleer `git ls-remote origin refs/heads/main` en de actuele preview-HEAD bij start. Als ze inmiddels zijn veranderd: stop bij een onduidelijke baseline en rapporteer het verschil. Geen force pushes.
- PVE-01 blijft ongewijzigd op `preview/chatgpt-premium-pve01`, HEAD `7f04771c8ab5a1cab71cd5754bde5de66dbb6ab2`.
- Alle nieuwe implementatiebestanden binnen **`preview/pve-03/`**. Referentie `preview/pve-03/reference/claude-f2-standalone.html` is een byte-identieke kopie van de eerder aangeleverde F2 en blijft ongewijzigd.
- Niet schrijven naar `main`, `src/`, `energiehuis-card.js`, `hacs.json`, `scripts/build.cjs`, `.github/workflows/`, bestaande `tests/` of andere previewbranches.
- **Geen merge, tag, release, HACS-publicatie of startschermactivering.** Een draft-PR pas na een eerste onafhankelijke diffcontrole en met heldere DEMO-scope. Bij twijfel eerst alleen branch/commit/handoff, geen PR.

## 2. Verplichte inspectie vóór bouwen

Lees op de actuele `main`: `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md` (en verifieer dit tegen remote), `src/README.md`, `scripts/build.cjs`, `.github/workflows/v17-tests.yml`, `.github/workflows/stroomvergelijker-browser.yml`, `.github/workflows/validate.yml` en `src/legacy/16-regisseur-cockpit.js`. Controleer `src/legacy/00-foundation.js` voor huidige entiteitsdefaults en `src/legacy/02-card-shell.js` voor render- en navigatiepatronen. Bekijk alle vier bestanden op `preview/chatgpt-premium-pve01`. Bestudeer de F2-code onder `preview/pve-03/reference/`.

De repo bevat een geordende, klassieke JS-build; forceer geen React-, Vite- of ESM-migratie voor de HACS-kaart. Je bouwt nu alleen een **zelfstandige webpreview**, niet een geactiveerde Lovelace-kaart.

## 3. Gecontroleerd goedgekeurde visuele norm

De producteigenaar heeft op 9 november 2026 het fotorealistische conceptbeeld expliciet goedgekeurd (ChatGPT-bijlage `image(20261109-092713).png`, 1330×748). Als dit bestand niet lokaal beschikbaar is, gebruik de beschrijving hieronder en vermeld dat de exacte visuele pixelreferentie ontbreekt. Blokkeer de architectuur niet. Vraag de gebruiker alleen om die ene afbeelding wanneer precieze beeldvergelijking anders niet mogelijk is.

**Scène:** cinematografische vroege avond, realistische Nederlandse vrijstaande woning centraal, lichte gevel met donker hellend pannendak met zonnepanelen, grote warme ramen, natuurlijke tuin, subtiele buitenlampen, natte/reflecterende bestrating. Links een apart houten praktijkgebouw met groot raam, rechts een prominente **knalgroene Cupra Born** op de oprit bij de laadpaal. Realistische perspectief-, licht- en schaduwverhoudingen. Rustige high-end glass-UI, geen dominante losse blokken of cartoon-SVG als eindbeeld.

**Vaste posities:** linksboven Zonnepanelen; rechtsboven virtuele batterij (**simulatie, geen fysieke opslag**); huis in het midden met huisverbruik; **Net exact midden onder het huis**; praktijkruimte linksonder met **`Nog niet gekoppeld`** en geen verzonnen kW; Cupra rechts/onder met laadstatus, SOC en vermogen. **Alfen geen eigen hoofdtegel**.

**Belangrijk:** gebruik **geen** complete screenshot inclusief cijfers of statische stroomlijnen als achtergrond. Lever uitsluitend geoptimaliseerde, tekstvrije **visuele lagen/assets**. Alle waarden, statuswoorden, labels, routekleuren en lichtdeeltjes worden afzonderlijk in de runtime gerenderd. Zodoende blijven cijfers en energierichting echt dynamisch. Geef provenance en technische afmetingen van elk gebruikt beeldbestand; gebruik geen ongecontroleerde logo's of foto's van derden.

## 4. PVE-03 technische indeling

Binnen `preview/pve-03/` minimaal:

- `index.html` — zelfstandige, direct te openen preview, met duidelijke permanente `DEMO — fictieve meetwaarden`-aanduiding.
- `styles.css` — design tokens, scenery, interactieve glaspanelen, twee doelbewust ontworpen composities desktop én mobile, reduced-motion, 200% tekst.
- `assets/` — geoptimaliseerde realistische scène- en objectlagen (WebP/AVIF met fallback waar nodig), inclusief afzonderlijke alternatieve mobile-compositie; een vectorfallback mag alleen noodvoorziening zijn.
- `model.js` — pure, testbare synthetische DEMO-fixtures; scenario's voor PV, import, export, laden, nacht, offline, stale, onbekende eenheid, omgekeerde P1, praktijk niet gekoppeld. **Geen echte Home Assistant-sensor- of serviceverbinding.**
- `flows.js` — fysieke-routeweergave slechts in expliciete DEMO-scenario's; componenten voor zon→huis, net→huis, huis→net, huis→Cupra; naar praktijk uitsluitend als DEMO en expliciet als gesimuleerd aangeduid. Virtuele batterij nooit als fysieke stroomroute.
- `app.js` — kaartinteractie, semantische `button`-elementen, detailpanelen, keyboard/focus/Escape, event/lifecycle-opruiming en stabiele updates zonder volledige DOM-rebuild.
- `tests/` — Node-tests voor scenario- en veiligheidsinvarianten; browserschermtests voor viewports en 50 updates.
- `README.md` — preview starten, asset/licentie- en fallbackmatrix, testresultaten, beperkingen en afbeeldingen per viewport.
- `HANDOFF_TO_CHATGPT.md` — de feitelijke overdracht met exacte HEAD-SHA, bestandendiff, testcommando's/resultaten, risico's, screenshots en resterend werk.

Bestandsgrootte/performance: beeldlagen bij voorkeur totaal <= 1,5 MB voor desktop-startweergave en <= 1 MB op mobiel; rapporteer metingen en compressie. Gebruik DPR-bewuste rendering en pauzeer de animatie bij verborgen tab en bij `prefers-reduced-motion`. Geen timers, observers of rAF-callbacks laten hangen na unmount. Niet herstarten van deeltjes bij iedere sensorupdate.

## 5. Route-contract en veiligheidsgrens

- **DEMO**: bedienbare scenario's met fictieve vermogenswaarden, permanent als fictief gelabeld. `PV→huis` goud, `net→huis` warm oranje/blauw (onderscheid import), `huis→net` groen, `huis→Cupra` cyaan/groen, `praktijk` optioneel turkoois (maar bij niet gekoppeld **inactief**), batterij paars **statisch, simulatie**. Richting is belangrijker dan opzichtigheid.
- **Geen LIVE-modus** binnen fase 1. Niet suggereren dat scene flags zijn geverifieerd; geen Home Assistant-schrijfacties, `callService`, `callWS`, `fetch` van sensoren of nieuwe opslagkeys.
- Bij ontbrekende, oude of ongeldige fixturewaarden: geen actieve fysieke claim. Verwijder onmiddellijk actieve state bij ongeldige updates. De oude F2 heeft een `graceMs: 10000` die na ongeldige meetupdate een route nog `active=true` laat. **Neem die semantiek niet over**; alleen een passieve visuele fade-out zonder actieve-route-indicatie mag.
- Een rekenkundig sluitende energiebalans bewijst niet dat P1-signaal, GoodWe AC, Alfen achter de P1 en de huissensor onafhankelijk zijn gecontroleerd. Laat alle echte verificatieflags buiten scope.
- Praktijkruimte is nog niet gekoppeld; geen fictieve actuele meting. Tel geen fictieve praktijksensor op bij huisverbruik. De echte Cupra kan via Alfen gemeten worden, maar de UI hoeft Alfen niet als afzonderlijke tegel te tonen.

## 6. Vormgeving en mobile-first acceptatie

Een **echte** visuele verbetering tegenover de PVE-01/F2 SVG-noodvariant is vereist: geen cosmetische refactor van bestaande vectorhuizen. Het resultaat moet herkenbaar dicht bij de goedgekeurde fotorealistische referentie liggen, met zichtbare gevelstructuur, warm interieurlicht, panelen, tuin, practice building en Cupra. Bewaar ruimte voor overlays; voorkomen dat kaarten het huis volledig bedekken.

Desktop: 1440×900 en 1330×748, huis ruim centraal, Net midden eronder, PV boven links, batterij boven rechts, praktijk links, groene Cupra rechts. Mobiel: 320×700 en 390×844, *eigen compositie* met alle zes onderdelen, Cupra en praktijk als herkenbare objecten (dus niet simpelweg hide op mobiel), korte routes zonder overlap, hoofdwaarden binnen de eerste viewport waar mogelijk. Tablet: 768×1024. Interactieve targets minimaal 48×48 px; ook bij 200% tekst geen afgesneden waarde of horizontale scroll. Focus zichtbaar, Escape sluit detailpaneel en herstelt focus. Test grote en kleine waarden, duizendtallen, `—`, offline en lange statuslabels.

## 7. Exact testplan / kwaliteitsgates

Voer uit en rapporteer exact, onderscheid baseline, preview en echte apparaatacceptatie:

```sh
# Verplichte onaangetaste productiechecks
node scripts/build.cjs --check
node --check energiehuis-card.js
TZ=UTC node --test tests/*.test.cjs
TZ=Europe/Amsterdam node --test tests/*.test.cjs

# Nieuw: concrete bestandsnamen aanpassen aan je implementatie
node --test preview/pve-03/tests/*.test.cjs

# Relevante bestaande Chromium suites (na setup zoals workflow)
node tests/browser/mobile-visual.cjs
node tests/browser/regisseur-cockpit.cjs
node tests/browser/stroomvergelijker.cjs
# + nieuwe Playwright browsercases voor PVE-03
```

Browseracceptatie minimaal: 320/390/768/1330/1440 breed, 200% tekst, reduced-motion, offline/stale/nacht, P1-tekenomkering, negatieve huissensor, 50 hertekeningen zonder flikker/routeherstart, geen consolefouten/overflow/overlap, keyboardfocus, ESC, minstens twee gelijktijdige scène-instanties. Meet CPU-throttling/fps, memory en assetgewichten; noem gebruikte Chromium-versie. Safari/WebKit en echte iPhone duidelijk als **niet getest** melden indien niet uitgevoerd.

Screenshots onder `preview/pve-03/screenshots/`: desktop 1330/1440, tablet 768, mobiel 320/390. Voeg een visuele vergelijking met PVE-01 en de referentiefoto toe indien die bereikbaar is. Geen `PASS` claim zonder daadwerkelijk testbewijs. Na nieuwe push alle checks opnieuw op exacte HEAD.

## 8. Oplevering

Lever een op GitHub leesbare en zelfstandig startbare scène op dezelfde branch `preview/claude-premium-pve03`. Startinstructie liefst:

```sh
cd preview/pve-03
python3 -m http.server 8000
# open http://localhost:8000
```

Geef een handoff met:
1. exacte baseline SHA, branch, HEAD en diff;
2. werkende URL/commando en screenshots;
3. gebruikte assets, bron/herkomst en bestandsgroottes;
4. testcommando's, aantallen PASS/FAIL, browser en timezones;
5. wat nog niet geverifieerd is, met bekende F2-risico's en regressies;
6. onafhankelijke reviewer-vragen (ChatGPT);
7. status **DEMO** / niet productie, en geen merge/release.

**Reviewoordeel wordt pas na onafhankelijke controle gevraagd.** Deze opdracht autoriseert uitsluitend previewontwikkeling en de daarvoor noodzakelijke commits/pushes op de genoemde branch, niet een productie-integratie.
