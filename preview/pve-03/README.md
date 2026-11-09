# PVE-03 — Cinematic Energy Experience

Deze branch is de **geïsoleerde werkplek voor Claude Code**. Fase 1 is uitsluitend een lokale browser-DEMO met fictieve meetwaarden, niet de Home Assistant-productiekaart.

**Start hier:** [CLAUDE_CODE_OPDRACHT.md](CLAUDE_CODE_OPDRACHT.md)

**Bewaarde technische referentie:** [Claude F2 standalone](reference/claude-f2-standalone.html). Dit is de byte-identieke oorspronkelijke F2-bron en nog **geen** PVE-03-implementatie.

**Tweede referentie:** ChatGPT PVE-01 op de aparte branch [preview/chatgpt-premium-pve01](https://github.com/eelbrethouwer-jpg/energiehuis_card/tree/preview/chatgpt-premium-pve01/preview/pve-01).

**Visueel doel:** de door de eigenaar op 9 november 2026 goedgekeurde fotorealistische afbeelding (moderne woning met zonnepanelen, afzonderlijke praktijkruimte links, knalgroene Cupra rechts, Net midden onder het huis). Het origineel is in de ChatGPT-gespreksgeschiedenis geüpload en staat **niet** op deze GitHub-branch. Gebruik de beschrijving in de opdracht en laat deze afbeelding alleen als visuele referentie aan Claude toevoegen wanneer hij nog niet beschikbaar is.

**Baseline:** main \`62fa09cbd6dd3c4d481c0669c9cbac4f8a39aae9\`. Post-merge GitHub Actions op deze commit (9 november 2026) gecontroleerd: [Node-regressies](https://github.com/eelbrethouwer-jpg/energiehuis_card/actions/runs/42602211572), [Chromium](https://github.com/eelbrethouwer-jpg/energiehuis_card/actions/runs/42602211941) en [HACS-validatie](https://github.com/eelbrethouwer-jpg/energiehuis_card/actions/runs/42602211657) zijn geslaagd. Dit zijn baseline-tests, **geen** tests van toekomstige PVE-03-code.

**Scope:** alle nieuwe code alleen onder \`preview/pve-03/\`. Geen bestaande productiecode, laadregeling, HACS-resource, bestaande branche of release wijzigen.

**Status:** voorbereid voor ontwikkeling via Claude Code. De PVE-03-implementatie, screenshots en eigen tests zijn nog **niet** gemaakt. Geen PR, merge, tag of release.
