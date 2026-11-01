# Energiehuis v1.17.0-rc.1 — Batterijpagina: laden en ontladen inzichtelijk

## Review van v1.16.0
De huidige batterijpagina toont in de volgorde een 10-kWh-Home Assistant-basismodel, een dagtotalenmodel 2.0, een uurmodel 3.0 en financieel model 4.0. De UX laat bijna alle blokken standaard openstaan, met meerdere 5/10/15-kWh-selecties en financiële tabellen. De bestaande SOC-lijngrafiek toont opslaginhoud, maar niet afzonderlijk wanneer er geladen is vanaf zonnepanelen of het net, en wanneer de simulator ontlaadt.

## Gebouwd in deze RC
- **Uurmodel 4.0 direct bovenaan** als centrale batterijsimulatie, met één compacte capaciteitselectie (5, 10, 15 kWh) en periodekeuze 7/30 dagen.
- Nieuwe **interactieve laad- en ontlaadgrafiek per kalenderdag**: groen = gesimuleerd laden via PV-overschot, blauw = gesimuleerd goedkoop netladen, oranje onder de middellijn = gesimuleerd ontladen naar huis; ontbrekende P1-uren zijn grijs.
- Vorige/volgende dag, klikken/tikken op een uurkolom en toetsenbordbediening (Enter/spatie). Er verschijnt een uurspecificatie met PV-lading, netlading, ontlading, SOC, netafname en teruglevering.
- Bestaande **SOC-grafiek over 7/30 dagen** behouden in een uitklapbare sectie. Financiële berekening en aanschaf-/slijtage-invoer blijven op de hoofdweergave.
- De oude 10-kWh-Home Assistant-sensorwaarden en dagtotalen-Battery 2.0 blijven intact in een uitklapbare sectie. De gedetailleerde 5/10/15-kWh-profielkaarten zijn eveneens opklapbaar.
- Mobiele compacte bediening en een legenda met expliciet zichtbare betekenis van de stromingen.

## Cruciaal onderscheid
De gebruiker heeft op dit moment **een virtuele thuisbatterij** in Home Assistant. De grafieken zijn geen werkelijke meting van een fysieke batterij. Ze zijn afgeleid van de bestaande chronologische simulatie met historische HomeWizard/P1-netafname en teruglevering. De laadtijden kunnen binnen een uur anders liggen, omdat een P1-uurblok geen volgorde binnen dat uur bevat. Er zijn geen nieuwe entiteiten, geen laadopdrachten, geen wijzigingen aan Alfen Active Load Balancing en geen opslagmigratie.

## Acceptatie
- JavaScript-syntax, alle Node-testbestanden, HACS-repositoryvalidatie en Chromium-browsertest moeten groen zijn.
- Specifiek: dagwisseling, uurtikken, P1-gaten, behoud van financiële 7/30-dagenberekening en contractvergelijker, 320/390/768/1280 px en nul nieuwe HA-servicecalls.
- Test nog in echte Home Assistant Companion op iPhone en met echte P1-/Zonneplan-historie. Bekend: historie kan onvolledig zijn door Recorder-retentie of tariefbron.
- Het echte ontwerp kan pas na praktijkacceptatie worden gepubliceerd.

## Release-/installatiestatus
Dit is uitsluitend een **RC op een aparte branch**. Geen merge, tag of installatie. v1.16.0 blijft de gepubliceerde HACS-release.
