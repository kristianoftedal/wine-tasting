# Specific tier — 2026-10-29

Commit `67fffd9`. Human = 149 ratings; panel = 3 models; constructed = 115 notes.

## openai

| variant | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | specific matches |
| --- | --- | --- | --- | --- | --- | --- |
| current (0.85, all hypernyms) | 0.569 (0.45–0.66) | 0.664 | 0.704 | 92.3% | 60.3 | 109 |
| credit 0.6 (= subcategory) | 0.573 (0.45–0.67) | 0.661 | 0.658 | 92.3% | 58.3 | 109 |
| credit 0.3 (= category) | 0.566 (0.44–0.67) | 0.642 | 0.597 | 92.3% | 55.7 | 109 |
| credit 1.0 (= direct) | 0.556 (0.43–0.65) | 0.661 | 0.726 | 92.3% | 61.4 | 109 |
| no krydder | 0.599 (0.49–0.69) | 0.664 | 0.685 | 92.3% | 59.4 | 91 |
| no frukt | 0.566 (0.44–0.66) | 0.657 | 0.689 | 92.3% | 59.6 | 86 |
| no krydder, frukt | 0.594 (0.48–0.69) | 0.656 | 0.672 | 92.3% | 58.6 | 68 |
| no krydder, frukt, mineral | 0.588 (0.47–0.68) | 0.660 | 0.672 | 92.3% | 58.5 | 56 |
| only bær, sitrus, steinfrukt | 0.588 (0.47–0.68) | 0.657 | 0.664 | 92.3% | 58.4 | 53 |
| no specific tier at all | 0.580 (0.46–0.68) | 0.654 | 0.640 | 92.3% | 57.4 | 0 |

## colbert-token

| variant | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | specific matches |
| --- | --- | --- | --- | --- | --- | --- |
| current (0.85, all hypernyms) | 0.616 (0.51–0.70) | 0.712 | 0.770 | 92.3% | 39.7 | 109 |
| credit 0.6 (= subcategory) | 0.604 (0.48–0.70) | 0.698 | 0.703 | 90.4% | 38.0 | 109 |
| credit 0.3 (= category) | 0.576 (0.43–0.67) | 0.664 | 0.621 | 90.4% | 35.9 | 109 |
| credit 1.0 (= direct) | 0.616 (0.51–0.70) | 0.711 | 0.810 | 96.2% | 40.6 | 109 |
| no krydder | 0.624 (0.51–0.71) | 0.690 | 0.734 | 90.4% | 39.0 | 91 |
| no frukt | 0.617 (0.50–0.70) | 0.703 | 0.745 | 92.3% | 39.0 | 86 |
| no krydder, frukt | 0.628 (0.51–0.71) | 0.683 | 0.714 | 90.4% | 38.3 | 68 |
| no krydder, frukt, mineral | 0.623 (0.51–0.71) | 0.690 | 0.714 | 90.4% | 38.2 | 56 |
| only bær, sitrus, steinfrukt | 0.624 (0.51–0.71) | 0.688 | 0.708 | 90.4% | 38.1 | 53 |
| no specific tier at all | 0.607 (0.49–0.70) | 0.681 | 0.677 | 90.4% | 37.3 | 0 |

