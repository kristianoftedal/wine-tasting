# Human agreement — 2026-10-28

Frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields, 8 tasters); 232 fields with a stored score; commit `2e32353`.

## Stored score vs recomputed now

| | value |
| --- | --- |
| fields where the recompute differs from the stored score | 19 of 232 |
| mean absolute difference | 0.72 |
| Spearman(stored, recomputed) | 0.991 |
| reference notes now unscoreable (names no aroma) | 12 |

A non-zero difference is expected: scores were stored with the flavour chips included in the text, and only the free text is on the row. The database is not changed.

Previous-engine scores exist for 148 fields; Spearman(previous, current) on those = 0.439.

## Scorers against each other (Spearman)

| | stored score | current engine (recomputed) | lexical half only (soft = 0) | direct-hit count |
| --- | --- | --- | --- | --- |
| stored score | 1.000 | 0.991 | 0.915 | 0.858 |
| current engine (recomputed) | 0.991 | 1.000 | 0.921 | 0.863 |
| lexical half only (soft = 0) | 0.915 | 0.921 | 1.000 | 0.823 |
| direct-hit count | 0.858 | 0.863 | 0.823 | 1.000 |

## Human ratings

No rater files found in `scripts/validation-results/ratings/rater-*.csv`. Fill in the rating sheet (one copy per rater, named `rater-<name>.csv`) and re-run.
