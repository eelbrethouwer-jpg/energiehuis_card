# Energiehuis v1.29.0 — Landscape Home en HA-laadplanning

De bestaande Energiehuis-kaart krijgt een grotere landscape-compositie, stabiele live meetupdates en een uitgebreidere prijsgrafiek. De standaard kaartregistratie blijft `custom:energiehuis-card`.

## Nieuw

- Immersive Home (`live_cockpit: true`, `live_cockpit_immersive: true`) toont de volledige masterafbeelding, met een compacte navigatierail op liggende telefoons en behoud van de portretkaarten. Safe-areas en schermrotatie worden meegenomen.
- Bij veranderende meetwaarden blijft de Home-shell verbonden; de scène wordt niet telkens losgekoppeld. De eigenaar meldt dat het eerder waargenomen flikkeren hiermee verdwenen lijkt.
- Dagtotalen en sessiegegevens uit bestaande HA-bronnen. Ontbrekende of gedeeltelijke data blijven herkenbaar. Een onzekere sessiestart geeft geen bevestigd kWh-totaal; bij schaarse change-only historie kan de sessie niet beschikbaar blijven.
- De gewone kwartierprijsgrafiek toont beschikbare prijzen van vandaag en morgen, met daggrens en echte DST-tijdstempels. Ontbrekende prijzen worden niet ingevuld.
- Optionele alleen-lezen HA-laadplanning, gebaseerd op de door de eigenaar aangeleverde ApexCharts-YAML: groene geselecteerde kwartieren, oranje wachtkwartieren en de bestaande prijsgrens. Met SOC-doel tot vertrek, maximaal 36 uur; zonder SOC-doel de bestaande prijsstrategie. Dit is plandisplay, geen bevestiging dat Alfen daadwerkelijk laadt.
- Bestaande Net-presentatie via `netPresentation()` en alle bestaande bestemmingspagina’s blijven behouden.

## Configuratie op de gewone HACS-kaart

Behoud je bestaande sensoren, kaarttype en beveiligde Media Source-afbeeldingspad. Voeg voor de nieuwe weergave toe:

```yaml
live_cockpit: true
live_cockpit_immersive: true
kwartier_forecast: sensor.zonneplan_current_quarter_hourly_electricity_tariff
live_cockpit_planning: true
```

De planningsoptie gebruikt de bestaande helpers uit de eigen Cupra-installatie: `input_select.cupra_prijsstrategie`, `input_number.cupra_gewenste_soc`, `sensor.cupra_actuele_laadgrens`, `sensor.cupra_slim_effectieve_vertrektijd` en `sensor.cupra_slim_minimaal_bekende_kwartieren_nodig`. Zonder die installatie laat je `live_cockpit_planning` weg of zet je die op `false`; de gewone prijsgrafiek blijft beschikbaar. De compacte kaart toont EUR/kWh, de oorspronkelijke ApexCharts-grafiek ct/kWh.

Na HACS-update: gebruik `type: custom:energiehuis-card` en de bestaande HACS-resource. De aparte `custom:energiehuis-card-pr59-test` en `/local/eh-pr59.js` zijn uitsluitend voor de testvariant. Laat je oorspronkelijke kaart beschikbaar totdat je de productie-update hebt gecontroleerd. Verwijder daarna desgewenst testkaart en testresource.

## Behoud en testgrenzen

Geen nieuwe HA-servicecalls of wijzigingen aan opslagkeys, laadbediening, 1×40 A, Alfen EMS of Active Load Balancing. De bestaande cockpit blijft alleen lezen; optionele scriptbediening behoudt haar bestaande standaard uit. Geen gesimuleerde stroomroutes bij ontbrekende metingen. Terugval: `live_cockpit_immersive: false`, of via HACS terug naar v1.28.0.

De feature-HEAD 1cef137a3cdc333339804696bd7270c4349f3d54 is lokaal getest met 417/417 Node-tests in UTC en Europe/Amsterdam en 48/48 Chromium-controles. De release-HEAD moet opnieuw door de verplichte CI en de handmatige publicatieworkflow, inclusief WebKit. De eigenaar heeft de testvariant in de eigen HA gebruikt en positief beoordeeld; iPhone-model, iOS-versie, VoiceOver en niet-observeerbare laadpauzes zijn niet volledig vastgelegd of praktisch gevalideerd. Er wordt geen volledige fysieke acceptatie geclaimd.

Eigenaar heeft op 12 november 2026 expliciet gevraagd: “Ja dit is goed maak die maar live”. Publicatie uitsluitend handmatig vanaf gevalideerde main met bevestiging `PUBLISH_v1.29.0`; bestaande tags/releases worden geweigerd. Geen automatische publicatie op merge.
