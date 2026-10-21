# ⚡ Energiehuis v1.7.0 RC — Smart Energy Intelligence

Dit is een **releasekandidaat** en nog geen gepubliceerde stabiele HACS-release.

## Nieuw

1. **Slimme energiecoach** op Overzicht: adviseert over het goedkoopste eerstvolgende volledige Zonneplan-uur en toont actuele PV-productie. Geen autonome opdrachten.
2. **Slim laden 2.0** op Slim laden: vergelijk Direct, Slim (goedkoopste volledige uren) en Zon (alleen met een gekoppelde PV-uurprognose). De simulaties gebruiken 1×40 A, maximaal 32 A laadpaal, een instelbare reservelimiet en huidig of aangenomen huishoudverbruik. De werkelijke Alfen Active Load Balancing blijft altijd leidend.
3. **Kostenbudget**: een lineaire stroommaandprognose en, indien gekoppeld, gasmaandprognose. Doel standaard €200. Zonder echte gas-kosten kan het gecombineerde doel niet als behaald worden gemarkeerd.
4. **Cupra laadgeschiedenis**: detectie van laadsessies uit tot 14 dagen Recorder-historie van de Alfen-kWh-teller. Historische prijswaarden worden alleen meegenomen wanneer aanwezig. Vergelijking met het starttarief is nadrukkelijk hypothetisch.
5. **Batterijscenario's 5/10/15 kWh**: grove ideale opslagcapaciteit uit gemeten import-/exportdagtotalen. Financiële uitkomst gebruikt expliciete aannames (rondrendement, vermeden inkoop, gemiste teruglevering).
6. **Systeemcontrole** op Meer: beschikbaarheid, numerieke waarde, meeteenheden en actualiteit van P1, GoodWe, Alfen, Cupra, Zonneplan en batterij.
7. **Meterbeheer & Reset** verborgen onder Meer → Geavanceerd: kies meters en bevestig een nieuwe nulmeting. Alleen een **opgeslagen beginstand**, nooit een reset van fysieke sensoren, elektriciteitsmeter, omvormer of laadpaal. Een tweede expliciete bevestigingsstap beschermt tegen onbedoelde wijzigingen.

## Installatie van de reset-helper

De frontendcard kan de benodigde Home Assistant-helper **niet** automatisch via HACS installeren. Kopieer `packages/energiehuis_v17_reset.yaml` naar `/config/packages/energiehuis_v17_reset.yaml` en zorg dat de hoofdconfiguratie bevat:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Als `homeassistant:` al bestaat, voeg alleen de `packages:` regel **binnen het bestaande blok** toe. Maak geen tweede `homeassistant:`-sleutel. Controleer de configuratie en herstart Home Assistant. Controleer in **Ontwikkelhulpmiddelen → Statussen**:

```text
input_text.energiehuis_reset_baselines
```

Vervolgens kan de verborgen nulmeting-functie deze helper gebruiken. De waarde wordt door HA opgeslagen en op je andere apparaten gedeeld. De originele meterstanden, Recorder-historie, maandtellers en kostenvergelijking blijven intact. De nulmeting is zichtbaar in het beheeronderdeel, nog niet als aangepaste waarde in alle overige dashboardgrafieken.

## Optionele kaartinstellingen

```yaml
type: custom:energiehuis-card
reset_store: input_text.energiehuis_reset_baselines
monthly_budget_eur: 200
gas_cost_month: ""
budget_other_month_eur: 0
pv_forecast: ""
pv_total_energy: ""
billing_total_cost: ""
export_compensation_eur_kwh: null
battery_buy_eur_kwh: 0.25
battery_sell_eur_kwh: 0.08
battery_roundtrip_efficiency: 0.88
fuse_amp: 40
charger_amp: 32
reserve_amp: 2
ev_charge_efficiency: 0.90
```

Bestaande entiteitsinstellingen en alle vorige dashboardfuncties blijven behouden. Voeg deze opties indien gewenst toe aan je **bestaande** kaartconfiguratie; vervang nooit onbedoeld de al gekoppelde sensoren.

De batterijtarieven van €0,25 / €0,08, het rendement en de stroomreserve zijn **simulatie-aannames**, geen actuele Zonneplan-/Alfen-gegevens.

### PV-prognoseformaat

`pv_forecast` is optioneel. De sensor moet in de attributen `forecast`, `hourly` of `data` een lijst met volledige uren hebben, elk met `start` (of `start_date`) en `pv_kw` (of `power_kw`). Zonder betrouwbare voorspelling is zonneladen niet beschikbaar. Er wordt niet gesuggereerd dat huidige opwek gelijk is aan toekomstige opwek.

## Veiligheid en functionele grenzen

- **Geen automatische laadcommando's, geen instellingenwijzigingen in Alfen of Cupra.**
- Alleen de expliciet bevestigde `input_text.set_value` voor nulmeting-opslag mag de frontend schrijven.
- Geen resets van de werkelijke energie- of watermeter. Voor periodieke Home Assistant Utility Meter-tellers wordt nooit `utility_meter.reset` aangeroepen.
- Nieuwe financiële berekeningen zijn gescheiden van bestaande Vattenfall-contractvergelijkingen en virtuele batterijbesparingen.
- Een lineaire maandprognose houdt geen rekening met seizoensverschillen of alle vaste kosten.
- De simulatie voor zonneladen veronderstelt beschikbare AC-laadcapaciteit en kent geen dynamische PV- of huisprognose bij ontbrekende sensoren.
- RC vereist testen met echte Home Assistant-Recorder-data, browserweergave en reset-helper vóór een definitieve HACS-release.
