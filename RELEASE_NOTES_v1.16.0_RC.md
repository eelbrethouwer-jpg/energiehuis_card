# Energiehuis v1.16.0-rc.1 — Batterij 4.0: financiële simulatie

## Verandering t.o.v. v1.15.0
De bestaande **Batterij Simulator 3.0** (per uur, 5/10/15 kWh) wordt uitgebreid met financiële scenario's. Het oudere 10-kWh-Home Assistant-model en het capaciteitenoverzicht blijven herkenbaar en worden niet overschreven.

- Selecteer **7 of 30 volledig afgeronde kalenderdagen** P1/prijsstatistieken.
- Per capaciteit 5/10/15 kWh: berekende vermeden inkoop, kosten netladen, gemiste terugleververgoeding, operationele besparing en een eenvoudige cyclusindicator.
- De uurmotor blijft rekening houden met rondrendement, bruikbare capaciteit, individuele laad-/ontlaadlimieten, historische uurtarieven indien beschikbaar, nul-SOC bij ontbrekende gegevens en gescheiden zon-/netladen.
- Optioneel: vul **aanschafkosten inclusief installatie** van de gekozen capaciteit in en een **slijtagekost per ontladen kWh**.
- Een hypothetische terugverdientijd wordt **alleen** getoond wanneer aanschaf en slijtage zijn ingevoerd en 30 dagen minimaal 90% complete uren en minstens 21 complete kalenderdagen bevatten; bovendien moet het berekende voordeel positief zijn.
- Financiële tabel voor alle drie capaciteiten; duidelijke scheiding tussen aangenomen prijs en historische geregistreerde prijs.
- Op mobiele schermen compacte kaarten, horizontaal scrollbare tabel en 7/30-dagenknoppen.
- Bij wijziging van periode of configuratie voorkomt een request-id dat oude Recorder-resultaten de nieuwe periode overschrijven.

## Expliciete AANNAMES
De bestaande configuratie bevat standaard 88% rondrendement, 3 kW laad-/ontlaadvermogen, €0,25/kWh vermeden inkoop en €0,08/kWh gemiste terugleververgoeding (indien er geen geschikte uurtariefhistorie is). Dit zijn **rekenaannames, geen product- of contractgegevens**. Het standaard bruikbare percentage is 100% tenzij batterijprofielen anders configureren. Aanschaf en slijtage zijn bewust **onbekend** totdat de gebruiker zelf een bedrag invult. Geen automatische koopaanbeveling.

## Belangrijke grenzen
- De hypothetische jaarbesparing is een vermenigvuldiging van een historische 30-dagenperiode met 365/30. Ook bij voldoende datadekking is dit **geen representatieve jaarprognose** (seizoenen, zonnestroom en prijsschommelingen ontbreken).
- In de slimme modus wordt de goedkoopste-urenstrategie met achteraf bekende prijzen doorgerekend; 1×40 A, Alfen Active Load Balancing en daadwerkelijke netcapaciteit zijn **niet** doorgerekend voor fysiek gridladen.
- Zonder complete historische uurprijzen vervalt de slimme modus naar alleen zonneladen. Geen fictieve prijscurve.
- Jaarlijkse investeringskosten, batterijdegradatie over jaren, fiscale regels, dynamische terugleverstaffels en slijtage buiten de ingestelde kost zijn niet gemodelleerd.
- De ingevoerde aanschaf- en slijtagebedragen staan **alleen in de actieve kaart**, niet in Home Assistant of localStorage.

## Veiligheid en compatibiliteit
- Alleen read-only Home Assistant Recorder en History voor bestaande entiteiten; geen nieuwe schrijf-/laadcommando's.
- Alfen-belastingbegrenzing, Cupra, Zonneplan, GoodWe, bestaande kostenvergelijker, gas en budget blijven onaangetast.
- Bestaande HACS-kaartconfiguratie blijft geldig. Geen YAML-wijziging nodig.
- De oude batterijsecties blijven in deze RC bestaan; mobiele opschoning na gebruikerstest.

## Acceptatiecriteria
1. JavaScript syntaxis, alle Node-regressies en HACS-validatie groen.
2. Nieuwe tests: prijsboekhouding sluit exact, negatieve uurprijzen, 7/30 dagen, onvolledige data, 5/10/15 variatie, correcte terugverdientijdguardrails.
3. Chromium: 30-dagenkeuze, kosteninvullen, 320/390/768/1280 px; geen Home Assistant-servicecalls.
4. Echte Home Assistant met minimaal 48 historische P1-uren, correcte prijsentiteit en iPhone Companion handmatig controleren.

**Status:** releasekandidaat. Niet gemerged, geen tag en niet in HACS geïnstalleerd. Fictieve testdata alleen in tests.
