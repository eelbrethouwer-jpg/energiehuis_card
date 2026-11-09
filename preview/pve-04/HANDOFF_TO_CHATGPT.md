# Overdracht aan ChatGPT — PVE-04 stap 1A: clean plate van de goedgekeurde master

**Status: DEMO — niet productie.** Geen PR, merge, tag, release of HACS-publicatie. De publieke scènelaag blijft **placeholder**. De privélaag is in dit stadium alleen een **concept (automatische draft)** en is **niet visueel goedgekeurd**.
Opgesteld door Claude Code, 9 november 2026. Opdracht: optie A (master als primaire beeldbasis → clean plate → cockpit erbovenop).

## 1. Branchstatus

| | |
|---|---|
| Branch | `preview/claude-premium-pve04` |
| Uitgangs-HEAD (gecontroleerd) | `9357ac91b5b8e556297b7d42e1ef91ded5d8c093` (remote = lokaal vóór aanvang) |
| `main` | `62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9` (ongewijzigd) |
| HEAD na deze ronde | de commit die dit bestand bijwerkt (zie het chatbericht voor de exacte SHA) |

De diff blijft uitsluitend binnen `preview/pve-04/`. Er is **geen privébeeld gecommit**: `private/` staat in `.gitignore` en een test controleert dat.

## 2. Analyse van de master (details: [cleanplate/CLEANPLATE.md](cleanplate/CLEANPLATE.md))

- **Te verwijderen:** 16 overlays, vastgelegd in `cleanplate/overlay-map.json` (alleen coördinaten): 9 tekst-, kaart- en pilgebieden, 5 stroomlijnen met gloed, het kenteken en het merklogo. Het masker dekt met gloedmarge ~27 % van het beeld.
- **Moeilijkste gebieden:**
  - de gele stroom over het **paneelraster en de dakpannen**;
  - de huiskaart over de **verlichte benedenramen**;
  - de praktijkkaart over de **houten gevel en wandlamp**;
  - de Net-kaart over **natte visgraat met reflecties**;
  - de **gloed** van de groene en gele stroom op gevel en dak.
- **Bron:** de GitHub-kopie is een verliesgevende WebP van 1330×748. Gebruik het originele PNG als bron. Voor DPR 2 is opschalen nodig (lokaal en gratis) of 1× accepteren.
- **Desktop of mobiel:** desktop kan uit de master. Mobiel **niet**: een 9:16-uitsnede toont alleen de woning en verliest praktijk en auto. Er is dus een aparte mobiele master in dezelfde stijl nodig, of een samengestelde mobiele compositie. Tot die er is, valt mobiel automatisch terug op de placeholder.

## 3. Workflow (gratis en lokaal)
- **`tools/cleanplate.py`:** maakt het overlaymasker, een automatische draft (OpenCV), een QA-rapport per overlay (`OK` / `CONTROLEREN` / `TE VLAK` / `RESTANT`) en een overzichtsblad. Alle beeldoutput gaat alleen naar `private/`; output elders wordt geweigerd.
- **Retouche:** GIMP + Resynthesizer, waaronder Perspective Clone voor het paneelraster; IOPaint (LaMa, draait op de CPU); Krita AI Diffusion (lokaal, GPU) voor de moeilijke gebieden; Upscayl om op te schalen. Allemaal gratis en lokaal.
- **Acceptatiecriteria en beslisregels:** opgenomen in `CLEANPLATE.md` §3, inclusief wanneer retouche volstaat en wanneer herschilderen of opnieuw genereren nodig is.

## 4. Architectuur en privacy (geïmplementeerd)

| Onderdeel | Uitvoering |
|---|---|
| Privémanifest | `build-manifest.cjs --private <map>` → `<map>/scene-manifest.private.js` (`visibility: private`, `assetBase`). Alleen mappen onder `private/` zijn toegestaan. |
| Laden | `?scene=private[&privateManifest=…]` laadt het privémanifest via een `<script>`-tag (same-origin). Alleen `.js` onder `private/` of `/local/` is toegestaan (`safeManifestUrl`). |
| Per compositie | Privélaag als die er is; anders terugval op de publieke placeholder, met melding. Een ontbrekend, ongeldig of onveilig manifest ⇒ placeholder, zonder excepties. |
| Validator | `visibility`; `assetBase` alleen `private/…/` of `/local/…/`; een privémanifest mag één compositie hebben; privérechten moeten `publicAllowed: false` dragen. |
| Repository | Publiek zijn code, tools, tests, de overlay-map en het sjabloon (alleen getallen). Privé zijn master-PNG, clean plate, maskers, `scene-source.json` en het privémanifest (`private/` lokaal; `/config/www/energiehuis/pve04/` in Home Assistant). |
| DEMO-veiligheid | Ongewijzigd: geen Home Assistant, geen opslag, geen bediening; het model en de routeregels zijn ongewijzigd. |

**Proof-of-concept:** de master → overlaymasker → automatische draft → privémanifest → cockpit met live kaarten, waarden, routes en maskering op de master-compositie (desktop). Mobiel valt terug. De QA keurt de draft terecht af: 13/16 gebieden zijn "TE VLAK". **De draft is geen eindbeeld**; de screenshots zijn alleen privé gedeeld en niet gecommit.

**Bestaande situatie:** de master-WebP staat al publiek op drie branches (`preview/pve-03/reference/…`). Volledig verwijderen vraagt het verwijderen van branches of het herschrijven van de geschiedenis. Dat is een besluit van de eigenaar en is niet uitgevoerd.

## 5. Testresultaten (lokaal; Node v22.23.4, Chromium 153.0.8010.12, WebKit 26.6)

| Controle | Resultaat |
|---|---|
| `node scripts/build.cjs --check` / `node --check energiehuis-card.js` | PASS / PASS |
| Productie-Node UTC / Amsterdam | **359/359 / 359/359** |
| Productie-Chromium `mobile-visual`, `regisseur-cockpit`, `stroomvergelijker` | 3× PASS (zonder live tarieven) |
| **PVE-04 Node UTC / Amsterdam** | **79/79 / 79/79** (+9: privacy, overlay-map, weigering van output buiten `private/`, privémanifest, veilige URL's) |
| **PVE-04 browser Chromium / WebKit** | **26/26 / 26/26** (+1: privélaag synthetisch, mobiele terugval, ontbrekend/onveilig manifest) |
| `tests/perf.cjs` | desktop en mobiel bij 4×: standaardvariant 60 fps, p95 16,7 ms → DOEL |
| `tools/build-manifest.cjs --check` | PASS |

## 6. Productie ongewijzigd
`git diff --name-only 9357ac9..HEAD` bevat alleen `preview/pve-04/…`. De build-check is byte-identiek en de productietests en -suites zijn groen.

## 7. Advies voor de volgende stap (1B: echte privé clean plate maken en koppelen)
1. Eigenaar: het originele master-PNG lokaal beschikbaar maken (niet op GitHub).
2. Retouche volgens `CLEANPLATE.md` §3, gebied voor gebied, met QA na elke ronde. Begin met de "laag"- en "middel"-gebieden, daarna de vijf "hoog"-gebieden, met lokale generatieve vulling waar nodig.
3. Occlusiemasker (auto, struiken, paaltjes) en ankerpunten/zones voor de master-compositie vastleggen in `scene-source.json`. Het sjabloon is ingevuld met eerste waarden die nog verfijnd moeten worden, bijvoorbeeld de laadklep aan de achterkant van de auto.
4. Een besluit over mobiel: een aparte staande master (voorkeur), of een samengestelde compositie.
5. Een vergelijkingsblad (master, clean plate desktop, clean plate mobiel, volledige cockpit) met scores van 1–5, en daarna het **visuele akkoord van de eigenaar** → `status: approved` in het privémanifest.
6. Pas daarna, apart en met akkoord, de koppeling in de echte Home Assistant-kaart (productiefase; niet in deze scope).

## 8. Reviewvragen (read-only)
1. Is de scheiding openbaar/privé (overlay-map en sjabloon publiek, beeld en maskers privé) zoals gewenst?
2. Is de mobiele aanpak (aparte staande master als voorkeur, nu terugval op de placeholder) akkoord?
3. Moet de reeds publieke master-WebP van de branches worden gehaald? Dat vraagt een besluit van de eigenaar over branchverwijdering of het herschrijven van de geschiedenis.
