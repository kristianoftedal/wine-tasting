# Human agreement — 2026-10-29

Frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields, 8 tasters); 232 fields with a stored score; commit `83276cf`.

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
| current engine (recomputed) | 0.645 | 0.564 – 0.709 |
| lexical half only (soft = 0) | 0.652 | 0.560 – 0.721 |
| direct-hit count | 0.654 | 0.580 – 0.742 |

The current engine must beat the lexical-only and direct-hit rows by more than the interval width for the soft term to be earning its weight. A new engine must beat the current one the same way.
