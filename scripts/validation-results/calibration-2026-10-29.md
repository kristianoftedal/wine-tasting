# Soft-engine calibration — 2026-10-29

Commit `42ac7d7`; frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields); 400 calibration wines (catalogue ids 3000–3399, none tasted).

## Centring

| family | model | vectors | dims | ‖mean‖ (0 = isotropic, 1 = collapsed) |
| --- | --- | --- | --- | --- |
| cooc | catalogue co-occurrence PPMI+SVD (53901 wines, df ≥ 5, α 0.75) | 3519 | 128 | 0.462 |

## MaxSim floor per reference-length bucket (centred vectors)

Random pairs: every taster note against each calibration wine's note of the same field. True pairs: the note against its own wine. Separation = (true − random) / sd(random).

| engine | bucket | random pairs | b = mean random | sd random | true pairs | mean true | separation | exact-match level (top) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cooc | 1-3 | 50805 | 0.135 | 0.270 | 41 | 0.278 | 0.53 | 1.000 (n=223) |
| cooc | 4-6 | 30245 | 0.281 | 0.266 | 111 | 0.556 | 1.03 | 1.000 (n=223) |
| cooc | 7-10 | 5570 | 0.390 | 0.263 | 72 | 0.636 | 0.94 | 1.000 (n=223) |

The OpenAI engine is listed for comparison only; it centres instead of rescaling and ignores this file.
