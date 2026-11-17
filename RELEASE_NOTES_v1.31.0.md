# Energiehuis v1.31.0 — Woonkamerthermostaat in Live Cockpit

## Nieuw
- **Woonkamer op de Huis-tegel:** actuele temperatuur en ingestelde temperatuur uit Home Assistant, bij de bestaande energiewaarden.
- **Huisdetail:** huidige en ingestelde temperatuur met optionele handmatige knoppen voor een lagere/hogere setpointwaarde.
- **Afgeschermde bediening:** de knoppen blijven uitgeschakeld bij ontbrekende of onbruikbare entiteiten, onbekende `min_temp`/`max_temp`/`target_temp_step`, ontbrekende ondersteuning voor doeltemperatuur of HVAC-modus `off`.
- **Geen schijnbevestiging:** na een opdracht toont het dashboard pas een nieuw setpoint als Home Assistant die nieuwe waarde terugmeldt. Storing geeft een foutmelding.

## Eenmalige kaartconfiguratie
Voeg aan de bestaande Lovelace-configuratie toe (zonder de andere sleutels te verwijderen):

```yaml
thermostaat: climate.wgw_ot_on_off
```

Vereist `live_cockpit: true` en `live_cockpit_immersive: true`, die in de bestaande kaart actief mogen blijven. Zonder `thermostaat` blijft de Live Cockpit hetzelfde. Je hoeft geen templates of helpers te maken.

## Veiligheid en compatibiliteit
- **Geen automatische verwarming of optimalisatie** op basis van Zonneplan-tarieven. Alleen een bewuste tik op + of − kan `climate.set_temperature` aanroepen, met het doelsetpoint binnen de door Home Assistant gemelde grenzen.
- Deze wijziging doet geen aparte `climate.set_hvac_mode`-, preset- of schema-aanroepen. Het **werkelijke effect op een eventueel klokprogramma of tijdelijke override** hangt af van de thermostaatintegratie en moet in de echte installatie worden gecontroleerd.
- Geen wijzigingen aan Alfen-besturing, 1×40 A, Active Load Balancing, slimme laadregeling, P1/GoodWe-meting, historieberekeningen of lokale opslag.
- Bestaande praktijkruimte-submeter, contractbeheer, batterijvergelijker en Cupra-inzichten blijven bestaan.

## Kwaliteitsstatus en publicatie
- Feature-PR [#67](https://github.com/eelbrethouwer-jpg/energiehuis_card/pull/67), geteste HEAD `edf16bb6a7f296a1152f8dfa095deaeca18e83ca`, mergecommit `82a18cb9e83444548ccafd23ef2773fb9b6bd428`.
- **Feature-tests:** 5/5 checks geslaagd. Browsercontrole (Chromium/WebKit) volledig geslaagd na een herstart van een eerder mislukte, bestaande WebKit-lifecyclecontrole.
- **Release-HEAD:** nog afzonderlijk te controleren met build/syntax, Node UTC/Amsterdam en Chromium/WebKit. Niet bij voorbaat als geslaagd aangemerkt.
- **Praktisch getest:** nog niet met de daadwerkelijke Home Assistant-thermostaat en op iPhone. Test met de hand de +/- knoppen, actuele/ingestelde waarde, apparaatmodus en eventuele klokprogramma-override.
- **Owner-akkoord:** 17 november 2026 — na goede tests mag de feature worden gemerged en gereleased. Publicatie uitsluitend via `.github/workflows/publish-v1310.yml` vanaf `main`, met de expliciete bevestiging `PUBLISH_v1.31.0`. Een PR-merge publiceert niet.
