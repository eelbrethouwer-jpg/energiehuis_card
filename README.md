# Energiehuis — Home Assistant dashboardkaart

![Energiehuis dashboard](energiehuis-preview.png)

Energiehuis is een eigen, mobielvriendelijke Home Assistant-interface voor energie-inzicht. De kaart combineert P1, GoodWe, Alfen, Cupra, Zonneplan, de virtuele thuisbatterij en optioneel gas/water in één HomeWizard-achtige omgeving.

> Energiehuis v1.4.0 blijft voor laadsturing **alleen-lezen**. De Cupra-planner is een simulatie en verstuurt geen laadcommando's. Alfen Active Load Balancing en de bestaande Home Assistant-backend blijven leidend.

## Nieuw in v1.4.0

- Gas en water toegevoegd aan het algemene overzicht.
- Cupra SOC gebruikt standaard de echte EU Data Act-sensor als die aanwezig is.
- Virtuele batterij standaard gekoppeld aan de bestaande batterij-SOC.
- Onderste navigatie is nu volledig intern:
  - Overzicht
  - Cupra
  - Batterij
  - Kosten
  - Meer
- Nieuwe pagina **Batterij**:
  - kosten zonder batterij
  - kosten met batterij
  - totale netto besparing
  - besparing vandaag / maand / jaar
  - vermeden inkoop
  - kosten van netladen
  - gemiste terugleveropbrengst
- Nieuwe pagina **Kosten**:
  - actuele Zonneplan-prijs
  - Zonneplan dag/maand/jaar
  - Vattenfall 1- en 3-jaarsreferenties
  - voordeel versus Vattenfall
  - besparing door slimme timing
- Nieuwe pagina **Meer** met gas- en waterstatus.
- Water-entiteiten worden bewust niet geraden: ze kunnen expliciet in de kaartconfiguratie worden gekoppeld.

## Bestaande functies

- Live overzicht van:
  - netvermogen
  - zonnepanelen
  - woningverbruik
  - stroomprijs
  - Cupra Born
  - virtuele batterij
- Interactieve vermogensgrafiek.
- Klikbare detailgrafieken voor net, zon, huis en Cupra.
- Periodes:
  - Vandaag
  - Gisteren
  - 7 dagen
  - 30 dagen
  - Dit jaar
  - Vorig jaar
- Cupra laadplanner op basis van Zonneplan-prijzen.
- Prijsinspectie per tijdstip.
- Mobiel geoptimaliseerde vaste navigatie.

## Installatie via HACS

1. Voeg deze repository in HACS toe als aangepaste repository, type **Dashboard**.
2. Download Energiehuis.
3. Gebruik de HACS-resource:

`/hacsfiles/energiehuis-card/energiehuis-card.js`

4. Voeg de kaart toe aan een dashboard:

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
cupra: sensor.garage_cupra_born_accuniveau
batterij: sensor.virtuele_batterij_soc
gas: sensor.gas_meter_gas

# Optioneel: vul de echte HomeWizard-waterentiteiten in zodra bekend.
water: ""
water_today: ""
water_flow: ""

# Optioneel: als je al een aparte gas-dagteller hebt.
gas_today: ""
```

## Optionele financiële sensoren

v1.4.0 kan onderstaande bestaande Energiehuis-sensoren gebruiken. Als een sensor niet bestaat, wordt geen fictieve waarde getoond.

```yaml
battery_soc_kwh: input_number.virtuele_batterij_soc_kwh
battery_status: sensor.virtuele_batterij_status
battery_saving_day: sensor.virtuele_batterij_besparing_dag
battery_saving_month: sensor.virtuele_batterij_besparing_maand
battery_saving_year: sensor.virtuele_batterij_besparing_jaar
battery_cost_without_month: sensor.virtuele_batterij_kosten_zonder_maand
battery_cost_with_month: sensor.virtuele_batterij_kosten_met_maand
battery_avoided_import_month: sensor.virtuele_batterij_vermeden_inkoop_maand
battery_grid_charge_cost_month: sensor.virtuele_batterij_kosten_netladen_maand
battery_lost_export_month: sensor.virtuele_batterij_gemiste_teruglevering_maand

cost_zonneplan_day: sensor.kosten_zonneplan_stroom_dag
cost_zonneplan_month: sensor.kosten_zonneplan_stroom_maand
cost_zonneplan_year: sensor.kosten_zonneplan_stroom_jaar
cost_vattenfall_1_month: sensor.kosten_vattenfall_1_jaar_stroom_maand
cost_vattenfall_3_month: sensor.kosten_vattenfall_3_jaar_stroom_maand
saving_smart_month: sensor.besparing_slim_stroomgebruik_maand
advantage_vattenfall_1_month: sensor.voordeel_zonneplan_vs_vattenfall_1_jaar_maand
advantage_vattenfall_3_month: sensor.voordeel_zonneplan_vs_vattenfall_3_jaar_maand
```

## Financiële scheiding

De batterij-businesscase en het contractvoordeel worden bewust gescheiden.

**Batterijbesparing** vergelijkt de kosten zonder batterij met de kosten mét virtuele batterij. Kosten van netladen, gemiste teruglevering en vermeden dure inkoop horen daarbij.

**Zonneplan/Vattenfall** en **slimme timing** zijn afzonderlijke voordelen. Energiehuis telt deze bedragen niet automatisch bij de batterijbesparing op, om dubbeltelling te voorkomen.

## Veiligheid

- Geen tokens in de frontend.
- Geen externe requests.
- Geen Alfen-laadcommando's vanuit de kaart.
- De bestaande Active Load Balancing blijft leidend.
- Backend-YAML onder `/config/packages/` wordt niet door HACS bijgewerkt.

## Ontwikkelrichting

De volgende stappen zijn verdere modularisering, instellingen vanuit Energiehuis zelf, uitgebreidere water/gas-grafieken, slimme inzichten en uiteindelijk minder handmatige YAML-wijzigingen.
