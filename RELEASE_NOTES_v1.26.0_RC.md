# Energiehuis v1.26.0 — Visual Experience (releasekandidaat)

**Status: PR / NIET MERGEN, TAGGEN OF PUBLICEREN.** De actieve `EH_VERSION` en HACS-kaartregistratie blijven bewust op v1.25.0 zolang dit uitsluitend een ontwerp-PR is.

## Doel
Een rustige, levendige, mobile-first energie-app in plaats van zes afzonderlijke schermen met herhaalde kaarten. De herinrichting bouwt voort op de eerste EnergieRegisseur-cockpit van v1.25.0.

## Scope van deze PR
- Vaste ondernavigatie toont **Home / Laden / Inzicht / Meer**. De knop **Inzicht** biedt direct toegang tot de bestaande Cupra-, Batterij- en Kostenpagina's; er verdwijnen geen functies.
- Cockpit krijgt een dominante live netmeter, een overzichtelijke hiërarchie, kleuraccenten voor zon/huis/Cupra/prijs, grafiekruimte en meer witruimte; onbekende waarden blijven streepjes, niet gefabriceerd.
- De eerdere acht meterkaarten en uitgebreide historische vermogensgrafiek staan op **Home** voortaan achter de uitklapbare sectie **Alle metingen en uitgebreide grafiek**; de bestaande sensorkoppelingen, grafiekknoppen en detailacties blijven bestaan.
- De standaard achtergrondfoto van het overzicht wordt op de nieuwe homebasis vervangen door een rustige kleurgradient; een expliciet ingestelde `hero_image` blijft behouden.
- Overige pagina's krijgen een consistentere kaartpresentatie en typografie.
- Geen nieuwe Home Assistant-servicecalls, prijzen, berekeningen, opslagkeys, Cupra- of Alfen-commando's. `charge_control_enabled` blijft standaard uitgeschakeld.

## Bewuste beperkingen
- De dataproblemen uit de gebruikersscreenshots (GoodWe/huisverbruik) vallen **niet** onder deze UI-PR: diagnose in HA volgt apart.
- De lineaire €501,65-maandprognose is niet aangepast; hiervoor volgt een aparte datakwaliteits-/reken-PR.
- Deze eerste UI-PR is geen complete v2.0 en geen bewijs van live iPhone-acceptatie.
- De nieuwe ondernavigatie gebruikt bestaande interne pagina's, zonder nieuwe Lovelace-route of persistente instellingen.
- De uitklapstatus wordt alleen tijdelijk in het kaartobject onthouden en schrijft niet naar localStorage.

## Verplichte controles vóór GO
1. `node scripts/build.cjs --check`, `node --check energiehuis-card.js`, Node-regressies (UTC en Europe/Amsterdam), bestaande Chromium-suite en specifieke mobiele controles.
2. iPhone-breedtes **320/390 px**, tablet **768 px**, desktop **1280 px**: geen overflow; veilige iOS-onderbalk; vier nav-items; menu opent, sluit en navigeert; alle drie inzichten bereikbaar.
3. Detailklikken vanuit cockpit en uitgeklapte legacy meters. Bij Home-datavernieuwing blijft de uitklapstatus bruikbaar. Nacht-PV 0 W, Alfen 0 W en verouderde meetwaarden blijven eerlijk gelabeld.
4. **Geen regressies** in Slim laden, batterij, contractopslag, kosten, Cupra Insights, History en optionele scriptbediening (uitgeschakeld).
5. Onafhankelijke review door Claude op exacte HEAD plus review van de afwijkingen; alleen als Claude daadwerkelijk is geraadpleegd mag dit afgevinkt worden.

## Acceptatie in echte Home Assistant
Controleer na een goedgekeurde testpublicatie de scrollpositie onder de HA-toolbar, het uitklapgedrag bij realtime sensorupdates en de leesbaarheid van de onderbalk op een fysieke iPhone. **Nog niet uitgevoerd.**

## Vervolg na de UX-release
P1/GoodWe/huisentiteiten herstellen, het kostenbudget met betrouwbare data en een seizoensgeschikte prognose verbeteren, en vervolgens laden op 30–40 kWh-sessies optimaliseren. Dit zijn zelfstandige PR's en vallen bewust buiten deze visuele wijziging.
