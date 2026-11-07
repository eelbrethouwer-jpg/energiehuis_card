# Energiehuis v1.24.0 – Gemeten laadvermogen en duidelijke laadkosten

- De laadkostentekst vermeldt nu correct dat laadverlies is inbegrepen, met het effectief gebruikte rendement. Vaste kosten en tariefverschillen blijven uitgesloten.
- Naast handmatige vermogensinvoer kun je expliciet het huidige Alfen-laadvermogen kiezen. Die knop is alleen beschikbaar bij een actieve, bruikbare laadmeting.
- Een tweede suggestie toont het mediane gemiddelde sessievermogen uit minstens drie gemeten sessies van minstens 5 kWh en 30 minuten. Geschatte sessies tellen niet mee. Het sessiegemiddelde omvat ook pauzes en langzamer laden; het is geen maximumvermogen van de laadpaal.
- Suggesties vullen niets automatisch in. Een klik verandert alleen het tijdelijke rekenscenario. Waar het bestaande laadplan een lagere vermogensgrens berekent, wordt die begrenzing getoond. Bij ontbrekende prijs-/plangegevens wordt geen grens verzonnen.
- De voormalige term ‘uurvenster’ heet nu ‘tijdvakken’. Dit is de totale duur van geselecteerde beschikbare laadperiodes, niet de actieve laadtijd; het laatste tijdvak kan deels worden gebruikt.
- Ontbrekende PV-prognose wordt kort gemeld. De laadbedieningsknoppen hebben minimaal 44 px hoogte, tussenruimte en een duidelijk omrande statuschip.

**Ongewijzigd:** eh17Plan, eenfase-aansluitgrenzen (1×40 A), batterijmodellen, opslag en laadbediening. De optionele scriptbediening blijft standaard uit. Er is geen minimumduur voor geselecteerde deeluren toegevoegd; een ongeldig tarief binnen het laadvenster blijft het plan blokkeren.

**Validatie:** 208 Node-tests slagen zowel met TZ=UTC als TZ=Europe/Amsterdam. De tien eerdere tijdzonefouten zijn opgelost in de fixtures: lokale kalendergrenzen en berekende uurvensters vervangen UTC-middernacht en een vast aantal uren. Extra controles omvatten de 23- en 25-uursdag en de 719/721-uursvensters. CI test beide tijdzones. De publicatieworkflow herhaalt ook de Chromium-controles voor laadvermogensuggesties, mobiele schermen op 320/390/768/1280 px, leveranciers, batterijfinanciën en CSV-import.

**Praktijkgrens:** browserchecks gebruiken fictieve data; deze release is niet rechtstreeks getest in Eelco’s live Home Assistant of op een fysieke iPhone. Een kort deeluur is rekenkundig bruikbaar, maar bewijst geen praktisch haalbare korte laadsessie. Werk de kaart bij via Marketplace/HACS en ververs zo nodig de dashboardcache.
