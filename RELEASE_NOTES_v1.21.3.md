# Energiehuis v1.21.3 – Persoonlijke meetbasis batterijvergelijker

De batterijpagina toont nu waarop de vergelijking berust: gemeten netafname en teruglevering, bruikbare P1-uren, historische prijsdekking, ontbrekende/ongeldige uren en dubbele tijdstippen. Het blok maakt duidelijk welke gegevens nog ontbreken voor een persoonlijk aankoopadvies.

Het technische ontwerp voor de verdere batterijvergelijker staat in BATTERY_PERSONAL_COMPARISON.md: productgegevens en offertes, seizoenshistorie, eerlijke Cupra-referenties, tarieven, verliezen, degradatie en financiële kasstromen.

## Validatie
- 176 Node-tests geslaagd met TZ=UTC, dezelfde tijdzone als GitHub CI.
- Syntax en HACS-metadata gecontroleerd.
- Publicatieworkflow controleert leveranciers- en batterijpagina in Chromium vóór publicatie, inclusief meetbasis, uitklapstatus en 320/390/768/1280 px.
- Tijdzonegevoelige bestaande testfixtures geven lokaal met Europe/Amsterdam tien afwijkende verwachtingen; dit is geen nieuwe regressie van deze wijziging.

## Grenzen
Dit is de eerste basis voor de vergelijker. Echte productvergelijking, seizoenssimulatie en persoonlijk aankoopadvies volgen nog. Bestaande periodeberekeningen blijven indicatief. Controle met de eigen Home Assistant-data en iPhone-praktijkacceptatie zijn nog niet uitgevoerd.

Werk Energiehuis bij via HACS en vernieuw daarna de dashboardpagina. Er is geen nieuwe YAML nodig.
