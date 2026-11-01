# Energiehuis v1.18.0 RC — Gecombineerde batterijgrafiek

## Doel
Een grafiek die qua leesbaarheid aansluit bij de HomeWizard-thuisbatterij: laden boven de nullijn, ontladen eronder, gecombineerd met een witte batterijpercentage-lijn. Geen kopie van merkassets of gebruikersdata.

## Gebouwd
- Gecombineerde grafiek op de **Batterij-pagina**: **paars** = laadenergie van zonnepanelen en van het net, **groen** = ontladen naar het huis, **wit gestippeld** = virtuele batterijvulling / SOC op aparte rechter %-as.
- Extra kleurschakering voor netladen binnen het paarse laadgebied.
- **Dag** toont berekende kWh per P1-uur; **Week** en **Maand** aggregeren de daadwerkelijk beschikbare uurwaarden naar dagtotalen. Dagen selecteren kan via de grafiek; een dag openen toont de uren.
- **Jaar** staat bewust uit: de bestaande batterijmotor haalt slechts 7 of 30 dagen op. Er worden geen jaarwaarden of fictieve kwartier-/vijfminutenmetingen gemaakt.
- De originele 7/30-dagenkeuze, 5/10/15-kWh-profielen, slimme laadstrategie, SOC-detailgrafiek, financiële scenario's, aanschaf-/slijtagekosten en eerdere 10-kWh-simulatie blijven aanwezig.
- Grijze markering bij ontbrekende/partiële meetgegevens; SOC-lijn wordt op ontbrekende momenten onderbroken. Weergave is interactief en toetsenbordbedienbaar.
- Compact op iPhone, tablet en desktop.

## Grenzen
**Uitsluitend een virtuele-batterijsimulatie, geen fysieke HomeWizard-batterijmetingen.** Historische P1-uurtotalen bevatten geen precieze intra-uurvolgorde. De grafiek visualiseert berekende resultaten; een doorlopende lijn tussen twee uren is een visuele verbinding, geen meetwaarde tussen die tijdstippen. De gepresenteerde lading is energie (kWh) per uur of per dag, geen direct gemeten laadvermogen (kW).

Historische prijzen zijn alleen gebruikt waar correct geregistreerd; zonder voldoende tariefhistorie wordt slim netladen niet berekend. Het profiel is standaard een rekenmodel; er wordt **niets naar de Alfen gestuurd** en er is geen YAML-wijziging nodig.

## Geautomatiseerde releasecontroles
- `node --check` en alle Node-regressietests, inclusief uur-/dagaggregatie, SOC, ontbrekende data, tarief-/financiële regressies.
- HACS validatie en Chromium browsertests van de bestaande stroomvergelijker en het nieuwe batterijscherm.
- Chromium test in 320/390/768/1280px, dag/week/maand, klik op een dag/uur, behoud financiële invoer, geen HA-servicecalls.
- **Open praktijkcontrole:** echte Home Assistant en iPhone-app met gebruiker zijn niet getest. Recorder-retentie en historische Zonneplan-tariefdekking kunnen de grafiek beperken.

**Status:** kandidaat tot versie wordt gefinaliseerd en alle CI-checks zijn geslaagd.
