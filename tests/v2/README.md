# EnergieRegisseur v2 — PR 0 (fixtures only)

All inputs in this directory are **synthetic**. No live HA measurements, tokens, personal usage profiles or contract details are included.

- `fixtures/normative/`: correct physical / temporal / monetary arithmetic defined independently of v1 implementation.
- `fixtures/legacy-characterization/`: observed main v1.24.1 behaviour, **not** future normative requirements.
- `fixtures/counterexamples/`: constructive cases that disprove unjustified exact EV-exclusive battery calculations.
- `tests/v2.test.cjs`: CI loader for existing `node --test tests/*.test.cjs` workflow glob; no workflow changes.

UTC is the canonical instant axis. Local Europe/Amsterdam labels are formatting-only. Dates include the 25-hour day on 2026-10-25 and the 23-hour day on 2027-03-28.

**Missing evidence:** Claude's historical E3 values (€6.14/€5.01/€1.13) cannot become golden assertions without his complete input rows. This PR instead uses independently calculable fixtures. Historical market prices, future-price prediction bands, 2027 tax regimes and household-specific meter availability are NOT claimed as validated.

**Design gates E1–E7:** This PR checks contract examples for stale-measured provenance, ambiguous prices, residuals, UTC/DST and EV sub-hour identifiability. It does not implement v2 UI or a production v2 engine. The eventual source-path write scan, actual UI spies, storage consent and price backtest remain blocked until those components exist.

**Baseline:** `927402179ee30f7e098e663b86d62eae42a15ea8` (v1.24.1). PR #41 remains independent.

**Local / CI:**

    node --test tests/*.test.cjs
    TZ=Europe/Amsterdam node --test tests/*.test.cjs
    TZ=America/New_York node --test tests/v2.test.cjs

**Manual negative-control (must exit nonzero, then remove env):**

    EH_V2_TEST_FAIL_PROBE=1 node --test tests/v2.test.cjs

Fixture review checklist for Claude: arithmetic; units; quarter profiles; DST instants; legacy output reproducibility; absence of production changes; loader actually exercised in CI.
