# CLAUDE.md — instructies voor Claude Code

**Lees eerst [`AGENTS.md`](AGENTS.md).** Daar staan de gezamenlijke regels voor alle agents; die gaan altijd voor. Dit bestand bevat alleen aanvullingen voor Claude Code en herhaalt die regels niet.

## Start van een sessie
- Controleer de remote `main`-HEAD met `git ls-remote origin refs/heads/main` en vergelijk die met de lokale checkout. Werk niet verder op een verouderde of afwijkende baseline zonder dat te melden.
- Lees het bovenste statusblok van `PROJECT_STATUS.md` en controleer of het nog klopt met GitHub.
- Ga na of de sessie GitHub-API-toegang heeft (PR's, CI, releases). Ontbreekt die, meld dat dan expliciet in plaats van een status aan te nemen.

## Werkwijze
- Volg de opdracht letterlijk qua scope. Is een opdracht "read-only" of "geen wijzigingen", maak dan geen branches, commits of PR's.
- Een branchnaam die in de opdracht staat, gebruik je exact.
- Omzeil geen permissie- of beveiligingsblokkades van de sessie. Vraag toestemming of rapporteer de blokkade; lever bij ontbrekende schrijftoegang een patch.
- Maak, bewaar of toon geen tokens of andere credentials.
- Voer code uit de repository (tests, build) alleen uit als de sessie daarvoor toestemming heeft.

## Rol als reviewer naast ChatGPT
- Review op de exacte HEAD-SHA van de PR en vermeld die, volgens de verslagregels in `AGENTS.md`.
- Maak onderscheid tussen tests op de PR-HEAD en op een mergecommit, en tussen lokaal gedraaide tests en CI-uitkomsten.
- Vink in documenten (zoals `CLAUDE_REVIEW_*.md` of release notes) een Claude-review alleen af als die review in deze sessie daadwerkelijk is uitgevoerd.

## Overdracht
Sluit een taak af met een handoff: branchnaam, HEAD-SHA, gewijzigde bestanden, uitgevoerde controles met resultaten, PR-link (indien aanwezig), blokkades en de voorgestelde eerstvolgende stap.
