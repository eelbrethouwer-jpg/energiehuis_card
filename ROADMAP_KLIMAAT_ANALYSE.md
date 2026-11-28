# Roadmap — klimaatanalyse (toekomst, nog niet gebouwd)

Vastgelegd op 28 november 2026. Doel: begrijpen wat verwarmen en koelen kosten en opleveren. Alles blijft **alleen lezen**: geen automatische sturing, geen servicecalls in de analyse.

## Te koppelen apparaten

| Apparaat | Via | Doel |
|---|---|---|
| Thermostaat praktijkruimte | Tuya (Home Assistant-integratie; `climate.*` of `sensor.*`) | Ruimtetemperatuur, setpoint, verwarmt ja/nee |
| Thermostaat woning (Rameha) | Home Assistant-integratie voor Rameha | Idem voor de woning |
| Airco's | Home Assistant `climate.*` per unit | Modus, setpoint, binnentemperatuur, eventueel vermogen |
| Woonkamerthermostaat (bestaat al) | `thermostaat: climate.wgw_ot_on_off` | Blijft zoals nu |

Eerst controleren in Home Assistant: welke entiteiten komen binnen, hoe vaak ze bijwerken, en of er een vermogens- of energiesensor per airco is (anders alleen draaitijd en modus).

## Analyses (idee)

1. **Binnentemperatuur versus buitentemperatuur** per ruimte, per dag en week, met de buitentemperatuur uit de bestaande weersentiteit.
2. **Draaitijd verwarmen en koelen** per ruimte per dag (uit `hvac_action` of modus), met trend.
3. **Kosten van klimaat**: draaitijd of gemeten kWh keer kwartierprijs, per ruimte. Zonder vermogenssensor expliciet als schatting met aanname tonen, nooit als meting.
4. **Setpoint versus werkelijke temperatuur**: hoe lang duurt het opwarmen, hoeveel overschrijding.
5. **Praktijkruimte**: verwarming en airco naast de bestaande Praktijkruimte-kosten, zodat zichtbaar wordt hoeveel van het verbruik klimaat is.
6. **Zonlicht en airco**: koelvraag naast zonopwek, om te zien of koelen op eigen zon draait.
7. **Gas**: verwarmingsvraag naast de gasmeting.

## Uitgangspunten

- Dezelfde grafiekbouwer als de rest (`ehQtDrawChart`), zelfde assen en tikbubbel.
- Onbekende of ontbrekende waarden tonen als onbekend, nooit als 0.
- Geschiedenis via `recorder/statistics_during_period` en `history/history_during_period`, met time-out en retry zoals de batterijpagina.
- Nieuwe configsleutels optioneel; zonder koppeling verandert er niets aan de kaart.
- Bediening (setpoint zetten) valt buiten deze analyse; de bestaande ±-bediening van de woonkamer blijft de enige schrijfactie.

## Nog te beslissen

- Waar komt het scherm: Energie, een nieuw segment, of Meer.
- Welke Tuya- en Rameha-entiteiten precies beschikbaar zijn (eerst een entiteitenlijst uit Home Assistant).
- Of de airco's een eigen energiesensor hebben.
