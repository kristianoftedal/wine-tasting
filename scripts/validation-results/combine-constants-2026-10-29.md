# Combine constants — 2026-10-29

Engine openai, commit `70e790c`, 139 rated fields, 504 grid points.

Current constants (hit 0.55 / soft 0.45, τ 3, floor 0.6): ρ human 0.599 (0.49–0.69), ρ panel 0.664, ρ constructed 0.685.

## 5-fold cross-validation (tune on four folds, score the fifth)

| fold | chosen on the other four | held-out ρ tuned | held-out ρ current |
| --- | --- | --- | --- |
| 1 | hit 0.90 / soft 0.10, τ 3, floor 0.9 | 0.628 | 0.478 |
| 2 | hit 0.90 / soft 0.10, τ 3, floor 0.9 | 0.743 | 0.683 |
| 3 | hit 0.90 / soft 0.10, τ 4, floor 0.9 | 0.753 | 0.717 |
| 4 | hit 0.90 / soft 0.10, τ 3, floor 0.9 | 0.666 | 0.651 |
| 5 | hit 0.90 / soft 0.10, τ 3, floor 0.9 | 0.662 | 0.584 |
| mean | | **0.690** | **0.623** |

## Best points on all rated data (for information; in-sample)

| constants | ρ human | ρ panel | ρ constructed | mean score |
| --- | --- | --- | --- | --- |
| hit 0.90 / soft 0.10, τ 3, floor 0.9 | 0.666 | 0.659 | 0.725 | 66.1 |
| hit 0.90 / soft 0.10, τ 3.5, floor 0.9 | 0.664 | 0.656 | 0.726 | 62.4 |
| hit 0.90 / soft 0.10, τ 2.5, floor 0.9 | 0.664 | 0.660 | 0.721 | 70.3 |
| hit 0.90 / soft 0.10, τ 4, floor 0.9 | 0.664 | 0.658 | 0.727 | 58.9 |
| hit 0.90 / soft 0.10, τ 5, floor 0.9 | 0.663 | 0.656 | 0.726 | 53.1 |
| hit 0.90 / soft 0.10, τ 4, floor 0.8 | 0.661 | 0.657 | 0.739 | 57.3 |
| hit 0.90 / soft 0.10, τ 5, floor 0.8 | 0.661 | 0.657 | 0.738 | 51.7 |
| hit 0.90 / soft 0.10, τ 3.5, floor 0.8 | 0.660 | 0.661 | 0.738 | 60.6 |

## One constant at a time, the others at their current values

| hitWeight | 0.4 | 0.45 | 0.5 | 0.55 | 0.6 | 0.65 | 0.7 | 0.8 | 0.9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ρ human | 0.561 | 0.572 | 0.586 | 0.599 | 0.608 | 0.613 | 0.618 | 0.635 | 0.647 |
| ρ panel | 0.646 | 0.649 | 0.659 | 0.664 | 0.668 | 0.670 | 0.669 | 0.664 | 0.658 |

| tau | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ρ human | 0.552 | 0.576 | 0.593 | 0.599 | 0.602 | 0.602 | 0.604 | 0.600 |
| ρ panel | 0.639 | 0.653 | 0.660 | 0.664 | 0.665 | 0.665 | 0.665 | 0.663 |

| floor | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ρ human | 0.583 | 0.590 | 0.597 | 0.599 | 0.597 | 0.596 | 0.592 |
| ρ panel | 0.656 | 0.659 | 0.664 | 0.664 | 0.664 | 0.660 | 0.658 |

