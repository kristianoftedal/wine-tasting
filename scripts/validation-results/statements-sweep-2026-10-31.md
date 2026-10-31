# Statement sweep — 2026-10-31

Commit `c8933a6`, 180 grid points, OpenAI engine, 139 human-rated and 220 target fields.

| constants | ρ human (95%) | ρ target | ρ constructed | pairwise | r(len) | mean |
| --- | --- | --- | --- | --- | --- | --- |
| saturating τ3 (current) · sub 0.6 · cat 0.3 · family off · hit 0.55 | 0.623 (0.50–0.71) | 0.674 | 0.676 | 92.3% | 0.32 | 59.7 |

## Top 12 by ρ target

| constants | ρ human (95%) | ρ target | ρ constructed | pairwise | r(len) | mean |
| --- | --- | --- | --- | --- | --- | --- |
| linear, 100 at mass 8 · sub 0.6 · cat 0.3 · family on · hit 0.65 | 0.662 (0.55–0.74) | 0.709 | 0.692 | 92.3% | 0.44 | 52.9 |
| linear, 100 at mass 6 · sub 0.6 · cat 0.3 · family on · hit 0.65 | 0.661 (0.55–0.74) | 0.708 | 0.703 | 92.3% | 0.40 | 59.3 |
| linear, 100 at mass 6 · sub 0.75 · cat 0.3 · family on · hit 0.65 | 0.658 (0.54–0.74) | 0.706 | 0.687 | 92.3% | 0.41 | 60.6 |
| linear, 100 at mass 8 · sub 0.75 · cat 0.3 · family on · hit 0.65 | 0.656 (0.54–0.74) | 0.705 | 0.674 | 90.4% | 0.45 | 54.1 |
| linear, 100 at mass 8 · sub 0.6 · cat 0.3 · family off · hit 0.65 | 0.657 (0.54–0.74) | 0.704 | 0.694 | 92.3% | 0.43 | 52.4 |
| linear, 100 at mass 8 · sub 0.85 · cat 0.3 · family on · hit 0.65 | 0.654 (0.53–0.74) | 0.703 | 0.660 | 90.4% | 0.45 | 55.0 |
| linear, 100 at mass 6 · sub 0.6 · cat 0.3 · family off · hit 0.65 | 0.654 (0.54–0.74) | 0.703 | 0.705 | 92.3% | 0.39 | 58.6 |
| linear, 100 at mass 6 · sub 0.75 · cat 0.45 · family on · hit 0.65 | 0.654 (0.54–0.74) | 0.702 | 0.690 | 92.3% | 0.41 | 61.8 |
| linear, 100 at mass 6 · sub 0.6 · cat 0.45 · family on · hit 0.65 | 0.650 (0.54–0.73) | 0.701 | 0.706 | 92.3% | 0.40 | 60.4 |
| linear, 100 at mass 8 · sub 0.6 · cat 0.45 · family on · hit 0.65 | 0.652 (0.54–0.73) | 0.701 | 0.692 | 92.3% | 0.44 | 53.9 |
| linear, 100 at mass 10 · sub 0.6 · cat 0.3 · family on · hit 0.65 | 0.648 (0.54–0.73) | 0.700 | 0.686 | 92.3% | 0.45 | 47.5 |
| linear, 100 at mass 10 · sub 0.75 · cat 0.3 · family on · hit 0.65 | 0.649 (0.54–0.74) | 0.699 | 0.669 | 92.3% | 0.46 | 48.6 |

## One statement at a time, the rest at current values

| shape (sub 0.6, cat 0.3, family off, hit 0.55) | ρ human | ρ target | ρ constructed | r(len) |
| --- | --- | --- | --- | --- |
| saturating τ3 (current) | 0.623 | 0.674 | 0.676 | 0.32 |
| saturating τ6 | 0.625 | 0.675 | 0.669 | 0.34 |
| linear, 100 at mass 6 | 0.639 | 0.693 | 0.695 | 0.35 |
| linear, 100 at mass 8 | 0.637 | 0.693 | 0.683 | 0.39 |
| linear, 100 at mass 10 | 0.638 | 0.688 | 0.672 | 0.39 |

| family credits (τ3, hit 0.55) | ρ human | ρ target | ρ constructed | r(len) |
| --- | --- | --- | --- | --- |
| sub 0.6 · cat 0.3 · family off | 0.623 | 0.674 | 0.676 | 0.32 |
| sub 0.6 · cat 0.3 · family on | 0.626 | 0.677 | 0.673 | 0.32 |
| sub 0.6 · cat 0.45 · family off | 0.615 | 0.666 | 0.674 | 0.32 |
| sub 0.6 · cat 0.45 · family on | 0.616 | 0.667 | 0.672 | 0.32 |
| sub 0.6 · cat 0.6 · family off | 0.611 | 0.659 | 0.675 | 0.32 |
| sub 0.6 · cat 0.6 · family on | 0.611 | 0.659 | 0.675 | 0.32 |
| sub 0.75 · cat 0.3 · family off | 0.606 | 0.660 | 0.669 | 0.32 |
| sub 0.75 · cat 0.3 · family on | 0.614 | 0.667 | 0.661 | 0.33 |
| sub 0.75 · cat 0.45 · family off | 0.603 | 0.656 | 0.665 | 0.32 |
| sub 0.75 · cat 0.45 · family on | 0.607 | 0.661 | 0.658 | 0.33 |
| sub 0.75 · cat 0.6 · family off | 0.601 | 0.652 | 0.662 | 0.32 |
| sub 0.75 · cat 0.6 · family on | 0.603 | 0.655 | 0.658 | 0.33 |
| sub 0.85 · cat 0.3 · family off | 0.600 | 0.655 | 0.662 | 0.32 |
| sub 0.85 · cat 0.3 · family on | 0.610 | 0.664 | 0.651 | 0.33 |
| sub 0.85 · cat 0.45 · family off | 0.597 | 0.652 | 0.659 | 0.32 |
| sub 0.85 · cat 0.45 · family on | 0.603 | 0.657 | 0.651 | 0.33 |
| sub 0.85 · cat 0.6 · family off | 0.594 | 0.647 | 0.654 | 0.32 |
| sub 0.85 · cat 0.6 · family on | 0.594 | 0.649 | 0.650 | 0.33 |
