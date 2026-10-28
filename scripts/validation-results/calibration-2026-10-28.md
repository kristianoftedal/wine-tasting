# Soft-engine calibration — 2026-10-28

Commit `6c46bb7`; frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields); 400 calibration wines (catalogue ids 3000–3399, none tasted).

## Centring

| family | model | vectors | dims | ‖mean‖ (0 = isotropic, 1 = collapsed) |
| --- | --- | --- | --- | --- |
| bert | lebchen/norbert3-base-onnx@int8 | 3580 | 768 | 0.663 |
| colbert | lightonai/mLateOn@int8 | 7554 | 128 | 0.978 |

## MaxSim floor per reference-length bucket (centred vectors)

Random pairs: every taster note against each calibration wine's note of the same field. True pairs: the note against its own wine. Separation = (true − random) / sd(random).

| engine | bucket | random pairs | b = mean random | sd random | true pairs | mean true | separation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bert | 1-3 | 50805 | 0.043 | 0.126 | 41 | 0.088 | 0.36 |
| bert | 4-6 | 30245 | 0.127 | 0.124 | 111 | 0.228 | 0.82 |
| bert | 7-10 | 5570 | 0.177 | 0.139 | 72 | 0.293 | 0.83 |
| colbert-word | 1-3 | 50805 | 0.088 | 0.112 | 41 | 0.176 | 0.79 |
| colbert-word | 4-6 | 30245 | 0.151 | 0.105 | 111 | 0.248 | 0.94 |
| colbert-word | 7-10 | 5570 | 0.175 | 0.107 | 72 | 0.281 | 0.99 |
| colbert-token | 1-3 | 50805 | 0.157 | 0.097 | 41 | 0.235 | 0.81 |
| colbert-token | 4-6 | 30245 | 0.206 | 0.095 | 111 | 0.298 | 0.97 |
| colbert-token | 7-10 | 5570 | 0.232 | 0.095 | 72 | 0.333 | 1.06 |
| openai | 1-3 | 50805 | 0.110 | 0.175 | 41 | 0.207 | 0.55 |
| openai | 4-6 | 30245 | 0.222 | 0.197 | 111 | 0.433 | 1.07 |
| openai | 7-10 | 5570 | 0.300 | 0.217 | 72 | 0.541 | 1.11 |

The OpenAI engine is listed for comparison only; it centres instead of rescaling and ignores this file.
