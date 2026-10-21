# Energiehuis v1.5.0 — release candidate

## Nieuwe cumulatieve kostenvergelijking

De pagina **Kosten & Besparing** krijgt een interactieve grafiek **Cumulatief verschil**.

### Twee perioden
- **Deze maand** — dagelijkse cumulatieve ontwikkeling vanaf €0 op de eerste dag van de maand.
- **Dit jaar** — maandelijkse cumulatieve ontwikkeling vanaf €0 op 1 januari.

### Twee referenties
- Vattenfall 1 jaar
- Vattenfall 3 jaar

De lijn wordt rechtstreeks opgebouwd uit de historische kosten van dezelfde periode:

`Vattenfall kosten − Zonneplan kosten`

Daarom geldt:
- boven €0 = Zonneplan is cumulatief goedkoper;
- onder €0 = Zonneplan is cumulatief duurder.

### Interactief
- tik of sleep over de grafiek;
- toon datum/maand van het gekozen punt;
- toon het cumulatieve verschil voor beide Vattenfall-referenties;
- duidelijke horizontale €0-lijn;
- het laatste punt wordt afgestemd op de actuele bedragen uit de maand- of jaartabel.

### Datakwaliteit
De grafiek gebruikt Home Assistant Recorder / langetermijnstatistieken van de bestaande kostensensoren. Ontbrekende historie wordt niet verzonnen. Als onvoldoende statistieken beschikbaar zijn, toont Energiehuis dat expliciet.

### Financiële scheiding
De grafiek vergelijkt alleen **contractkosten voor stroom**. Slimme timing, Cupra-laadvergoeding en virtuele-batterijbesparing worden niet bij deze grafiek opgeteld.

## Veiligheid
Geen wijzigingen aan:
- Cupra slim laden
- Alfen laadsturing
- EMS / load balancing
- virtuele batterijlogica
