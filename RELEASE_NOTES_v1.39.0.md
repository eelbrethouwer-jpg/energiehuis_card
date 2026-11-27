# Energiehuis v1.39.0 — live batterijdashboard

- **Energie › Batterij** begint met een live paneel: ring met hoe vol de batterij is, kWh, wat hij nu laadt of teruglevert in watt, resterende tijd tot vol of leeg, vandaag geladen en teruggeleverd, besparing vandaag en een 24-uursgrafiek met tik-bubbel (zelfde grafiekbouwer als de kwartierprijzen).
- De virtuele batterij heeft geen vermogenssensor: het vermogen wordt afgeleid uit de verandering van `battery_soc_kwh`. Is de laatste wijziging ouder dan 30 minuten, dan staat er rust. Optioneel: `battery_power` (W of kW) en `battery_power_sign: discharge_positive`.
- Altijd gelabeld als SIMULATIE; ontbrekende of onbekende waarden worden getoond als onbekend, nooit als 0.
- Alleen lezen (geen servicecalls). Nieuwe motor `battery-live-engine.cjs` met eigen tests.
