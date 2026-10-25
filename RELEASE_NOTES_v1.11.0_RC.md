# Energiehuis v1.11.0-rc.1 — Batterij Simulator 3.0 (historische uurmodellering)

**Concept-releasekandidaat, niet gepubliceerd.** Gebaseerd op `main` v1.9.1. De parallelle v1.10.0-PR over laadsessies staat los van deze batterijaanpassing; vóór samenvoegen beide branches op conflicten en regressies controleren.

## Nieuw
- Batterij Simulator 3.0 op de bestaande Batterijpagina, zonder de bestaande Home Assistant-batterijsensoren te veranderen.
- Vergelijk 5, 10 en 15 kWh op basis van maximaal zeven volledige dagen historische P1-netafname en -teruglevering **per uur**.
- Chronologische SOC-grafiek; het model start leeg, telt laad- en ontlaadverliezen, past een gekozen vermogenslimiet toe en vult gaten niet met fictieve waarden.
- Twee scenario's: **alleen zonne-overschot** en **zon + goedkoop netladen**. Het tweede scenario is alleen beschikbaar bij volledige historische uurprijsdekking.
- Detailkaarten: vermeden netafname, opgeslagen zonne-energie, goedkoop netladen, indicatieve kostendifferentie en tabel per capaciteit.
- Vermogensbegrenzing standaard 3 kW als **rekenaanname**, geen veilige of fysieke laadpaalinstelling.
- Systeem gebruikt lokale Home Assistant Recorder-statistieken en optioneel historische Zonneplan-tariefsensor. Geen hardcoded API-sleutels, service workers, fysieke batterij of actieve opdrachten.

## Modelbeperkingen en financieel kader
- P1-uurstatistieken zijn **netto import/export per uur**. Zonder binnen-uurmetingen kan de werkelijke volgorde van laad-/ontlaadmomenten niet vastgesteld worden.
- De simulatie laadt daarom nooit van PV én ontlaadt binnen hetzelfde uur, en bij Recorder-gaten wordt de berekende SOC gereset. Resultaten zijn indicatief.
- Alleen met beide P1-statistieken en minstens 48 geldige uren worden kWh en euro-indicaties getoond. Geen extrapolatie naar 30 dagen wanneer het weekbeeld onvolledig is.
- Voor inkoopkosten gebruikt het model geregistreerde uurprijzen als ze **allemaal** beschikbaar zijn; anders expliciet `battery_buy_eur_kwh` als rekenaanname. Terugleververgoeding blijft `battery_sell_eur_kwh` als aanname.
- De slimme modus gebruikt achteraf het laagste prijskwartiel en een toekomstige prijsvergelijking binnen 24 uur. Dit is een terugkijkend scenario met perfecte voorkennis, **geen werkelijk uitvoerbaar laadplan**.
- Werkelijke maxima van de **1×40A-aansluiting**, piekbelasting, accu-degradatie, omvormergrenzen, installatieregels en negatieve prijs-/contractdetails worden niet exact gesimuleerd.
- Contract Zonneplan begint pas 1 november 2026; eerdere tarieven zijn geen gerealiseerde Zonneplan-factuur. Gas via Engie niet in batterijsimulatie opnemen.
- Resultaten nooit optellen bij gerapporteerde werkelijk gerealiseerde besparingen; geen gegarandeerde terugverdientijd.

## Home Assistant
**Geen nieuwe YAML of helper vereist voor de eerste versie.** Controleer wel:
- `sensor.p1_meter_energie_import` en `sensor.p1_meter_energie_export` met `kWh` of `Wh` en langetermijnuurstatistieken in Recorder.
- Historische `sensor.zonneplan_current_hourly_electricity_tariff` in `€/kWh` of `ct/kWh` voor slimme modus.
- Optioneel kaartconfiguratie `battery_sim_power_kw: 3` (alleen simulatie), bestaande `battery_roundtrip_efficiency`, `battery_buy_eur_kwh`, `battery_sell_eur_kwh`.
- Bij een toekomstige backend-persistente simulator maken we *een nieuw, optioneel* HA-package, zonder bestaande 10-kWh-batterij en P1-bronnen te dupliceren.

## Acceptatie voor publicatie
1. PR GitHub Actions volledig groen incl. alle v1.7–v1.9 regressies en nieuwe `tests/v110-battery3.test.cjs`.
2. iPhone en desktop: laadpagina, bestaande 10-kWh-panelen, knoppen 5/10/15, grafiek, tabel en beide modusknoppen.
3. Bij onvoldoende Recorder-historie geen gefabriceerde besparingscijfers; geen oneindige laadindicatoren.
4. Bij onvolledige Zonneplan-prijshistorie is netladen uitgeschakeld, zonnesimulatie werkt wel.
5. Valideer model tegen één handmatig doorgerekende dag; geen dubbeltelling zonneoverschot; vaste Alfen Active Load Balancing blijft onaangetast.
6. Controleer eerst parallel PR #14 (v1.10.0) op eventuele mergeconflicten; publiceer niet direct vanuit conceptbranch.
