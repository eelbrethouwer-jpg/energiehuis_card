# Energiehuis v1.13.2-rc.1 — Contract opslaan betrouwbaar maken

## Aanleiding
De gebruiker meldt dat contracten ook na v1.13.1 niet worden toegevoegd. De exacte storing is nog niet op diens Home Assistant reproduceerbaar onderzocht. In de code is een reëel kwetsbaar pad gevonden: opslaan leunt op het eerder ontvangen `change`-event van de keuzelijst, terwijl de actuele waarde al gekozen kan zijn. De browseropslag werd bovendien niet teruggelezen.

## Gerichte correcties
- De snelle knop leest de actuele DOM-waarde bij de klik; hij is beschikbaar zodra de catalogus geladen is (zonder contractkeuze volgt een duidelijke melding).
- `localStorage`-schrijfactie wordt direct teruggelezen en alleen dan als geslaagd gemeld. Geblokkeerde opslag levert een zichtbare fout, geen schijnsucces.
- Succesmelding en contractoverzicht worden uitsluitend bij bevestigde opslag bijgewerkt.
- Regresstest met een veranderde keuzelijstwaarde zonder `change`-event plus daadwerkelijk opgeslagen JSON en paginaherlading.
- Bestaande Vattenfall 1-/3-jaarsgrafieken, prijssensoren, laadbediening en contractschema ongewijzigd.

## Acceptatie
1. GitHub JS-, unit-/regressie-, HACS- en Chromiumchecks groen.
2. In Home Assistant: vast contract selecteren → Opslaan → contract verschijnt; pagina herladen → contract blijft bestaan.
3. Herhaal op HA Companion en controleer bij opslagweigering de foutmelding onder de knop.
4. Controleer de twee bestaande Vattenfall-grafieken en dynamisch contract zonder kale beursprijssensor (wel opslaan, geen onterechte berekening).

**RC, niet gemergd/gepubliceerd.** Praktijkacceptatie nog noodzakelijk. Geen data-opslag in HA backend; contracten blijven per browser/Companion gescheiden.