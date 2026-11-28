# Roadmap — klimaatanalyse (toekomst, nog niet gebouwd)

Vastgelegd en uitgebreid op 28 november 2026. Doel: begrijpen wat verwarmen en koelen kosten en opleveren, en waar winst zit. Alles blijft **alleen lezen**: geen automatische sturing en geen servicecalls in de analyse. De bestaande ±-bediening van de woonkamer blijft de enige schrijfactie.

## 1. Bronnen

| Bron | Via | Wat het geeft |
|---|---|---|
| Thermostaat praktijkruimte | Tuya (`climate.*`, soms losse `sensor.*`) | Ruimtetemperatuur, setpoint, actie (verwarmt of niet) |
| Thermostaat woning (Rameha) | Rameha-integratie in Home Assistant | Idem voor de woning |
| Airco's | `climate.*` per unit | Modus, setpoint, binnentemperatuur; soms vermogen of energie |
| Woonkamerthermostaat (bestaat) | `thermostaat: climate.wgw_ot_on_off` | OpenTherm-aan/uit en setpoint |
| Buitentemperatuur en wind | bestaande weersentiteit (`weather`) | Referentie voor alles |
| Zon, net, prijs | bestaande sensoren | Koppelen van klimaat aan geld en zon |
| Gas | bestaande gasmeting | Verwarmingsvraag |
| Ramen/deuren, aanwezigheid, luchtvochtigheid, CO₂ | optioneel, als je ze hebt | Verklaart pieken en verspilling |

Eerst controleren: welke entiteiten komen binnen, hoe vaak werken ze bij, en is er per airco een vermogens- of energiesensor? Zonder die sensor is elke kostenregel een **schatting** en wordt dat zo getoond.

## 2. Meten, niet verzinnen

Per getal een vaste herkomst: **gemeten** (sensor), **afgeleid** (uit gemeten waarden, rekenregel zichtbaar) of **geschat** (met aanname). Ontbrekende waarden zijn "onbekend", nooit 0. Dezelfde regel als op de batterijpagina.

## 3. Analyses, van basis naar creatief

### Basis (levert direct inzicht)
1. **Temperatuurverloop per ruimte** (24 u, 7 dagen) naast buitentemperatuur, met setpoint als lijn. Gedeelde grafiekbouwer, tikbubbel.
2. **Draaitijd per ruimte per dag**: uren verwarmen, uren koelen, uren uit. Trend over weken.
3. **Kosten van klimaat per ruimte**: gemeten kWh (of draaitijd × aangenomen vermogen) × kwartierprijs. Duidelijk gelabeld meting of schatting.
4. **Overzichtstegel "Klimaat nu"**: per ruimte temperatuur, setpoint, wat er draait.
5. **Praktijkruimte-aandeel**: hoeveel van het Praktijkruimte-verbruik en de kosten is klimaat.

### Efficiëntie en gedrag van het huis
6. **Opwarmsnelheid en afkoelsnelheid** per ruimte (graden per uur) bij verschillende buitentemperaturen. Daaruit volgt een eenvoudige **isolatiescore** per ruimte: hoe snel verliest hij warmte.
7. **Overshoot en ondershoot**: hoeveel wijkt de werkelijke temperatuur af van het setpoint, en hoe lang duurt het voor hij erbij is.
8. **Gradendagen**: dagelijkse verwarmingsvraag genormaliseerd op buitentemperatuur, zodat je winters en weken eerlijk vergelijkt ("deze week kostte 12% minder bij gelijke kou").
9. **Regressie gas of kWh tegen buitentemperatuur**: de "energiehandtekening" van je huis. Afwijkingen van die lijn zijn verdacht (raam open, storing, extra gebruik).
10. **Verwarmen en koelen tegelijk**: detecteer dat de airco koelt terwijl een thermostaat verwarmt (of andersom). Pure verspilling, zichtbaar als waarschuwing.
11. **Raam-open-detectie** uit een plotselinge temperatuurdaling of een steile val van de opwarmcurve, optioneel bevestigd met een contactsensor.
12. **Nachtverlaging effect**: wat levert de lagere nachttemperatuur echt op na het opwarmen in de ochtend, in kWh of m³ gas en euro.

### Geld en prijsmomenten
13. **Goedkoopste uren om voor te verwarmen of voor te koelen**: met de prijsvoorspelling "Nu +24 u" (bestaat al) laten zien welk uur het goedkoopst is om een ruimte voor te verwarmen, en wat dat bij jouw opwarmsnelheid scheelt. Alleen een **advies in tekst**, geen sturing.
14. **Koelen op eigen zon**: welk deel van de airco-energie dekte de zon, en wat kost het koelen als je het naar het zonne-uur had verschoven.
15. **Kosten per graad**: wat kost één graad hoger setpoint per ruimte per maand. Handig bij het kiezen van een comfortniveau.
16. **Dynamische-prijs-effect**: wat betaalde je voor klimaat tegenover een vast tarief of tegenover het daggemiddelde.
17. **Terugverdientijd-vergelijking**: airco versus gas voor dezelfde warmte (COP-schatting uit gemeten kWh en warmtevraag), met aannames zichtbaar.

### Comfort en gezondheid
18. **Comfortscore per ruimte**: percentage van de tijd binnen een door jou gekozen band (bijvoorbeeld 19–22 °C), met luchtvochtigheid als bonus.
19. **Praktijkruimte-gereedheid**: was de ruimte op temperatuur toen de eerste afspraak begon? Per dag een vinkje, over weken een percentage. (Past bij een praktijk.)
20. **Oververhitting zomer**: aantal uren boven een drempel, en of de airco dat oploste.
21. **Vocht- en schimmelrisico** (alleen als je vochtigheid hebt): uren boven een gekozen relatieve vochtigheid bij lage temperatuur.

### Voorspellen en ontdekken
22. **Verwachte verwarmingsvraag morgen** uit de weersverwachting (bestaat al voor prijzen) en de gradendagen-lijn, met bandbreedte. Eerlijk als indicatie.
23. **Anomalie-signalen**: een ruimte die abnormaal lang verwarmt, een airco die onverwacht draait of een thermostaat die nooit bereikt wat hij wil. Meld het als vraag, niet als conclusie.
24. **Verborgen verbruikers vinden**: het restverbruik van de woning uit de Balans-pagina naast de klimaatdraaitijd; als de piek meegaat met een airco is dat de verklaring.
25. **Seizoensvergelijking**: dezelfde maand vorig jaar, genormaliseerd op gradendagen (zodra er een jaar historie is).
26. **Wat-als-simulatie** (net als de batterijsimulator, gelabeld als simulatie): wat als het setpoint 1 °C lager was, wat als de nachtverlaging langer duurde, wat als de airco alleen op zon draaide.

### Weergave-ideeën
27. **Warmtekaart van de week**: uren op de ene as, dagen op de andere, kleur = temperatuur of draaitijd. Eén oogopslag voor patronen.
28. **Huisplattegrond-tegels** op de Home-cockpit: per ruimte een tegel met temperatuur en een klein symbool voor verwarmen of koelen (alleen lezen).
29. **Dagverhaal in één zin**: "Gisteren draaide de praktijkruimte 5 u verwarmen voor circa € 1,10 (geschat); de airco stond 2 u aan op zon."
30. **Wekelijks klimaatoverzicht** in Meer › Details, met de grootste verspilling bovenaan.

## 4. Uitgangspunten voor de bouw

- Dezelfde grafiekbouwer (`ehQtDrawChart`): assen, tik, pijltoetsen, gestapelde balken waar zinvol.
- Zuivere rekenmotor in `src/engines/` met eigen tests (zoals `quarter-engine` en `battery-live-engine`); geen HA, geen DOM.
- Geschiedenis via `recorder/statistics_during_period` en `history/history_during_period`, met time-out en retry zoals de batterijpagina.
- Alles optioneel: zonder koppeling verandert er niets aan de kaart. Nieuwe configsleutels bijvoorbeeld `klimaat_praktijk`, `klimaat_woning`, `klimaat_airco_1..n` met per entiteit een optioneel `_vermogen` of `_energie`.
- Navigatie: maximaal 4 segmenten per tab (testbeperking). Waarschijnlijk een nieuw segment onder Energie of onder Meer; later beslissen.
- Mobiel eerst: één scherm per vraag, lijsten korter dan twee schermhoogtes.

## 5. Voorgestelde volgorde

1. Entiteitenlijst uit Home Assistant verzamelen (Tuya, Rameha, airco's, weer, vochtigheid, vermogen).
2. Fase 1: klimaattegel en temperatuurgrafiek per ruimte (analyses 1, 2, 4).
3. Fase 2: kosten en gradendagen (3, 8, 9, 15, 16).
4. Fase 3: efficiëntie en waarschuwingen (6, 7, 10, 11, 23).
5. Fase 4: prijsadvies, comfort en simulatie (13, 14, 18, 19, 26).
6. Fase 5: weergave-extra's (27–30).

## 6. Nog te beslissen

- Welke Tuya- en Rameha-entiteiten precies beschikbaar zijn.
- Of de airco's een eigen energiesensor hebben (bepaalt of kosten gemeten of geschat zijn).
- Of er vochtigheid, CO₂ of raamcontacten beschikbaar zijn.
- Gewenste comfortband per ruimte en de openingstijden van de praktijk.
- Waar het scherm komt.
