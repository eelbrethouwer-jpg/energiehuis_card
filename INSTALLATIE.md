# PR #61: morgenprijzen en jouw HA-laadplanning

Bron-HEAD: `1cef137a3cdc333339804696bd7270c4349f3d54`. Aparte testvariant, geen HACS-release. Alleen registratie, stub en kaartkiezernaam verschillen van de PR-bundel. De gewone HACS-kaart blijft behouden.

1. Bewaar je huidige testbestand als terugval op de laptop. Vervang uitsluitend `homeassistant/www/eh-pr59.js` door de nieuwe `eh-pr59.js` uit deze ZIP. Bestand rechtstreeks in www, niet in de ZIP-submap.
2. Wijzig de testresource naar `/local/eh-pr59.js?v=1cef137` (JavaScript-module).
3. Voeg aan de bestaande testkaart-YAML deze twee regels toe, zonder inspringing en zonder dubbele sleutels:

```yaml
kwartier_forecast: sensor.zonneplan_current_quarter_hourly_electricity_tariff
live_cockpit_planning: true
```

Het kaarttype blijft `custom:energiehuis-card-pr59-test`. Alle sensoren, beveiligde Media Source-afbeelding, overige instellingen en Kiosk Mode blijven staan. Laat `charge_control_enabled: false` staan.

4. Herlaad Home Assistant volledig, ook op de iPhone. De kaartkiezer noemt deze variant `Energiehuis PR61 TEST 1cef137`.
5. Vergelijk de grafiek met je bestaande ‘Slimme laadplanning tot vertrek’. Groen = geselecteerd laadkwartier, oranje = wachten; rood = bestaande prijsgrens waar de oorspronkelijke kaart die toont. De compacte kaart toont EUR/kWh; je ApexCharts-kaart toont ct/kWh (100 × EUR/kWh). De selectie komt uit dezelfde bestaande HA-entiteiten en selectieregels, niet uit een afbeelding.

Met een SOC-doel: de bestaande benodigde kwartieren of prijsgrens tot vertrek, maximaal 36 uur vooruit. Zonder SOC-doel: 25% goedkoopste per lokale dag of de prijsgrens. Deze kleuren zijn een planning, geen bevestiging dat Alfen werkelijk laadt. Ontbrekende helpers geven ‘Planning n.b.’ en geen verzonnen selectie. Ontbrekende forecastkwartieren blijven leeg. De huidige prijs blijft het huidige kwartier. Test portret/landscape, waarde-updates zonder flikkeren, menu, de bestaande doorklik naar Slim laden en Terug.

Wil je alleen vandaag plus morgen zonder de laadplanning? Zet `live_cockpit_planning: false`. De gewone prijsgrafiek toont morgen zodra echte morgenprijzen beschikbaar zijn, met een daggrens en melding bij gedeeltelijke/ontbrekende prijzen.

De kaart leest alleen. Wijzig geen laadinstellingen en start geen laadopdrachten voor deze test. De gewone kaart en de testkaart gebruiken bestaande opslagkeys. Terugval: zet je vorige testbestand terug, pas de cacheparameter opnieuw aan en herlaad; verwijder eventueel de twee nieuwe YAML-regels.

Fysieke iPhone/HA-test op deze uitbreiding en onafhankelijke review zijn nog nodig. Er is niets gemerged of gereleased.
