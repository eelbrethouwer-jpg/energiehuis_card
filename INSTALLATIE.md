# Vervangende iPhone-testbundel: flikkerfix PR #60

Bron-HEAD: `784994c7d9f291cdc889cc2d6d5bc94ed8270634`. Testvariant met dezelfde aparte kaartregistratie als je bestaande PR59-testkaart. Geen HACS-release.

1. Bewaar een kopie van je huidige testbestand `homeassistant/www/eh-pr59.js` op je laptop.
2. Vervang uitsluitend dat bestand door de nieuwe `eh-pr59.js` uit dit ZIP-pakket. Bestand rechtstreeks in `homeassistant/www/`, niet in de ZIP-submap. De gewone HACS-kaart blijft staan.
3. Pas bij Resources de URL van deze testmodule aan naar `/local/eh-pr59.js?v=784994c`. Type blijft JavaScript-module.
4. Herlaad Home Assistant volledig, ook op de iPhone. De YAML en Kiosk Mode blijven gelijk: `type: custom:energiehuis-card-pr59-test`.
5. Controleer portret en landscape terwijl de netwaarde verandert. Noteer of het beeld nog flikkert; controleer ook menu, navigatie en terug naar Home. De kaartkiezer noemt deze variant `Energiehuis PR60 TEST 784994c`.

Het interne versienummer blijft 1.28.0. De resource-URL en kaartkiezernaam onderscheiden de testvariant. De bestaande opslagkeys en HA-entiteiten blijven gedeeld; wijzig geen instellingen of laadopdrachten tijdens deze leestest.

Terugval: zet je vorige testbestand terug, verander de testresource-URL naar een nieuwe cacheparameter en herlaad. De gewone HACS-resource blijft behouden.

De correctie is nog niet op jouw fysieke iPhone getest. Deze testvariant heeft uitsluitend een andere registratie/stub/kaartkiezernaam dan de PR-bundel. Bijbehorende SHA256 staat in provenance.json. Merge/release volgt pas na de afgesproken review en controles.
