# Hybrid soft term — 2026-10-29

Commit `0c08650`. Human = 149 ratings; panel = 3 models; constructed = 115 notes.

| engine | hybrid | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | mean soft |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openai | off | 0.622 (0.51–0.71) | 0.661 | 0.685 | 92.3% | 60.1 | 64.1 |
| openai | on | 0.616 (0.49–0.71) | 0.617 | 0.782 | 96.2% | 60.9 | 66.0 |
| colbert-iso | off | 0.604 (0.48–0.70) | 0.652 | 0.696 | 90.4% | 47.2 | 31.6 |
| colbert-iso | on | 0.627 (0.51–0.71) | 0.626 | 0.780 | 98.1% | 57.9 | 58.0 |
| colbert-table | off | 0.607 (0.49–0.70) | 0.656 | 0.704 | 94.2% | 48.0 | 33.4 |
| colbert-table | on | 0.627 (0.51–0.71) | 0.626 | 0.825 | 100.0% | 57.9 | 58.1 |
| colbert-tuned | off | 0.574 (0.43–0.67) | 0.637 | 0.651 | 92.3% | 48.1 | 34.1 |
| colbert-tuned | on | 0.618 (0.50–0.71) | 0.625 | 0.818 | 100.0% | 58.7 | 60.1 |
