# Hybrid soft term — 2026-10-29

Commit `42ac7d7`. Human = 149 ratings; panel = 6 models; constructed = 115 notes.

| engine | hybrid | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | mean soft |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openai | off | 0.622 (0.51–0.71) | 0.707 | 0.685 | 92.3% | 60.1 | 64.1 |
| openai | on | 0.616 (0.49–0.71) | 0.662 | 0.782 | 96.2% | 60.9 | 66.0 |
| cooc | off | 0.612 (0.48–0.71) | 0.680 | 0.670 | 94.2% | 49.8 | 38.8 |
| cooc | on | 0.637 (0.52–0.72) | 0.676 | 0.805 | 100.0% | 60.6 | 65.2 |
| openai+cooc | off | 0.615 (0.49–0.71) | 0.705 | 0.683 | 92.3% | 55.0 | 51.5 |
| openai+cooc | on | 0.629 (0.51–0.71) | 0.673 | 0.777 | 96.2% | 58.0 | 58.2 |
