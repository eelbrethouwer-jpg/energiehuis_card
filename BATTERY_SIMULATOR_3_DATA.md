# Batterij Simulator 3.0 — gegevenscontract en installatiecontrole

## Bron van waarheid
Deze code leest gegevens via het **Home Assistant websocket-kanaal** van de bestaande ingelogde Lovelace-kaart. Er wordt geen nieuw apparaat bestuurd.

| Bron | Verwachte entiteit | Gegevens |
| --- | --- | --- |
| P1 afname | `sensor.p1_meter_energie_import` | Langetermijnuurstatistiek `change` of `sum`, kWh/Wh |
| P1 teruglevering | `sensor.p1_meter_energie_export` | Langetermijnuurstatistiek `change` of `sum`, kWh/Wh |
| Zonneplan | `sensor.zonneplan_current_hourly_electricity_tariff` | Optionele uurstatistiek `mean` of bijgehouden statushistorie, €/kWh of ct/kWh |
| Bestaande virtuele batterij | `sensor.virtuele_batterij_soc`, etc. | Ongewijzigde 10-kWh-simulatie, **geen** input van de nieuwe uurmodellering |

## Controle in Home Assistant vóór activering
1. Instellingen → Apparaten en diensten → Entiteiten: zoek beide P1-energiesensoren en controleer de eenheid.
2. Ontwikkelhulpmiddelen → Statistieken: controleer dat import/export als bron voor **langetermijnstatistieken** bestaan en geen fouten hebben.
3. Geschiedenis/Recorder: controleer in de laatste zeven volledige dagen of er voldoende P1-gegevens bestaan. Minstens 48 complete uren zijn vereist voor de eerste indicatie.
4. Controleer of de Zonneplan-prijssensor *historische* uurwaarden bevat én of de eenheid EUR/kWh of ct/kWh is. De app verzint geen ontbrekende uurprijzen.
5. Werk de HACS-kaart pas bij na groene CI, PR-review, merge en officiële release. Ververs daarna de frontendcache.

## Bewuste veiligheid en beperkingen
- Uitgangssituatie: géén fysieke thuisbatterij, geen laadcommando's, geen wijzigingen aan Alfen/DSMR/P1.
- `battery_sim_power_kw: 3` is slechts een modelparameter. Het mag **niet** worden gekopieerd naar laadpaal, EMS, omvormer of installatielimiet; éénfase 1×40 A blijft leidend.
- Een ontbrekend uur wordt niet gemiddeld of met een geschatte prijs gevuld. Historische prijsverschillen zijn **geen** bewijs van gerealiseerde besparing.
- De slimme modus gebruikt bewust terugkijkende prijsinformatie, niet een operationele regelaar.
- Goedkope netlading en zonnescenario's worden apart gerapporteerd; niet optellen met de bestaande Home Assistant-batterijbesparing.

## Geen nieuwe YAML nodig
Voor deze fase blijft `/config/configuration.yaml` en bestaande `packages/` onaangeroerd. Mocht betrouwbare Recorder-statistiek ontbreken, herstel dan eerst de meetbron of herstel de statistiekinstellingen. Maak niet alvast identieke P1-sensoren.
