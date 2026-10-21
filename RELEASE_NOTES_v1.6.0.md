# Energiehuis v1.6.0 — Cupra Insights

## Persoonlijke praktijkanalyse van de Cupra Born

v1.6.0 bouwt een read-only analyse op uit de eigen Cupra- en Alfen-data.

### Vaste databronnen
- SOC: `sensor.garage_cupra_born_accuniveau`
- Kilometerstand: `sensor.garage_cupra_born_kilometerstand`
- Actieradius: `sensor.garage_cupra_born_actieradius`
- Buitentemperatuur: `sensor.garage_cupra_born_buitentemperatuur`
- Doeltemperatuur cabine: `sensor.garage_cupra_born_doeltemperatuur`
- Geladen energie Cupra: `sensor.garage_cupra_born_geladen_energie`
- Klimaatverbruik: `sensor.garage_cupra_born_klimaatverbruik`
- Verbruik boordnet: `sensor.garage_cupra_born_verbruik_boordnet`
- Thuisladen: Alfen totale geleverde actieve energie

De analyse gaat uit van de bewust gekozen VW Group Connect-verversing van circa 15 minuten.

## Kilometeranalyse
- kilometers vandaag
- kilometers laatste 7 dagen
- kilometers laatste 30 dagen
- kilometers dit jaar
- gemiddelde kilometers per kalenderdag
- grafiek per dag; bij jaarweergave per maand

## Praktijkverbruik
Voor geldige rijsegmenten berekent Energiehuis:
- SOC-verlies
- geschatte gebruikte accu-energie op basis van 59 kWh bruikbare capaciteit
- geschat kWh/100 km
- praktijkactieradius
- genormaliseerde Cupra-range versus gerealiseerde praktijkrange

Deze waarden zijn afgeleid en worden als zodanig gelabeld.

## Filteren met Alfen
Een rijsegment wordt niet gebruikt voor de efficiëntieanalyse wanneer tussen twee Cupra-meetpunten thuis is geladen. Een stijgende SOC zonder overeenkomstige Alfen-laadenergie wordt gemarkeerd als vermoedelijk extern laden.

Hierdoor vervuilen de uitzonderlijke externe laadbeurten de hoofdstatistiek niet.

## Temperatuuranalyse
Geldige rijsegmenten worden verdeeld over:
- < 0°C
- 0–5°C
- 5–10°C
- 10–15°C
- 15–20°C
- ≥ 20°C

Per klasse toont Energiehuis onder andere praktijkrange, kWh/100 km, gereden kilometers en — zodra voldoende data bestaat — het verschil ten opzichte van 15–20°C.

## Doeltemperatuur en klimaatvraag
De ingestelde cabine-doeltemperatuur wordt meegenomen naast de buitentemperatuur.

Energiehuis berekent onder meer:
- gemiddelde buitentemperatuur tijdens geldige segmenten
- gemiddelde doeltemperatuur
- gemiddeld verschil tussen doeltemperatuur en buitenlucht
- statistische samenhang tussen buitentemperatuur en verbruik
- statistische samenhang tussen setpointverschil en verbruik

De doeltemperatuur is een setpoint, geen gemeten binnentemperatuur. De getoonde samenhang is daarom indicatief en wordt niet als bewezen oorzaak gepresenteerd.

## Datakwaliteit
De pagina toont:
- aantal geldige rijsegmenten
- kilometers waarop de efficiëntieanalyse is gebaseerd
- uitgesloten segmenten met thuisladen
- vermoedelijke externe laadsessies
- uitgesloten meetruis
- beschikbare periode detailhistorie
- kwaliteitslabel Beperkt / Opbouwend / Sterk

Ontbrekende historische data wordt niet aangevuld met fictieve waarden.

## Veiligheid
Cupra Insights is volledig read-only. Er zijn geen wijzigingen aan:
- Alfen laadsturing
- EMS / Active Load Balancing
- Cupra slim laden
- laadlimieten
- virtuele batterijlogica
