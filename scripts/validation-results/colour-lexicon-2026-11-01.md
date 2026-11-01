# Colour lexicon vs stored OpenAI colour scores — 2026-11-01

129 tastings with a colour phrase and a stored score.

| | value |
| --- | --- |
| Spearman(lexicon, stored) | 0.500 |
| Pearson | 0.456 |
| stored mean / sd | 56.6 / 18.8 |
| lexicon mean / sd | 83.3 / 23.4 |
| level fit stored ≈ a + b·lexicon | a 26.01, b 0.367 |

## Largest disagreements

| taster | reference | stored (OpenAI) | lexicon | lexicon levelled |
| --- | --- | --- | --- | --- |
| Korngul | Lys strågul. | 21 | 100 | 63 |
| Gul | Middels dyp strågul. | 28 | 100 | 63 |
| Lilla | Dyp blårød. | 27 | 90 | 59 |
| Lys tød | Lys rød. | 66 | 25 | 35 |
| Gul | Lys strågul. | 32 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Dyp rød | Dyp rød. | 93 | 100 | 63 |
| Lys strågul | Lys strågul. | 93 | 100 | 63 |
| Lys strågul | Lys strågul. | 93 | 100 | 63 |
| Strågul | Middels dyp gul med grønnskjær. | 33 | 100 | 63 |

## Sanity pairs

| taster | reference | lexicon |
| --- | --- | --- |
| lys strågul | Dyp rød. | 0 |
| rubinrød | Dyp rød. | 100 |
| lys rød | Lys rubinrød. | 100 |
| rosa | Lys lakserosa. | 90 |
| gyllen | Lys strågul. | 75 |
| dyp rød/lilla | Dyp blårød. | 98 |
| mørk rød, lett brun | Dyp rubinrød, brunskjær. | 86 |
| uringul | Lys gul. | 0 |
