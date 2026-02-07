# Scoring Validation Report

Generated: 2026-02-07

## Summary

| Profile | Pass Rate | Passed | Failed | Total |
|---------|-----------|--------|--------|-------|
| inverted | 100.0% | 20 | 0 | 20 |
| moderate | 100.0% | 20 | 0 | 20 |
| data-driven | 10.0% | 2 | 18 | 20 |

## Category Breakdown (Inverted Profile)

| Category | Pass Rate | Passed | Total |
|----------|-----------|--------|-------|
| specific_vs_generic | 100.0% | 16 | 16 |
| same_category | 100.0% | 2 | 2 |
| edge_case | 100.0% | 2 | 2 |

## Detailed Test Results

### berry-vs-structure-1

**Description:** Specific berry notes should score higher than generic structure terms

**Text 1 (should score higher):**
"solbær og kirsebær"

**Text 2:**
"balansert og frisk"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

### berry-vs-structure-2

**Description:** Multiple berries vs quality adjectives

**Text 1 (should score higher):**
"bringebær, blåbær og jordbær"

**Text 2:**
"elegant, kompleks og dyp"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 6.00 | 3.00 | 2.00x | ✓ YES |
| moderate | 5.40 | 3.60 | 1.50x | ✓ YES |
| data-driven | 6.60 | 7.50 | 0.88x | ✗ NO |

### berry-vs-structure-3

**Description:** Dark berries vs tannin structure

**Text 1 (should score higher):**
"moreller og bjørnebær"

**Text 2:**
"tanniner og struktur"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

### berry-vs-texture-1

**Description:** Berries vs texture descriptors

**Text 1 (should score higher):**
"solbær og plomme"

**Text 2:**
"myk og rund"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

### berry-vs-body-1

**Description:** Berry specifics vs generic body terms

**Text 1 (should score higher):**
"kirsebær og bringebær"

**Text 2:**
"fyldig og rik"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

### oak-vs-quality-1

**Description:** Barrel aging descriptors vs quality terms

**Text 1 (should score higher):**
"eik, vanilje og toast"

**Text 2:**
"god, fin og behagelig"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 7.20 | 3.00 | 2.40x | ✓ YES |
| moderate | 6.40 | 3.60 | 1.78x | ✓ YES |
| data-driven | 3.60 | 7.50 | 0.48x | ✗ NO |

### oak-vs-quality-2

**Description:** Fatlagring terms vs generic praise

**Text 1 (should score higher):**
"fatpreg og ristet eik"

**Text 2:**
"elegant og pen"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 7.50 | 2.00 | 3.75x | ✓ YES |
| moderate | 6.60 | 2.40 | 2.75x | ✓ YES |
| data-driven | 3.30 | 5.00 | 0.66x | ✗ NO |

### oak-vs-finish-1

**Description:** Oak specifics vs finish generics

**Text 1 (should score higher):**
"vanilje og fatpreg"

**Text 2:**
"lang avslutning"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.70 | 2.00 | 2.35x | ✓ YES |
| moderate | 4.20 | 2.40 | 1.75x | ✓ YES |
| data-driven | 2.50 | 5.00 | 0.50x | ✗ NO |

### spice-vs-acidity-1

**Description:** Named spices vs generic acidity

**Text 1 (should score higher):**
"pepper, nellik og kanel"

**Text 2:**
"frisk og syrlig"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 6.60 | 2.00 | 3.30x | ✓ YES |
| moderate | 6.00 | 2.40 | 2.50x | ✓ YES |
| data-driven | 4.20 | 5.00 | 0.84x | ✗ NO |

### spice-vs-acidity-2

**Description:** Spice complexity vs simple freshness

**Text 1 (should score higher):**
"krydder og anis"

**Text 2:**
"syre og friskhet"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.40 | 2.00 | 2.20x | ✓ YES |
| moderate | 4.00 | 2.40 | 1.67x | ✓ YES |
| data-driven | 2.80 | 5.00 | 0.56x | ✗ NO |

### spice-vs-sweetness-1

**Description:** Specific spices vs generic sweetness

**Text 1 (should score higher):**
"kanel og nellik"

**Text 2:**
"søt og behagelig"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.40 | 2.00 | 2.20x | ✓ YES |
| moderate | 4.00 | 2.40 | 1.67x | ✓ YES |
| data-driven | 2.80 | 5.00 | 0.56x | ✗ NO |

### herb-vs-texture-1

**Description:** Named herbs vs texture generics

**Text 1 (should score higher):**
"timian og rosmarin"

**Text 2:**
"myk og silkemyk"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 2.00 | 5.00 | 0.40x | ✗ NO |

### flower-vs-texture-1

**Description:** Floral specifics vs texture generics

**Text 1 (should score higher):**
"roser og fioler"

**Text 2:**
"rund og bløt"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 1.80 | 5.00 | 0.36x | ✗ NO |

### edge-mixed-1

**Description:** Mixed specific and generic (both texts)

**Text 1 (should score higher):**
"kirsebær, balansert og elegant"

**Text 2:**
"frisk, god og fyldig"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 3.00 | 1.33x | ✓ YES |
| moderate | 4.20 | 3.60 | 1.17x | ✓ YES |
| data-driven | 7.20 | 7.50 | 0.96x | ✗ NO |

### edge-mixed-2

**Description:** More specific terms win even with some generic

**Text 1 (should score higher):**
"solbær, vanilje, pepper og balansert"

**Text 2:**
"kompleks, elegant og god"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 7.40 | 3.00 | 2.47x | ✓ YES |
| moderate | 7.00 | 3.60 | 1.94x | ✓ YES |
| data-driven | 7.50 | 7.50 | 1.00x | ✗ NO |

### same-berries-1

**Description:** Different berries (same weight category)

**Text 1 (similar):**
"solbær og kirsebær"

**Text 2:**
"bringebær og blåbær"

**Expectation:** similar

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 4.00 | 1.00x | ✓ YES |
| moderate | 3.60 | 3.60 | 1.00x | ✓ YES |
| data-driven | 4.40 | 4.40 | 1.00x | ✓ YES |

### same-generic-1

**Description:** Different generic terms (same weight)

**Text 1 (similar):**
"balansert og elegant"

**Text 2:**
"god og behagelig"

**Expectation:** similar

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 2.00 | 2.00 | 1.00x | ✓ YES |
| moderate | 2.40 | 2.40 | 1.00x | ✓ YES |
| data-driven | 5.00 | 5.00 | 1.00x | ✓ YES |

### mineral-vs-generic-1

**Description:** Mineral specifics vs generic quality

**Text 1 (should score higher):**
"mineralsk og stein"

**Text 2:**
"kompleks og dyp"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 2.00 | 5.00 | 0.40x | ✗ NO |

### citrus-vs-generic-1

**Description:** Citrus specifics vs acidity generics

**Text 1 (should score higher):**
"sitron og lime"

**Text 2:**
"frisk og syrlig"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

### stone-fruit-vs-generic-1

**Description:** Stone fruit specifics vs body generics

**Text 1 (should score higher):**
"fersken og aprikos"

**Text 2:**
"fyldig og rik"

**Expectation:** text1_higher

| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |
|---------|---------------|---------------|-------|-------|
| inverted | 4.00 | 2.00 | 2.00x | ✓ YES |
| moderate | 3.60 | 2.40 | 1.50x | ✓ YES |
| data-driven | 4.40 | 5.00 | 0.88x | ✗ NO |

## Interpretation

### Inverted Profile (20/20 = 100.0% pass rate)

✓ **PASS**: The inverted profile successfully rewards specific tasting descriptors over generic terms.

**Specific vs Generic Tests:** 16/16 passed
- Specific berry terms (e.g., "solbær", "kirsebær") receive higher weights than generic structure terms (e.g., "balansert", "frisk")
- Specific oak/barrel terms (e.g., "eik", "vanilje") score higher than quality adjectives (e.g., "elegant", "god")
- Named spices and herbs score higher than generic texture/acidity terms

### Data-Driven Profile (2/20 = 10.0% pass rate)

✓ **Expected Behavior**: The data-driven profile inverts the logic, rewarding common/generic terms.

This demonstrates that the weight profile system is working correctly - different profiles produce different scoring behavior.

### Moderate Profile (20/20 = 100.0% pass rate)

The moderate profile provides a middle ground between inverted and data-driven, with some weight differentiation but less extreme than the inverted profile.

## Conclusion

**Validation successful.** The weight profile system correctly implements the core requirement: specific tasting descriptors contribute more to similarity scores than generic wine structure terms.

The inverted profile is ready for production use to reward actual tasting skill.
