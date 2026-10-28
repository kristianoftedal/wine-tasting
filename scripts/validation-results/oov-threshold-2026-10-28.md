# Unknown-word mapping threshold — 2026-10-28

Commit `160b917`. 10 positives, 22 negatives, 163 aroma lemmas as targets.

| word | kind | expected | nearest | cosine | nearest is expected |
| --- | --- | --- | --- | --- | --- |
| kjerne | negative | — | kjernefrukt | 0.634 |  |
| brioch | positive | brioche | brioche | 0.625 | yes |
| citrus | positive | sitrus | sitrus | 0.514 | yes |
| meineralsk | positive | mineral | mineral | 0.507 | yes |
| toasty | positive | toast | toffee | 0.477 | no |
| vanilla | positive | vanilje | vanilje | 0.447 | yes |
| besk | negative | — | underskog | 0.400 |  |
| aske | positive | røyk | skinke | 0.349 | no |
| melne | negative | — | morell | 0.345 |  |
| melende | negative | — | lavendel | 0.338 |  |
| temper | negative | — | timian | 0.332 |  |
| minralsk | positive | mineral | mineral | 0.324 | yes |
| skarp | negative | — | skjell | 0.313 |  |
| bobler | negative | — | skifer | 0.295 |  |
| hard | negative | — | fat | 0.293 |  |
| annet | negative | — | anis | 0.292 |  |
| hibiscus | positive | blomst | guava | 0.281 | no |
| flor | negative | — | fløte | 0.281 |  |
| forrige | negative | — | allehånde | 0.276 |  |
| portvin | negative | — | salvie | 0.271 |  |
| fortynna | negative | — | allehånde | 0.259 |  |
| søtere | negative | — | smør | 0.258 |  |
| boozy | negative | — | brioche | 0.255 |  |
| saft | negative | — | marmelade | 0.251 |  |
| smooth | negative | — | rips | 0.247 |  |
| alkohol | negative | — | kalk | 0.242 |  |
| bakt | positive | bakverk | nektarin | 0.240 | no |
| organisk | negative | — | blod | 0.235 |  |
| mindre | negative | — | underskog | 0.227 |  |
| autolyse | positive | bakverk | kalk | 0.216 | no |
| maling | negative | — | kritt | 0.213 |  |
| gult | negative | — | gjær | 0.192 |  |

| threshold | correct positives | missed positives | wrong positives accepted | negatives accepted | objective |
| --- | --- | --- | --- | --- | --- |
| 0.10 | 5 | 0 | 5 | 22 | -49 |
| 0.15 | 5 | 0 | 5 | 22 | -49 |
| 0.20 | 5 | 0 | 5 | 21 | -47 |
| 0.25 | 5 | 2 | 3 | 16 | -33 |
| 0.30 | 5 | 3 | 2 | 6 | -11 |
| 0.35 | 4 | 5 | 1 | 2 | -2 |
| 0.40 | 4 | 5 | 1 | 1 | 0 |
| 0.45 | 3 | 6 | 1 | 1 | -1 |
| 0.50 | 3 | 7 | 0 | 1 | 1 |
| 0.55 | 1 | 9 | 0 | 1 | -1 |
| 0.60 | 1 | 9 | 0 | 1 | -1 |
| 0.65 | 0 | 10 | 0 | 0 | 0 |
| 0.70 | 0 | 10 | 0 | 0 | 0 |
| 0.75 | 0 | 10 | 0 | 0 | 0 |
| 0.80 | 0 | 10 | 0 | 0 | 0 |
| 0.85 | 0 | 10 | 0 | 0 | 0 |
| 0.90 | 0 | 10 | 0 | 0 | 0 |

Chosen threshold: **0.5** (objective 1).
