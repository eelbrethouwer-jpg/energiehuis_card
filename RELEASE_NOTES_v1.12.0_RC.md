# Energiehuis v1.12.0-rc.1 — onafhankelijke batterijprofielen

**Releasekandidaat, niet gepubliceerd.** Gebaseerd op de meest recente \`main\` na v1.11.0 intern. Dit is een optische en analytische update; geen batterij en geen Alfen- of Cupra-sturing.

## Nieuw op batterijpagina
- Elk scenario 5, 10 en 15 kWh heeft zijn **eigen SOC**, maximaal bruikbare capaciteit, laadvermogen en ontlaadvermogen.
- Drie aanklikbare batterijkaarten naast elkaar (op smalle schermen onder elkaar), met piekvulling, bruikbare opslag, theoretisch niet opgeslagen PV door volle batterij en vermeden netafname.
- Vergelijkingstabel toont apart hoeveel zonne-energie niet opgeslagen kon worden wegens **capaciteitslimiet**.
- Uurdetail toont apart gemist zonne-overschot door volle accu en door maximaal laadvermogen.
- De SOC-grafiek schaalt naar de **bruikbare** capaciteit als die afwijkt van de nominale 5/10/15 kWh.
- Begrijpelijke toelichting wanneer drie batterijgroottes hetzelfde resultaat geven omdat de meetdata niet méér energie beschikbaar stelt.
- De oude Home Assistant 10-kWh-batterij blijft expliciet apart; klik op 5/10/15 verandert géén bestaande 10-kWh-entiteiten.

## Instelbare batterijprofielen (uitsluitend Lovelace-rekenaannames)
Optionele **extra kaartconfiguratie**, niet nodig om de standaardsimulatie te laten werken:

| Kaartoptie | Betekenis | Standaard |
| --- | --- | --- |
| \`battery_5_usable_pct\` | Bruikbaar percentage van 5 kWh | 100 |
| \`battery_5_charge_kw\` / \`battery_5_discharge_kw\` | Laad-/ontlaadvermogenslimiet | Algemene \`battery_sim_power_kw\` (3 kW) |
| \`battery_10_usable_pct\` | Bruikbaar percentage van 10 kWh | 100 |
| \`battery_10_charge_kw\` / \`battery_10_discharge_kw\` | Laad-/ontlaadvermogenslimiet | Algemene \`battery_sim_power_kw\` (3 kW) |
| \`battery_15_usable_pct\` | Bruikbaar percentage van 15 kWh | 100 |
| \`battery_15_charge_kw\` / \`battery_15_discharge_kw\` | Laad-/ontlaadvermogenslimiet | Algemene \`battery_sim_power_kw\` (3 kW) |

Bovenstaande **zijn niet** de specificaties van een bepaald product. Zonder bekend model, omvormer, reservemarge of gegevensblad kiezen we géén verzonnen onderlinge vermogensverschillen. De capaciteiten verschillen van zichzelf wél. Ongeldige limieten vallen terug op de conservatieve algemene rekeninstelling.

## Bekende modelbeperkingen
- Gebaseerd op historische Home Assistant P1-uurstatistieken. Het is geen echte batterij en geen in-/uit-vermogenmeting.
- Het model kan niet bepalen of er binnen hetzelfde uur eerst zonnestroom en daarna netafname was; hierdoor is dit een conservatieve uurbenadering.
- Er wordt met een lege batterij begonnen; ontbrekende uren resetten een onobserveerbare SOC.
- De drie virtuele batterijen krijgen **exact dezelfde P1-uren**; geen manipulatie om grotere batterijen aantrekkelijker te maken.
- \`pvLimitedCapacity\` en \`pvLimitedPower\` zijn theoretische delen van P1-teruglevering die in het model niet passen. Ze zijn geen voorspelling van werkelijk fysiek opwekverlies.
- De simulatie gebruikt standaard 100% bruikbare nominale capaciteit en een algemeen vermogen van 3 kW als **rekenaannames** totdat werkelijke productspecificaties zijn ingevuld.
- Smart charge gebruikt uitsluitend historische stroomprijzen wanneer volledig beschikbaar. Geen actieve laadbesturing, geen toetsing aan het echte 1×40 A-piekvermogen en geen garantie op besparing.
- De bovenste bestaande Home Assistant 10-kWh-sensoren blijven onveranderd en kunnen afwijken van de geselecteerde simulatie.
- Omdat Zonneplan pas op 1 november 2026 start, zijn eventuele voorliggende eurobedragen geen gerealiseerde Zonneplan-besparingen.

## Home Assistant
**Geen nieuwe Home Assistant-sensoren, scripts, helpers, automations of YAML nodig.**
Benodigd: valide langetermijnstatistieken voor P1-import en P1-export. Historische Zonneplan-uurprijzen zijn optioneel. Een eventuele Lovelace-kaartconfiguratie voor specifieke batterijen kan later worden ingesteld zonder wijzigingen aan de meetbronnen.

## Testen
- Nieuwe \`tests/v112-battery-profiles.test.cjs\`: capaciteit 5/10/15, SOC, afzonderlijke laad-/ontlaadvermogens, bruikbare capaciteit, te volle accu, laadvermogenslimiet, gelijke scenario-uitkomsten, missing data en interactieve weergave.
- Bestaande v1.7 t/m v1.11 regressietests behouden.
- CI en echte Home Assistant-/iPhone-validatie vóór release controleren.
