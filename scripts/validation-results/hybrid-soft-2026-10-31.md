# Hybrid soft term — 2026-10-31

Commit `9cf1e5c`. Human = 149 ratings; panel = 3 models; constructed = 115 notes.

| engine | hybrid | ρ human (95%) | ρ target all fields | ρ panel | ρ constructed | pairwise | mean score | mean soft |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| openai | off | 0.658 (0.55–0.74) | 0.708 | 0.753 | 0.686 | 92.3% | 57.1 | 64.1 |
| openai | on | 0.652 (0.53–0.74) | 0.692 | 0.735 | 0.746 | 94.2% | 57.3 | 64.3 |
| colbert-table | off | 0.671 (0.56–0.75) | 0.705 | 0.764 | 0.705 | 94.2% | 55.9 | 62.3 |
| colbert-table | on | 0.659 (0.54–0.75) | 0.693 | 0.750 | 0.779 | 98.1% | 54.3 | 56.2 |
| colbert+cooc | off | 0.676 (0.56–0.76) | 0.712 | 0.771 | 0.698 | 94.2% | 55.9 | 62.4 |
| colbert+cooc | on | 0.659 (0.54–0.75) | 0.693 | 0.752 | 0.779 | 98.1% | 54.2 | 55.7 |
