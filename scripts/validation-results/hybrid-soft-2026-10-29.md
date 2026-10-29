# Hybrid soft term — 2026-10-29

Commit `e72d04c`. Human = 149 ratings; panel = 3 models; constructed = 115 notes.

| engine | hybrid | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | mean soft |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openai | off | 0.569 (0.45–0.66) | 0.664 | 0.704 | 92.3% | 60.3 | 64.1 |
| openai | on | 0.520 (0.39–0.62) | 0.635 | 0.830 | 98.1% | 61.5 | 67.0 |
| bert | off | 0.609 (0.49–0.70) | 0.707 | 0.751 | 94.2% | 40.0 | 14.3 |
| bert | on | 0.530 (0.40–0.63) | 0.646 | 0.829 | 98.1% | 58.5 | 59.0 |
| colbert-word | off | 0.614 (0.50–0.70) | 0.712 | 0.777 | 94.2% | 39.7 | 13.6 |
| colbert-word | on | 0.528 (0.40–0.62) | 0.643 | 0.831 | 98.1% | 58.5 | 59.3 |
| colbert-token | off | 0.616 (0.51–0.70) | 0.712 | 0.770 | 92.3% | 39.7 | 13.5 |
| colbert-token | on | 0.528 (0.40–0.62) | 0.642 | 0.828 | 98.1% | 58.6 | 59.6 |
