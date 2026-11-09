# Energiehuis Premium Live Cockpit — PVE-01 (geïsoleerde designdemo)

**Status: uitsluitend DEMO. Geen Home Assistant-integratie of productiecode.**

## Herkomst
- Repository: `eelbrethouwer-jpg/energiehuis_card`
- Afgesproken GitHub-branch: `preview/chatgpt-premium-pve01`
- Baseline main bij aanmaken: `7308d3a72de5073f398f26041404d0e400785d0a`
- De gehele implementatie staat **uitsluitend onder `preview/pve-01/`**.
- Deze preview is een standalone HTML met **synthetische data**; de animaties illustreren de scenario's en leveren geen bewijs van fysieke energiestromen.

## Bekijk de preview
Open `energiehuis_live_cockpit_premium_preview.html` in een browser. Het document vereist geen build en geen netwerkverzoeken. De knoppen kiezen fictieve scenario's: zon/teruglevering, netafname/laden, nacht en offline.

Lokaal serveren kan ook:

```sh
cd preview/pve-01
python3 -m http.server 8000
# open http://localhost:8000/energiehuis_live_cockpit_premium_preview.html
```

GitHub toont bronbestanden en publiceert deze branch **niet** als GitHub Pages. Er is daarom geen officieel gehoste publieke preview-URL.

## Tests
```sh
node --check preview/pve-01/energiehuis_premium_preview_tests.cjs
node preview/pve-01/energiehuis_premium_preview_tests.cjs
```

Deze tests controleren demo-gedrag, niet de echte HA-integratie. De eerdere desktop- en mobiele screenshots zijn beschikbaar in het oorspronkelijke lokale reviewpakket; Claude kan eigen screenshots op 320, 390, 768 en 1440 px maken vanuit dit HTML-bestand. **Er zijn op deze branch geen binaire screenshotbestanden opgenomen.**

## Grenzen
- Niets onder `src/`, `scripts/`, `tests/`, de HACS-bundel, `hacs.json`, GitHub-workflows of de bestaande navigatie is aangepast.
- Geen service calls, laadbesturing, opslag, HA-configuratie of live sensorwaarden.
- Praktijkruimte toont **niet gekoppeld**; virtuele batterij blijft expliciet virtueel.
- De animaties in deze **DEMO** mogen nooit zonder fysieke meetketenverificatie worden overgezet naar een productiekaart.
- Geen PR, merge, tag, release of HACS-publicatie.

Zie [de technische overdracht](./ENERGIEHUIS_PVE01_HANDOFF.md) voor ontwerpkeuzes en testbeperkingen.
