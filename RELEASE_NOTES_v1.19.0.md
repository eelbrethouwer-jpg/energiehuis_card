# Energiehuis v1.19.0 — Batterij Datakwaliteit

## Nieuw
- **Datakwaliteitscontrole** op de pagina Batterij, in een compact uitklapbaar onderdeel.
- Actuele dekking van HomeWizard/P1-uurtotalen en historische uurprijzen voor de gekozen 7/30-dagensimulatie.
- Een **handmatige, read-only Recorder-controle** met één dag vijfminutenstatistieken (gisteren) en één week uurstatistieken van circa een jaar geleden.
- Duidelijke afzonderlijke resultaten voor P1-afname en teruglevering samen, plus onafhankelijke foutmelding als één Recorder-steekproef niet beschikbaar is.
- De uitslag blijft zichtbaar als de kaart opnieuw tekent; geen automatische achtergrondqueries of opdrachten naar apparaten.

## Doel en interpretatie
Met deze controle kunnen we op basis van je **eigen Home Assistant-Recorder** besluiten of de bestaande HomeWizard-stijl batterijgrafiek later met echte vijfminutenstappen kan werken en of voldoende oude uurstatistieken beschikbaar zijn voor een verantwoorde jaarstudie.

**Een volledig gemeten vijfminutendag bewijst niet dat alle zeven dagen beschikbaar zijn. Een oude week bewijst niet dat een compleet jaar beschikbaar is.** De bestaande batterijgrafieken blijven daarom per uur; de jaarweergave blijft uitgeschakeld. Er worden geen gegevens, tarieven, prestaties of besparingen verzonnen.

Home Assistant bewaart vijfminutenstatistieken standaard slechts zolang Recorder-geschiedenis bewaard blijft (standaard 10 dagen), terwijl uurstatistieken voor geschikte sensoren langdurig bewaard blijven. Bestaande Home Assistant-instellingen en eventuele Recorder-uitzonderingen kunnen dit veranderen.

## Wat behouden blijft
De gecombineerde paarse/groene HomeWizard-stijl grafiek met berekende SOC, 5/10/15-kWh-scenario's, 7/30-dagenvergelijking, financiële analyse, stroomvergelijker, Cupra en Alfen Active Load Balancing. Geen nieuw YAML, geen aanpassingen aan laadbesturing en geen Home Assistant-servicecalls.

## Tests
- JavaScript, HACS en Node-regressies met meetgaten, tariefdekking, vijfminuten-overlap en onafhankelijke queryfouten.
- Chromium-tests met fictieve Recorder-gegevens, inclusief de nieuwe knop en mobiele breedtes.
- Definitieve GitHub-publicatieworkflow draait tests opnieuw vóór het maken van release/tag.
- **Echte Home Assistant/P1-/Zonneplan-gegevens zijn nog niet uitgelezen:** geen externe toegang tot jouw lokale Home Assistant-installatie vanuit deze sessie.

## Zelf gebruiken
1. HACS → Energiehuis → installeer v1.19.0.
2. Open **Batterij → Datakwaliteit · fijnere metingen en jaarhistorie**.
3. Druk **Controleer mijn Recorder-data**.
4. Bekijk/deel de uitslag. Op basis daarvan kunnen we beslissen wat technisch betrouwbaar mogelijk is, zonder de huidige werking te verstoren.

Technische releasekandidaat: `RELEASE_NOTES_v1.19.0_RC.md`.
