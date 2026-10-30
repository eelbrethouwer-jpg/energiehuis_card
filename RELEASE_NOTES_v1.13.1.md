# Energiehuis v1.13.1 — Contract selecteren en opslaan

## Wat is opgelost
- Correct intern versienummer **1.13.1** (was abusievelijk `1.13.0-rc.2`).
- De bestaande v1.13.1-contractselector uit PR #22 en opslagfeedback uit PR #21 zijn opgenomen.
- Automatische regressiecontrole op versielabel en de aansluiting van de snelle opslagknop op browseropslag.

## Aanleiding en publicatie
De release van 30 oktober 2026 is op GitHub abusievelijk getagd als **v1.3.1**. Dat is semantisch een oudere versie dan **v1.13.0** en kan de HACS-update blokkeren of onduidelijk maken. De oude tag niet hergebruiken of verplaatsen; publiceer na merge en groene checks een **nieuwe release met exact tag `v1.13.1`**, vanaf de definitieve main-commit.

Bij acceptatie in Home Assistant controleren dat de kaart **v1.13.1** toont. Daarna via *Kosten → Stroomvergelijker → Aanbieder uit tarievenlijst* een vast contract selecteren en opslaan. Controleer dat het contract verschijnt, ook na vernieuwen van de pagina. Herhaal op iPhone/HA Companion en probeer dynamisch contract (mag onberekenbaar zijn zonder geschikte prijssensor).

## Risico's en grenzen
- Deze correctie verandert **uitsluitend het interne versielabel** in de kaart. Geen wijziging aan bestaande Vattenfall-grafieken, contractmodellen of laadbediening.
- Contracten worden nog steeds **lokaal per browser/app** bewaard, niet gedeeld tussen apparaten. Exporteer een JSON-back-up.
- Werking op het eigen HA-apparaat is niet op afstand vastgesteld; browsercache, HACS-installatie en opslagtoegang blijven te verifiëren.
- Geen release publiceren totdat CI groen is.
