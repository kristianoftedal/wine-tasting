# Human agreement — 2026-10-29

Frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields, 8 tasters); 232 fields with a stored score; commit `0d33872`.

## Stored score vs recomputed now

| | value |
| --- | --- |
| fields where the recompute differs from the stored score | 25 of 232 |
| mean absolute difference | 0.89 |
| Spearman(stored, recomputed) | 0.990 |
| reference notes now unscoreable (names no aroma) | 12 |

A non-zero difference is expected: scores were stored with the flavour chips included in the text, and only the free text is on the row. The database is not changed.

Previous-engine scores exist for 148 fields; Spearman(previous, current) on those = 0.440.

## Scorers against each other (Spearman)

| | stored score | current engine (recomputed) | lexical half only (soft = 0) | direct-hit count |
| --- | --- | --- | --- | --- |
| stored score | 1.000 | 0.990 | 0.916 | 0.854 |
| current engine (recomputed) | 0.990 | 1.000 | 0.921 | 0.860 |
| lexical half only (soft = 0) | 0.916 | 0.921 | 1.000 | 0.820 |
| direct-hit count | 0.854 | 0.860 | 0.820 | 1.000 |

## Inter-rater agreement (4 raters: kristian, llm-gpt-4.1-mini, llm-gpt-4o-mini, llm-gpt-4o)

| rater A | rater B | fields both rated | Spearman | weighted kappa |
| --- | --- | --- | --- | --- |
| kristian | llm-gpt-4.1-mini | 149 | 0.437 | 0.446 |
| kristian | llm-gpt-4o-mini | 149 | 0.407 | 0.323 |
| kristian | llm-gpt-4o | 149 | 0.497 | 0.516 |
| llm-gpt-4.1-mini | llm-gpt-4o-mini | 236 | 0.685 | 0.363 |
| llm-gpt-4.1-mini | llm-gpt-4o | 236 | 0.728 | 0.743 |
| llm-gpt-4o-mini | llm-gpt-4o | 236 | 0.719 | 0.477 |

## Score vs mean human rating (232 rated fields)

| scorer | Spearman | bootstrap 95% |
| --- | --- | --- |
| stored score | 0.637 | 0.550 – 0.703 |
| current engine (recomputed) | 0.646 | 0.565 – 0.711 |
| lexical half only (soft = 0) | 0.653 | 0.562 – 0.724 |
| direct-hit count | 0.657 | 0.583 – 0.743 |

The current engine must beat the lexical-only and direct-hit rows by more than the interval width for the soft term to be earning its weight. A new engine must beat the current one the same way.
