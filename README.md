# Energiehuis — Home Assistant dashboardkaart
![Energiehuis v1 dashboard](energiehuis-preview.png)
Een **alleen-lezen** dashboardkaart voor het tonen van HomeWizard P1, GoodWe PV, Alfen laadvermogen en Zonneplan-prijzen. De kaart verstuurt geen laadcommando's.

## Vereisten
- Een bestaande Home Assistant installatie met de relevante sensoren.
- HACS, voor installatie via een aangepaste dashboardrepository.

## Installatie via HACS
1. Maak een GitHub-repository met **exact** de naam `energiehuis-card` en plaats de inhoud van deze map in de hoofdmap van de repository. Houd `dist/energiehuis-card.js` in `dist/`.
2. Voeg in HACS de repository toe als **aangepaste repository**, type **Dashboard**.
3. Download de kaart in HACS.
4. Gebruik de HACS-resource `/hacsfiles/energiehuis-card/energiehuis-card.js` als JavaScript-module. Verwijder/disable pas na testen de eerdere handmatige bron `/local/energiehuis/energiehuis-card.js` om dubbel laden te voorkomen.
5. Voeg deze kaart toe aan een nieuw of bestaand dashboard:

```yaml
type: custom:energiehuis-card
net: sensor.p1_meter_vermogen
zonnepanelen: sensor.goodwe_pv_power
laden: sensor.alfen_actief_vermogen_totaal
stroom: sensor.alfen_stroom_l1
prijs: sensor.zonneplan_current_hourly_electricity_tariff
huis: sensor.energiehuis_huisverbruik_exclusief_auto
import: sensor.p1_meter_energie_import
export: sensor.p1_meter_energie_export
```

## Let op
- Vooralsnog is deze kaart identiek aan de reeds geïnstalleerde Energiehuis v1. Er is **geen noodzaak om de werkende kaart meteen om te zetten**.
- De huidige kaart toont de ruwe waarden van de vermogenssensoren. Controleer of de bronsensoren daadwerkelijk in **W** meten; de YAML-backend kan W en kW omrekenen, maar de dashboardkaart voert voor de ruwe bronnen nog geen automatische eenhedenconversie uit.
- Het model `huis = net + PV - Alfen` vereist een **positief P1-netvermogen bij import**, negatief bij teruglevering, en positieve PV- en Alfen-vermogens.
- De backend-YAML in `/config/packages/` valt **niet** onder deze HACS-dashboardupdates. Beheer die apart.
- Publiceer geen Home Assistant-back-ups, tokens, IP-adressen, persoonlijke sensorhistorie of secrets in een GitHub-repository.

## Versiebeheer
De beginversie kan direct vanaf de standaardbranch in HACS worden gedownload. Voor een herkenbare versieaanduiding publiceer je later een volledige GitHub Release (niet alleen een git-tag), bijvoorbeeld `v1.0.0`.
