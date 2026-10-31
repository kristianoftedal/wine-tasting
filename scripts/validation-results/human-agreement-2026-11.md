# Human agreement — 2026-10-31

Frozen set `scripts/validation-results/frozen-set-2026-10.json` (236 fields, 8 tasters); 232 fields with a stored score; commit `9cf1e5c`.

## Stored score vs recomputed now

| | value |
| --- | --- |
| fields where the recompute differs from the stored score | 214 of 232 |
| mean absolute difference | 9.02 |
| Spearman(stored, recomputed) | 0.892 |
| reference notes now unscoreable (names no aroma) | 12 |

A non-zero difference is expected: scores were stored with the flavour chips included in the text, and only the free text is on the row. The database is not changed.

Previous-engine scores exist for 148 fields; Spearman(previous, current) on those = 0.630.

## Scorers against each other (Spearman)

| | stored score | current engine (recomputed) | lexical half only (soft = 0) | direct-hit count |
| --- | --- | --- | --- | --- |
| stored score | 1.000 | 0.892 | 0.826 | 0.854 |
| current engine (recomputed) | 0.892 | 1.000 | 0.960 | 0.874 |
| lexical half only (soft = 0) | 0.826 | 0.960 | 1.000 | 0.822 |
| direct-hit count | 0.854 | 0.874 | 0.822 | 1.000 |

## Inter-rater agreement (4 raters: kristian, llmcal-gpt-4.1-mini, llmcal-gpt-4o-mini, llmcal-gpt-4o)

| rater A | rater B | fields both rated | Spearman | weighted kappa |
| --- | --- | --- | --- | --- |
| kristian | llmcal-gpt-4.1-mini | 112 | 0.560 | 0.535 |
| kristian | llmcal-gpt-4o-mini | 112 | 0.552 | 0.387 |
| kristian | llmcal-gpt-4o | 112 | 0.611 | 0.519 |
| llmcal-gpt-4.1-mini | llmcal-gpt-4o-mini | 199 | 0.732 | 0.545 |
| llmcal-gpt-4.1-mini | llmcal-gpt-4o | 199 | 0.743 | 0.727 |
| llmcal-gpt-4o-mini | llmcal-gpt-4o | 199 | 0.708 | 0.617 |

## Score vs mean human rating (232 rated fields)

| scorer | Spearman | bootstrap 95% |
| --- | --- | --- |
| stored score | 0.674 | 0.602 – 0.756 |
| current engine (recomputed) | 0.737 | 0.670 – 0.804 |
| lexical half only (soft = 0) | 0.742 | 0.669 – 0.818 |
| direct-hit count | 0.712 | 0.645 – 0.782 |

The current engine must beat the lexical-only and direct-hit rows by more than the interval width for the soft term to be earning its weight. A new engine must beat the current one the same way.
