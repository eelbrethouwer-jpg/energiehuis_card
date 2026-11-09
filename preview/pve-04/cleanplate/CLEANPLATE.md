# PVE-04 stap 1A — Clean plate van de goedgekeurde master

**Doel:** de goedgekeurde master-afbeelding (`image(20261109-092713).png`, 1330×748) omzetten naar een **tekstvrije, fotorealistische basislaag** (laag 1). Daarop komen de maskers en energieroutes (laag 2) en de echte kaarten met live waarden (laag 3).
**Gebruik:** uitsluitend privé in de eigen Home Assistant. **Budget:** €0, alleen gratis en lokaal draaiende software.

## 1. Analyse van de master

**Behouden:** woning (witte baksteen, donker dak, dakkapel, topgevel met lamellen), zonnepanelen, houten praktijkruimte met verlichte schuifpui en behandeltafel, donkere garage met wandlader, knalgroene hatchback, tuin met hortensia's, gazon, paaltjes, natte visgraatbestrating met reflecties, avondlucht en voorgrondbeplanting.

**Verwijderen:** 16 ingebakken overlays, exact vastgelegd in [`overlay-map.json`](overlay-map.json). Die bevat alleen coördinaten en geen beelddata. Het `overlay-mask` dekt met marge voor gloed ~27 % van het beeld.

| Overlay | Achtergrond eronder | Moeilijkheid | Methode |
|---|---|---|---|
| Logo + titel linksboven | lucht/boomkruin | middel | patch-clone |
| Datum/tijd/temperatuur-pil | lucht/wolken | laag | auto-inpaint |
| Kaart zonnepanelen | lucht/bomen | middel | patch-clone |
| Kaart praktijk + "Nog niet gekoppeld" | houten gevel, dakrand, wandlamp | **hoog** | herschilderen |
| Kaart huisverbruik | verlichte benedenramen met interieur | **hoog** | regenereren |
| Kaart Cupra | bomen/garagedak | middel | patch-clone |
| Kaart virtuele batterij | gazon/pad | middel | patch-clone |
| Kaart Net | natte bestrating, pad, planten | **hoog** | herschilderen |
| Gele stroom (zon → dak → huis) | lucht, **paneelraster**, dakpannen | **hoog** | herschilderen |
| Gestippelde praktijklijn | glas, gevel, tuin | middel | patch-clone |
| Cyaan stroom huis → net | pad, deur, planten | middel | patch-clone |
| Groene stroom huis → auto (+ gloed) | gevel, raam, planten, garagewand | **hoog** | herschilderen |
| Groene lijn kaart → auto | donkere garagewand | laag | auto-inpaint |
| Kenteken "CUPRA BORN" | nummerplaat | middel | herschilderen (blanco plaat of geen plaat) |
| Merklogo op de neus | lak | middel | herschilderen (lak) |

**Bronkwaliteit:**
- De GitHub-kopie is een verliesgevende WebP (q85). Gebruik als bron het **originele PNG** (SHA-256 `3c81b1f2…f708f0`).
- 1330×748 is 1× desktop. Voor DPR-2-schermen is ~2660 px nodig, dus opschalen (zie §3) of 1× accepteren (minder scherp op retina).
- Het beeld lijkt AI-gegenereerd. Controleer bij 200 % op typische artefacten (vervormde details in bomen, velgen en ramen) en herstel die mee.

## 2. Eén clean plate of aparte voor desktop en mobiel?

- **Desktop:** één clean plate uit de master volstaat; de compositie is 16:9.
- **Mobiel:** **niet** uit dezelfde bron te halen. Een staande uitsnede (9:16) van 748 px hoog is 421 px breed en toont alleen het midden (de woning). De praktijk (x 0–386) en de auto (x 938–1236) vallen eruit, terwijl beide op mobiel herkenbaar moeten blijven. Opties, in volgorde van voorkeur:
  1. **Aparte mobiele master in dezelfde stijl** (staand), daarna dezelfde clean-plate-workflow. Als die met de oorspronkelijke maaktool wordt gemaakt, is dat een externe dienst: alleen met akkoord van de eigenaar en alleen als het niets kost.
  2. **Mobiele compositie samenstellen** uit de schone desktopplaat: woning centraal, praktijk en auto naar voren gehaald, lucht en bestrating aangevuld. Dit gebeurt in GIMP of Krita. Het is haalbaar, maar het grootste retoucherisico: perspectief, schaduwen en reflecties moeten kloppen.
  3. **Tussenoplossing (nu actief):** mobiel valt automatisch terug op de placeholder, met de melding "Geen privébeeldlaag voor deze weergave".

## 3. Workflow (alles gratis en lokaal)

| Stap | Wat | Gereedschap |
|---|---|---|
| 0 | Bron: origineel PNG lokaal neerzetten, **buiten de repository** of in `preview/pve-04/private/` | — |
| 1 | `python3 preview/pve-04/tools/cleanplate.py mask --master <png>` → overlaymasker (in `private/`) | deze tool |
| 2 | `… draft` → automatische eerste versie. **Alleen bruikbaar** voor lucht/pil, titel en de donkere garagewand | OpenCV (BSD) |
| 3 | Retouche per gebied, van makkelijk naar moeilijk:<br>• lucht, bomen, gazon: Heal Selection (patchsynthese)<br>• bestrating, hout, gevel: Clone/Heal; **Perspective Clone** voor paneelraster en dakpannen<br>• middelgrote gebieden: lokale LaMa-inpainting<br>• moeilijke gebieden (ramen achter de huiskaart, praktijkgevel, Net-gebied): lokale generatieve vulling met een strak masker, daarna terug-clonen van echte details | GIMP + Resynthesizer (GPL); IOPaint (Apache-2.0, draait op CPU); Krita + Krita AI Diffusion (GPL, lokaal, GPU ≥ 6 GB) |
| 4 | **Gloed verwijderen:** de stromen verlichtten hun omgeving (geel op het dak, groen op gevel en struiken). Kleur en helderheid lokaal terugzetten naar de omgeving | GIMP (Curves/Color met masker) |
| 5 | Auto: kenteken → blanco plaat of geen plaat; logo → lak met de juiste reflectie; geen tekst | GIMP/Krita |
| 6 | Opschalen naar 2660×1496 (optioneel) en daarna controleren op artefacten | Upscayl (AGPL, Real-ESRGAN, lokaal) |
| 7 | `… qa --candidate private/…/mijn-retouche.png` → per overlay OK / CONTROLEREN / TE VLAK / RESTANT | deze tool |
| 8 | Occlusiemasker (auto, struiken, paaltjes) als PNG-alfa schilderen; ankerpunten en zones invullen in `scene-source.json` (sjabloon: [`scene-source.template.json`](scene-source.template.json)) | GIMP/Krita |
| 9 | `node preview/pve-04/tools/build-manifest.cjs --private preview/pve-04/private/<map>` → privémanifest | deze tool |
| 10 | Visuele vergelijking master ↔ clean plate ↔ cockpit (score 1–5) en **visueel akkoord van de eigenaar**; pas dan `status: approved` | — |

**Acceptatiecriteria per gebied:**
- geen tekst-, lijn- of gloedrest (QA `RESTANT` = 0);
- structuur doorlopend: het paneelraster en de dakpanlijnen lopen recht door, planken lopen door en de visgraat klopt;
- detailniveau gelijk aan de omgeving (QA-detailratio ≥ 0,7, plus visuele controle op 100 % en 200 %);
- licht, schaduw en reflectie consistent met de omgeving;
- geen herkenbare herhaling van clone-patches;
- het geheel oogt op het niveau van de master.

**Wanneer retoucheren, en wanneer opnieuw genereren of herschilderen:**
- **Retouche volstaat** bij homogene of herhalende texturen: lucht, gazon, bestrating, hout en donkere wanden.
- **Herschilderen of lokaal genereren** is nodig waar unieke structuur achter de overlay zat: ramen met interieur achter de huiskaart, de praktijkgevel met de wandlamp, en het paneelraster onder de gele stroom.
- **De hele master opnieuw genereren zonder UI** is de betere keuze als na retouche in een "hoog"-gebied herhaling, uitsmeren of een perspectieffout blijft.

## 4. Proof-of-concept (uitgevoerd)

- Masker en automatische draft zijn gemaakt van de master. De draft laat zien dat automatische inpainting **niet** volstaat: de QA-tool keurt 13 van de 16 gebieden af als "TE VLAK" (paneelraster en ramen worden een veeg).
- De keten werkt van begin tot eind: draft als privélaag → `build-manifest --private` → `?scene=private` → cockpit met echte kaarten, waarden, routes en maskering op de master-compositie. Mobiel valt correct terug.
- Alle beeldoutput staat in `preview/pve-04/private/` (genegeerd door git). Er is niets van gecommit.

## 5. Privacy en opslag

| Wat | Waar | Waarom |
|---|---|---|
| Code, validator, tools, tests, `overlay-map.json`, sjabloon, placeholderbeelden | GitHub (preview-branch) | bevatten geen privébeeld; alleen coördinaten |
| Master-PNG, clean plate, retouchebestanden, private maskers, `scene-source.json`, `scene-manifest.private.js` | **alleen lokaal** (`preview/pve-04/private/`, genegeerd) en in Home Assistant (`/config/www/energiehuis/pve04/` → `/local/energiehuis/pve04/`) | privébeeldlaag, eigen gebruik |
| Rechtenregel van privé-assets | alleen in het privémanifest, met `publicAllowed: false` (de validator dwingt dit af) | — |

Technische waarborgen:
- `.gitignore` bevat `private/`, en een test controleert dat er geen bestand onder `private/` wordt bijgehouden.
- `cleanplate.py` en `build-manifest --private` weigeren output buiten `private/`.
- Een privémanifest met een publiek gelabelde rechtenregel is ongeldig.
- `assetBase` en de manifest-URL zijn beperkt tot `private/…` of `/local/…` op dezelfde origin. Zonder privélaag gebruikt de cockpit automatisch de placeholder.

**Let op, bestaande situatie:** de master-WebP staat al publiek op GitHub (`preview/pve-03/reference/approved-visual-20261109.webp`, op de branches `preview/chatgpt-pve03-approved-reference`, `preview/claude-premium-pve03` en `preview/claude-premium-pve04`). Een verwijdercommit haalt het bestand niet uit de geschiedenis. Volledig verwijderen vraagt het verwijderen van branches of het herschrijven van de geschiedenis. Dat is een besluit van de eigenaar en is niet uitgevoerd.
