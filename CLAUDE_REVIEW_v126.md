# Onafhankelijke Claude-review — Energiehuis Visual Experience

## Reviewopdracht
Review uitsluitend de voorgestelde PR **feature/v126-visual-experience-rc** in `eelbrethouwer-jpg/energiehuis_card` tegenover de daadwerkelijke actuele `main`. Controleer de SHA vóór de review, raad niet welke versie actueel is. Werk **read-only**: niets aanpassen, mergen, taggen of publiceren.

## Context
Gebruiker ervaart het iPhone-dashboard als onoverzichtelijk en saai, met lange scrollpagina's en herhaalde kaarten. Het doel van de PR is een visueel hiërarchische mobiele cockpit met vier hoofdbestemmingen, behoud van sensoren/metingen/grafieken/historie, en geen nieuwe bediening van Alfen.

## Controleer onafhankelijk
1. **Bron/build-invariant:** `src/legacy/16-regisseur-cockpit.js` is het laatste fragment in `scripts/build.cjs`. `energiehuis-card.js` moet byte-identiek uit alle fragmenten worden opgebouwd. Geen versieclaim of stille publicatie.
2. **Vier navigatiebestemmingen:** Home, Laden, Inzicht, Meer. Open en sluit het Inzicht-menu via tik/keyboard, selecteer Cupra, Batterij of Kosten. Test hertekening terwijl menu open is; geen verlies van mogelijkheden. Controleer actieve tabmarkering en aria.
3. **Legacy compatibiliteit:** de acht bestaande meterkaarten, hun detailknoppen, de uitgebreide grafiek, historische sliders en energieanalyses blijven toegankelijk nadat de nieuwe details-sectie is geopend. Test detailpinning vanuit cockpit én directe legacy meterklik.
4. **UI:** werkelijke Chromium-screenshots en bounding-boxchecks op 320, 390, 768, 1280 px. Geen clipping, horizontale overflow of overlap met Home Assistant appbar/onderbalk. Controleer 200% tekst, contrast, nachtelijke nulwaarden, ontbrekende GoodWe-/huissensoren en reduce-motion.
5. **Hergebruik & regressies:** bevestig dat er geen wijzigingen zijn in EV-planning, maandbudgetformule, P1/batterijrekenmotoren, contractopslag, `charge_control_enabled`, HA-scripts, `callService` of localStorage keys. Bestaande CI + praktijkacceptatie; onderscheid nieuw getest, reeds getest en nog niet getest.
6. **Dynamische hertekening:** Home Assistant kan tientallen live updates sturen; controleer dat het openen van `details` niet dichtklapt door DOM-herbouw. Controleer ook menusluitgedrag bij navigatie.
7. **Foutzoekvraag:** inspecteer het effect van `_render` wrappers die de DOM herschrijven en van het opnieuw toevoegen van `toggle`-eventhandlers aan details tijdens live updates. Kijk naar eventuele racecondities bij `_schedule`.

## Gewenste rapportage
- Exacte main-SHA en PR HEAD
- GO / GO MET OPMERKINGEN / NO-GO
- Bevindingen HOOG / MIDDEL / LAAG, locatie (bestand/regelnr), concrete reproduceerstappen en minimale veilige fix
- Testmatrix met werkelijk uitgevoerde tests en hun resultaten
- Bevestiging: niets gemerged, niets gepubliceerd
- Voorstel kleinste patch, indien nodig

**Deze opdracht is een overdracht voor Claude; het is geen bewijs dat Claude deze review al heeft uitgevoerd.**
