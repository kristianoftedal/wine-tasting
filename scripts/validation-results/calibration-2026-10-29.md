# Soft-engine calibration — 2026-10-29

Commit `0c08650`; frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields); 400 calibration wines (catalogue ids 3000–3399, none tasted).

## Centring

| family | model | vectors | dims | ‖mean‖ (0 = isotropic, 1 = collapsed) |
| --- | --- | --- | --- | --- |

## MaxSim floor per reference-length bucket (centred vectors)

Random pairs: every taster note against each calibration wine's note of the same field. True pairs: the note against its own wine. Separation = (true − random) / sd(random).

| engine | bucket | random pairs | b = mean random | sd random | true pairs | mean true | separation | exact-match level (top) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| colbert-table | 1-3 | 50805 | 0.099 | 0.132 | 41 | 0.165 | 0.49 | 0.682 (n=223) |
| colbert-table | 4-6 | 30245 | 0.209 | 0.134 | 111 | 0.357 | 1.11 | 0.682 (n=223) |
| colbert-table | 7-10 | 5570 | 0.267 | 0.139 | 72 | 0.427 | 1.15 | 0.682 (n=223) |
| colbert-tuned | 1-3 | 50805 | 0.091 | 0.165 | 41 | 0.147 | 0.34 | 0.716 (n=222) |
| colbert-tuned | 4-6 | 30245 | 0.238 | 0.138 | 111 | 0.387 | 1.08 | 0.716 (n=222) |
| colbert-tuned | 7-10 | 5570 | 0.313 | 0.132 | 72 | 0.475 | 1.23 | 0.716 (n=222) |

The OpenAI engine is listed for comparison only; it centres instead of rescaling and ignores this file.
