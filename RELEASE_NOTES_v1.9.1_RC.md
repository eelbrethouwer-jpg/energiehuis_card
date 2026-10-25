# Energiehuis v1.9.1-rc.1 — Virtuele-batterijvergelijking verduidelijkt

**Bugfix-releasekandidaat — niet gepubliceerd.** Gebaseerd op huidige main van v1.9.0.

## Opgelost
- De keuzes 5, 10 en 15 kWh veranderen zichtbaar de **scenarioselectie**, hergebruik-kWh, indicatieve besparing en verschil met 5 kWh waar meetdata een capaciteitsverschil ondersteunt.
- Wanneer capaciteiten dezelfde bedragen opleveren, legt Energiehuis uit dat de beperkte dagelijkse teruglevering of netafname de berekening begrenst.
- Toont alle drie de scenario's naast elkaar; maakt zichtbaar welke geselecteerd is, ook als bedragen gelijk blijven.
- Zonder voldoende bruikbare recorderdagen toont de kaart ontbrekende metingen en geen verzonnen besparing.
- Het bovenste gedeelte is expliciet gemarkeerd als **vaste 10-kWh-simulatie uit Home Assistant**. Deze backendwaarden veranderen niet door de scenarioknoppen.
- Toegankelijkheid: `aria-pressed` op de knoppen en begrijpelijke statusuitleg.

## Rekenmodel en beperkingen
- Voortbouwend op v1.9.0: dagtotalen van P1-netafname en teruglevering voor maximaal 7 eerdere dagen.
- Energieschatting per dag: `min(capaciteit, teruglevering, netafname / roundtrip-rendement)`. Maandprognose is slechts een indicatieve bovengrens, geen echte chronologische laad-/ontlaadsimulatie.
- Kostenvoorbeeld gebruikt configureerbare tarieven voor vermeden inkoop en gemiste teruglevering; geen historische uurprijzen.
- Er wordt **niets** in `virtuele_batterij.yaml`, aan Home Assistant-entiteiten of aan Alfen gewijzigd.

## Testen
- Nieuwe regressietests voor verschillende/equal uitkomsten, ontbrekende historie en intacte vaste 10-kWh-gedeelte.
- Bestaande v1.7, v1.8 en v1.9 tests blijven behouden.
- GitHub Actions en echte Home Assistant-/iPhone-test zijn vereist vóór samenvoegen/publicatie.

## Later
Een volwaardige vergelijkbare 5/10/15-kWh-businesscase inclusief laden bij goedkope stroomuren, echte uurtarieven, zonnepanelen, P1-vermogenslimieten en degradatie vergt een nieuw backend-/uursimulatiemodel; niet inbegrepen in deze hotfix.
