# Energiehuis v1.27.0 — Premium Live Cockpit

**Release:** nieuwe fotorealistische Live Cockpit als optioneel Home-startscherm in de bestaande `energiehuis-card`. **Standaard uit**; geen automatische vervanging van het dashboard na HACS-update.

## Nieuw
- De door de eigenaar goedgekeurde PVE-04/HA-01 Live Cockpit: woning, zonnepanelen, groene Cupra, net, praktijkruimte en virtuele batterij, met klikbare glaskaarten en actuele energieanimatie.
- De bestaande Home-cockpit van EnergieRegisseur wordt uitsluitend vervangen wanneer `live_cockpit: true` is ingesteld. Met de schakelaar uit blijft Home zoals voorheen.
- Live-status uit de bestaande Home Assistant-entiteiten; geen DEMO-waarden. Automatische actualiteitscontrole en meetketensynchronisatie. Routegrenzen (P1/huis 60 s; PV/Alfen 90 s) en 10 s synchronisatiemarge zijn voorlopige aannames, niet gemeten op fysieke HA.
- Bij verouderde/offline/onbetrouwbare gegevens stoppen de bewegende deeltjes. De **ingebakken lichtlijnen in de goedgekeurde masterafbeelding blijven decoratief** (ook bij 0 W of offline); expliciet geaccepteerd door de eigenaar.
- Beeld uitsluitend via Home Assistant Media Source met `media_source/resolve_media`, gecontroleerde same-origin `/media/`-URL en veilige terugval als beeld ontbreekt.

## Behoud en bewust verschil
- Laden, Slim laden, contractopslag, kosten, Cupra Insights, batterij, historische grafieken en optionele laadbediening blijven bestaan. De nieuwe cockpit voert **geen** laad- of andere servicecalls uit.
- Met de Live Cockpit **aan** zijn de zes oude EnergieRegisseur-KPI's, waaronder de Zonneplan-prijs, het kleine netvermogentrendgrafiekje en de drie snelkoppelingen niet meer rechtstreeks op Home zichtbaar. De metingen/grafiek blijven via **Alle metingen en uitgebreide grafiek** en Kosten bereikbaar; navigatie blijft aanwezig.
- De praktijkruimte heeft nog geen gekoppelde meter; virtuele batterij is simulatie en geen fysieke opslag.

## Activering in de bestaande Home Assistant-kaart
1. Installeer v1.27.0 via HACS na publicatie en herlaad het dashboard/de browsercache. Er komt geen tweede dashboardkaart of Cloudflare-preview.
2. Plaats de goedgekeurde WebP in je afgeschermde HA-mediamap, bijv. `/media/energiehuis/approved-visual-20261109.webp`. **Niet** in `/config/www` of een publieke `/local/`-URL.
3. Voeg alleen in de configuratie van je **bestaande** Energiehuis-kaart toe:

   ```yaml
   live_cockpit: true
   live_cockpit_image: media-source://media_source/local/energiehuis/approved-visual-20261109.webp
   ```

   Gebruik bestaande entiteitssleutels (`net`, `zonnepanelen`, `huis`, `laden`, `cupra`, `batterij`); geen nieuwe automatiseringen of laadinstellingen.
4. Verifieer P1-tekenrichting, PV, Alfen, huis en Cupra, synchronisatie van `last_reported` / `last_updated`, herladen van beveiligde media, offline-status en iPhone Companion-app/Safari. Test ook andere schermen en de bestaande Alfen-bediening zonder een nieuwe laadopdracht te starten.

**AANNAME/OPEN:** de master-afbeelding is niet meegeleverd in de HACS-bundel en de daadwerkelijke HA-Media Source, de praktische entiteit-updatefrequenties en de fysieke iPhone zijn nog niet getest. De oorspronkelijke master was reeds publiek in de previewbranch; afscherming van de nieuwe HA-kopie trekt die publicatie niet terug.

## Validatie en terugdraaien
- Feature-PR #54: gemerged; Node 367/367 in twee tijdzones, alle bestaande browsercontroles, nieuwe Live Cockpit-suite Chromium én WebKit en merge-CI groen. De nieuwe release-HEAD moet opnieuw groen zijn vóór publicatie.
- Geen nieuwe HA-servicecalls, opslagkeys, entiteitsmigraties of wijzigingen aan 1×40 A, Alfen EMS of Active Load Balancing.
- Snel terug: verwijder de twee `live_cockpit*`-regels of zet `live_cockpit: false`; het bestaande EnergieRegisseur-Home wordt weer gebruikt. Indien nodig via HACS terug naar v1.25.0; back-up beschikbaar.

## Publicatieprocedure
Geen tag of release door merge. Publiceer uitsluitend vanaf de gevalideerde `main`-commit met de handmatige workflow `publish-v1270.yml`, bevestiging `PUBLISH_v1.27.0`, na controle van groen CI en expliciete eigenaarstoestemming.