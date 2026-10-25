# Batterijprofielen v1.12 – controleren in Home Assistant

## Status
**Dit zijn uitsluitend berekeningen binnen de Lovelace-kaart**. We veranderen geen echte Alfen/Cupra/GoodWe-instellingen.

### Bestaande meetbronnen
- `sensor.p1_meter_energie_import`: P1-afname, historische uurtotalen (kWh of Wh)
- `sensor.p1_meter_energie_export`: P1-teruglevering, historische uurtotalen (kWh of Wh)
- `sensor.zonneplan_current_hourly_electricity_tariff`: optioneel historische uurprijzen
- De bestaande virtuele 10-kWh-sensoren bovenaan op de batterijpagina blijven onveranderd.

### Stapsgewijze controle
1. Controleer in Home Assistant onder **Ontwikkelhulpmiddelen → Statistieken** of beide P1-energiesensoren geldige langetermijnstatistieken leveren.
2. Installeer geen extra YAML. Controleer na publicatie in HACS of batterijprofielen voor 5, 10 en 15 kWh afzonderlijke piekvullingen tonen.
3. Bekijk een zonnige dag: bij voldoende opeenvolgende P1-teruglevering raakt de kleinere accu eerder vol.
4. Kijk naar het verschil tussen **volle accu** en **beperkt laadvermogen**; de rest blijft in het model theoretische P1-teruglevering.
5. Selecteer elk van de drie kaarten en controleer of de SOC-uurcurve en detailtabel dezelfde geselecteerde capaciteit tonen.
6. Wanneer de uitkomsten gelijk zijn, kijk of dat komt door beperkte export/afname, niet door het toevoegen van fictieve opwek.
7. Controleer op iPhone dat de kaarten netjes onder elkaar passen, dat een tabel horizontaal kan scrollen en dat andere dashboards blijven werken.

### Optionele Lovelace-opties
Wanneer je later een **concreet thuisbatterijmodel** hebt gekozen en de officiële specificaties bekend zijn, kunnen deze opties aan de **bestaande kaartconfiguratie** worden toegevoegd. Dit is geen zelfstandig vervangend YAML-blok:
```yaml
battery_5_usable_pct: 95
battery_5_charge_kw: 2
battery_5_discharge_kw: 2
```
De getallen hierboven zijn uitsluitend illustratief. Pas ze nooit toe als technische limiet op een echte batterij of op Alfen. De huidige standaard is 100% bruikbare nominale capaciteit en 3 kW voor alle drie, **uitsluitend als modelaannames**.

### Veiligheid
Active Load Balancing blijft leidend. Het vermogensplafond van de simulatie vervangt geen elektra-installatiebeveiliging. Fysieke aansturing via `charge_control_enabled` blijft standaard uitgeschakeld. De uurprijzen en euroresultaten zijn geen garanties op besparing.
