# Energiehuis v1.9.0-rc.1 — Mobiele App Experience

**Releasekandidaat, nog niet gepubliceerd in HACS.** Gebaseerd op v1.8.2.

## Gebouwd
- Nieuwe compacte mobiele werkbalk met actuele sectienaam.
- Schakelbare **Compact / Ruim**-weergave. Alleen de UI-voorkeur wordt lokaal bewaard; nooit meetdata of tokens.
- Kortere hero, kleinere kaarten en dichtere overzichten op smalle schermen: minder scrollen.
- Onderste navigatie blijft op mobiele breedtes in beeld **zolang de Energiehuis-kaart zelf zichtbaar is**; bij gebrek aan browserondersteuning blijft de bestaande sticky navigatie beschikbaar.
- Statuswaarschuwing wanneer browser offline is of Home Assistant de verbinding expliciet als verbroken meldt. Geen ongefundeerde 'live'-garantie.
- Insteloptie `mobile_fixed_navigation: false` voor dashboards waarop een zwevende balk kan storen.
- Alle zes navigatiepagina's, simulaties, grafieken en laadbeveiligingsuitgangspunten blijven in de bestaande kaart.

## Techniek
- Mobiele uitbreiding is geïsoleerd van de bestaande v1.8.2 logica; geen extra Home Assistant-entiteiten vereist.
- Een IntersectionObserver toont/verbergt de vaste navigatie op basis van de kaartpositie.
- Browsernetwerk-events verversen de statusmelding en worden bij ontkoppelen opgeruimd.
- Node-regressietests inclusief v1.7/v1.8-tests en nieuwe v1.9 mobiele tests.

## Nog niet gebouwd / bewust buiten scope
- **Geen zelfstandige installeerbare PWA**, nog geen manifest, service worker of eigen login.
- Geen wijziging aan de Home Assistant-omgeving buiten de kaart. De Home Assistant-appinterface kan nog zichtbaar zijn.
- Geen actieve laadcommando's, wijzigingen aan Alfen, of aan de virtuele-batterijberekening.

## Acceptatie voor definitieve release
1. GitHub Actions op PR groen, inclusief test v1.9.
2. iPhone Safari én Home Assistant Companion App: compact, ruim, scroll, tabs en accugrafieken.
3. Android Chrome: normale en beperkte breedte; controleer veilige schermranden.
4. Dashboard met méér dan één kaart: schakel `mobile_fixed_navigation: false` in indien de zwevende balk in de weg zit.
5. Offline-/verbindingstest en terugkeer online.
6. Uitvoerig toetsen van eerdere batterij 5/10/15 kWh-selectie, Cupra, kosten, net/PV/gas/water en grafieken.

Zie [PWA technische verkenning](PWA_SPIKE_v1.9.0.md). **Niet taggen als v1.9.0 voordat praktijkacceptatie is afgerond.**
