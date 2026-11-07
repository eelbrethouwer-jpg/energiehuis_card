# Energiehuis v1.23.0 – Rustiger mobiel dashboard en nauwkeuriger laadplanning

- Eén zichtbare hoofdkop per tabblad, één statuschip en een duidelijke Compact/Ruim-schakelaar. De mobiele hero is kleiner.
- Slim laden toont Direct/Slim/Zon met bestaande kWh-, tijdvenster- en kostenuitkomsten en het indicatieve voordeel bovenaan. Uren staan in één uitklapbare lijst; technische toelichting is uitklapbaar.
- Batterijuitkomsten staan vóór een compacte datakwaliteitsregel. Meetdekking en beperkingen blijven beschikbaar door die regel open te klappen.
- Zon, Huis, Net en Auto gebruiken op Overzicht dezelfde kleuren in tegels, grafiek en legenda. Afname/teruglevering en /kWh zijn zichtbaar; niet-geconfigureerde tegels verdwijnen.
- Vertrektijd en invoerraster blijven binnen de kaart. Grafieklabels staan verder van de staven.
- Afzonderlijke plannerfix: resterende begin- en einddeeluren tellen naar rato mee, inclusief laadverlies. Verdachte tariefwaarden geven een eenheidsmelding zonder automatische omrekening.

**Ongewijzigd:** batterijberekeningen, browseropslag en laadbediening. De bestaande eenfase-vermogensgrenzen blijven gelden. Er is nog geen automatische vermogenssuggestie op basis van laadsessies.

**Validatie:** syntax en 199 Node-regressietests in UTC. De releaseworkflow herhaalt die tests en Chromium-controles voor de mobiele schermen (320/390/768/1280 px), leveranciersvergelijker, batterijfinanciën en persoonlijke CSV-vergelijker. Er wordt fictieve sensordata gebruikt; live Home Assistant en een echte iPhone zijn niet getest.

**Bekende beperking:** de volledige bestaande Node-suite heeft met TZ=Europe/Amsterdam tien tijdzonegevoelige fouten buiten de planner; deze bestonden al vóór de wijzigingen. De gerichte plannerchecks slagen in beide tijdzones. Browserchecks draaien met Nederlandse tijdzone.

**Installatie:** update via HACS en vernieuw de dashboardcache indien de oude weergave blijft staan. De geïnstalleerde HA-versie kan niet vanuit GitHub worden vastgesteld.
