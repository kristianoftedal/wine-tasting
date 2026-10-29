# Constructed set — 2026-10-29

Set `scripts/validation-results/constructed-set-2026-10.json`: 115 notes over 71 references, built by gpt-4o-mini, kept 115 of 296 generated ({"asked 4, ladder says 3":7,"asked 2, ladder says 3":36,"asked 0, ladder says 2":43,"asked 2, ladder says 4":14,"asked 0, ladder says unusable":17,"asked 4, ladder says unusable":4,"asked 3, ladder says unusable":8,"asked 2, ladder says unusable":15,"asked 3, ladder says 4":26,"asked 0, ladder says 3":10,"asked 3, ladder says 0":1}).

Notes per level: 4: 63, 3: 39, 2: 9, 0: 4.

| engine | Spearman(score, level) | pairwise order accuracy | mean score at 4 / 3 / 2 / 0 |
| --- | --- | --- | --- |
| openai | 0.704 | 92.3% (48/52) | 85.3 / 66.5 / 27.9 / 2.3 |
| bert | 0.751 | 94.2% (49/52) | 64.6 / 44.4 / 18.4 / 0.0 |
| colbert-word | 0.777 | 94.2% (49/52) | 61.4 / 44.1 / 18.3 / 0.3 |
| colbert-token | 0.770 | 92.3% (48/52) | 60.6 / 43.7 / 18.8 / 0.3 |

Pairwise accuracy counts every (higher, lower) level pair on the same reference; chance is 50%. The lexical half shares the ladder that validated the notes, so this measures whether the soft term and the combination keep that order on notes written the way tasters write them.
