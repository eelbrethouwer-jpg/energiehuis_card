# Energiehuis v1.12.1 — Versielabelcorrectie

Deze patch herstelt de versieaanduiding van de gepubliceerde v1.12.0-code, die intern nog als `1.12.0-rc.1` werd getoond.

## Wijzigingen
- Interne kaartversie en footer zijn nu `1.12.1`.
- De Lovelace custom-cardregistratie toont `Energiehuis v1.12.1`.
- De bestaande tests verwachten de nieuwe, definitieve versieaanduiding.
- Geen veranderingen aan batterijberekening, 5/10/15-kWh-profielen, P1, GoodWe, Zonneplan, Alfen-laadsturing of load balancing.

## Veiligheid en compatibiliteit
- Optionele scriptbediening blijft standaard uitgeschakeld.
- Geen nieuwe Home Assistant-YAML, sensoren of helpers nodig.
- De bestaande HACS-release `v1.12.0` blijft ongewijzigd.
- De patch kan na samenvoegen en succesvolle controles als **nieuwe** release met tag `v1.12.1` worden gepubliceerd. Alleen samenvoegen met `main` levert nog geen HACS-update op.

## Teststatus
- Bestaande regressietests en GitHub-/HACS-controles moeten op de finale PR-commit slagen.
- Praktijktest in Home Assistant blijft nodig om de daadwerkelijke weergegeven versie en batterijpagina te controleren.
