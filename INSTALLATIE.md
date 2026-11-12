# iPhone-praktijktest naast Energiehuis v1.28.0

Testbasis: PR #59 HEAD `be2f2b943b7ddb77baa42eb135ab33084cea44b4`.
Dit is een apart gebouwde testvariant: alleen custom-elementnaam, stubtype en naam in de kaartkiezer zijn gewijzigd. De sessie- en cockpitcode is gelijk aan deze PR-HEAD. Dit is geen HACS-release.

## Installeren

1. Download `energiehuis-card-pr59-test-be2f2b9.js` uit deze map. Plaats het via je bestaande bestandsbeheer in `/config/www/energiehuis-card-pr59-test-be2f2b9.js` op Home Assistant. Maak `www` indien nodig aan. Dit betreft alleen de JavaScript-kaart; laat de beveiligde scèneafbeelding op de bestaande Media Source-locatie staan.
2. Ga in Home Assistant naar **Instellingen → Dashboards → ⋮ → Resources** (zo nodig geavanceerde modus inschakelen). Voeg een resource toe van type **JavaScript-module**:

   `/local/energiehuis-card-pr59-test-be2f2b9.js?v=be2f2b9`

   Laat de bestaande HACS-resource voor Energiehuis staan.
3. Maak een aparte testweergave/dashboard. Kopieer de YAML van je bestaande Energiehuis-kaart. Behoud alle eigen sensoren en het bestaande `live_cockpit_image`-pad. Wijzig/voeg uitsluitend deze sleutels toe:

   ```yaml
   type: custom:energiehuis-card-pr59-test
   live_cockpit: true
   live_cockpit_immersive: true
   charge_control_enabled: false
   ```

   Dit blok is een aanvulling op je bestaande configuratie, geen vervanging ervan.
4. Herlaad de frontend op de iPhone. Controleer dat zowel de bestaande kaart als de nieuwe testkaart opent. Het interne versienummer blijft v1.28.0; het aparte kaarttype en de resource-URL onderscheiden de testversie. De kaartkiezer noemt de testkaart `Energiehuis PR59 TEST be2f2b9`.

## Testen en terugmelden

Noteer iPhone-model, iOS-versie en Safari of HA Companion-app. Test met echte gegevens:

- Portret, landscape en enkele keren draaien: volledig beeld, geen bedekte knoppen bij notch/home-indicator.
- Zes routes, prijs, Alle metingen en Terug naar Home. Controleer Slim laden, batterij en kosten zonder laadopdrachten te starten of instellingen/contracten op te slaan. Beide kaarten gebruiken dezelfde bestaande opslagkeys; het aparte kaarttype is geen aparte dataomgeving.
- Vergelijk actuele waarden en dagtotalen met de bestaande HA-sensoren. Noteer ontbrekende of afwijkende waarden.
- Tijdens een gewone lopende laadsessie: noteer het sessielabel en welke punten de Alfen-tellerhistorie bevat. `Sessie: niet beschikbaar` is bij onzekere historie de verwachte terugval. Start of onderbreek het laden niet speciaal voor deze controle.
- App wisselen en terugkeren, grotere tekst en eventueel VoiceOver. Test netwerkherstel alleen als dit praktisch kan.

Geef per punt geslaagd, mislukt of niet uitgevoerd door. Een screenshot mag helpen; deel geen tokens of ondertekende Media Source-URL's.

## Terug naar uitsluitend v1.28.0

Verwijder de testkaart/testweergave, daarna alleen de hierboven toegevoegde resource en het testbestand. Herlaad de frontend. De bestaande HACS-resource en oorspronkelijke kaart blijven behouden.

## Status

Gebouwd: ja, uit bron met het bestaande buildscript; buildpariteit en syntax geslaagd. Bron-HEAD: hierboven. SHA256 van het testbestand staat in `provenance.json`.

De gewone PR-bundel heeft 409/409 Node-tests in beide tijdzones en 47/47 immersive-controles in Chromium; reviewer en CI bevestigen ook WebKit. De hernoemde testvariant is aanvullend in Chromium gecontroleerd: beide kaarttypes registreren in beide laadvolgordes naast elkaar, zonder JavaScript-fouten. Dat bewijst geen gedrag op een fysieke iPhone.

Praktisch getest: nog niet. Deze testvariant is niet geïnstalleerd in jouw HA en niet gepubliceerd via HACS. Toestemming voor merge en release is gegeven voor nadat de afgesproken controles klaar zijn; het praktijkresultaat moet nog worden vastgelegd.
