# Energiehuis v1.19.0 — Batterijdatakwaliteit en historietoets

## Nieuwe functie
In **Batterij → Datakwaliteit · fijnere metingen en jaarhistorie** staat een compacte, uitklapbare read-only controle:
- toont actuele dekking van P1-netafname en -teruglevering voor de bestaande 7-/30-dagen-uursimulatie
- toont hoeveel van die uren werkelijk historische tariefinformatie bevatten (geen prijsaannames als gemeten prijs presenteren)
- vraagt **alleen na een druk op 'Controleer mijn Recorder-data'** twee steekproeven op: P1-statistieken per vijf minuten voor gisteren en uurstatistieken gedurende een week ongeveer een jaar geleden
- meldt apart fouten en ontbrekende data; beide bronnen kunnen onafhankelijk slagen of falen
- benoemt uitdrukkelijk dat een volledige vijfminutendag slechts een indicatie geeft en een oude week nooit bewijst dat alle 365 dagen beschikbaar zijn

## Wat blijft bewust onveranderd
De bestaande HomeWizard-stijl grafiek en virtuele batterijsimulatie gebruiken nog steeds uurstatistieken. **Geen vijfminuten- of jaarweergave wordt ingeschakeld op basis van slechts een steekproef.** Ook bestaande stroomvergelijker, HACS-entiteiten, Zonneplan, Alfen, PV en Cupra blijven ongewijzigd. Geen HA-servicecalls, geen writes, geen YAML-wijzigingen.

## Context
Home Assistant legt voor geschikte sensoren standaard 5-minutenstatistieken vast zolang de Recorder-geschiedenis behouden blijft (standaard circa 10 dagen) en bewaart lange-termijnstatistieken per uur. Aanwezigheid hangt af van state_class, Recorder-registratie, historie en de feitelijke sensor. Als Zonneplan pas vanaf vandaag stroom levert, kan eerdere historische prijsdekking ontbreken.

## Testen
- Node-regressies incl. onafhankelijke teller-/prijsdekking, steekproefinterval, foutgevallen en geen HA-service calls
- Chromium op testfixtures incl. expliciete druk op de knop en testen van beide Recorder-query's, mobiele schermgroottes
- HACS, JavaScript en bestaande stroomvergelijker regressies
- **Geen live toegang tot jouw Home Assistant vanuit deze ontwikkelsessie.** De datacheck moet in jouw geïnstalleerde HACS-kaart uitgevoerd worden om jouw echte P1-/tariefhistorie te beoordelen.

## Gebruik
Update HACS naar v1.19.0, open **Batterij**, klap **Datakwaliteit** open en druk op **Controleer mijn Recorder-data**. De percentages verschijnen in de kaart. Deel daarna de tekst of een screenshot om de keuze voor fijnere resolutie en een toekomstige echte jaarweergave te maken.
