# Energiehuis v1.7.1 — Gas & Water hotfix

Kleine onderhoudsrelease op basis van v1.7.0. Alle functies van Smart Energy Intelligence, Cupra, slim laden, kosten en Meterbeheer blijven bestaan.

## Gas: koppeling op de echte sensoren

- `gas: sensor.gas_meter_gas` — cumulatieve gasmeterstand.
- `gas_today: sensor.gas_vandaag_2` — dagverbruik gas.
- Op Overzicht wordt **Gas vandaag** als voornaamste waarde getoond wanneer de dagsensor geldig is.
- Op **Meer → Gas & water** en in de uitklapdetails staan dagverbruik en meterstand expliciet naast elkaar.
- Gasupdates vanuit P1 kunnen vertraagd zijn; Energiehuis toont de laatst ontvangen sensorwaarde.

## Water: HomeWizard-herkenning en dagtotaal

- Detecteert beschikbare HomeWizard-watermeters aan de hand van herkenbare entiteitsnamen en eenheden (m³ / L).
- Detecteert optioneel waterdebiet (L/min of m³/h) en toont dit afzonderlijk.
- Wanneer `water_today` ontbreekt en een cumulatieve watermeter aanwezig is, kan Energiehuis het dagtotaal **in liters** berekenen uit een Recorder-beginstand vóór lokale middernacht.
- Bij ontbrekende beginstand, tellerreset, ongeldige meeteenheid of meerdere gelijkwaardige bronnen toont de kaart `—` en een uitleggende melding. Er worden geen fictieve gegevens gegenereerd.
- Meterstanden blijven in m³, actuele flow in L/min.

## Meterbeheer

- De geavanceerde nulmeting onder **Meer** blijft bestaan.
- De selectie van de watermeter gebruikt nu de veilig herkende cumulatieve meter, ook als `water:` nog niet handmatig in YAML is geconfigureerd.
- Selecteer en bevestig expliciet vóór het opslaan van de relatieve beginstand. De fysieke sensoren worden nooit gereset.

## Handmatig koppelen waar nodig

Energiehuis kan alleen automatisch kiezen wanneer een bron eenduidig is. Als water niet direct wordt gevonden, open **Ontwikkelhulpmiddelen → Statussen**, zoek op `water` en noteer de cumulatieve meter en eventuele debietsensor.

Voorbeeld van velden om aan de **bestaande kaartconfiguratie** toe te voegen (vervang de waterwaarden door de werkelijke entiteitsnamen, niet door fictieve voorbeelden):

```yaml
gas: sensor.gas_meter_gas
gas_today: sensor.gas_vandaag_2
water: ""
water_today: ""
water_flow: ""
```

Lege waterinstellingen laten de automatische herkenning werken. Handmatig gekozen waterbronnen krijgen altijd voorrang.

**Technisch:** Alle extra dataverwerking is read-only. De kaart gebruikt Home Assistant Recorder via `history/history_during_period` en leest bestaande entiteiten. De laadplanner en de 1×40 A-veiligheidsgrenzen veranderen niet. Voor de nulmeting is alleen de bestaande, apart bevestigde `input_text.energiehuis_reset_baselines`-helper schrijfbaar.

**Status:** releasekandidaat. Automatische JavaScript-/HACS- en regressietests moeten slagen en de waterentiteiten moeten in de eigen Home Assistant-installatie worden geverifieerd vóór stabiele publicatie.
