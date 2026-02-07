# Phase 5: Validation - Research

**Researched:** 2026-02-07
**Domain:** Scoring system validation, before/after comparison testing, wine tasting note analysis
**Confidence:** HIGH

## Summary

This phase validates that the new scoring system (profiles, categories, weighted lemmatization) correctly rewards specific tasting notes over generic terms. Research focused on validation methodology, test case selection from real wine data, comparison approaches across all three profiles, and report generation patterns.

The codebase already has the infrastructure needed: Vitest for testing, the `recalculate-scores.ts` script for database analysis, and the `analyze-wine-vocabulary.ts` script that identified term frequencies. Validation requires creating a new script that compares scoring behavior with known note pairs, documenting results in a structured report.

**Key findings:**
- Real wine data available: 49,067 wines with smell/taste notes in Supabase database
- Test pairs should contrast specific terms (e.g., 'solbaer') vs generic terms (e.g., 'frisk')
- All three profiles (inverted, moderate, data-driven) show distinct weighting behaviors
- Validation can use snapshot-style comparison: capture scores, compare across profiles
- Existing `lemmatizeAndWeight` function returns weights directly usable for validation

**Primary recommendation:** Create a validation script that selects 15-25 wine pairs from the database, computes scores with all three profiles, generates a markdown report showing before/after comparison (inverted as "new" vs data-driven as "baseline"), and includes a manual testing checklist for in-app verification.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.x+ | Test runner for validation tests | Already configured in project |
| tsx | 4.x+ | TypeScript script execution | Already installed for scripts |
| Supabase JS | 2.x+ | Database access for real wines | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.x+ | Load .env.local for scripts | Already installed |
| fs/promises | Built-in | Write validation reports | Standard Node.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom validation script | Vitest snapshot tests | Snapshots work for fixed data, custom script better for real wine selection |
| Markdown report | JSON output | Markdown is human-readable, matches existing .planning docs |
| Manual wine selection | Random sampling | Manual selection ensures coverage of edge cases |

**Installation:**
```bash
# No new dependencies required - using existing project tools
```

## Architecture Patterns

### Recommended File Structure
```
scripts/
├── analyze-wine-vocabulary.ts    # Existing - term frequency analysis
├── recalculate-scores.ts         # Existing - score migration/verification
├── validate-scoring.ts           # NEW - validation comparison script
└── validation-results/           # NEW - output directory
    └── validation-report-YYYY-MM-DD.md

.planning/phases/05-validation/
├── 05-CONTEXT.md                 # Existing - phase context
├── 05-RESEARCH.md                # This file
├── 05-01-PLAN.md                 # Validation script creation
└── manual-testing-checklist.md   # NEW - in-app verification guide
```

### Pattern 1: Profile Comparison Test Case Structure
**What:** Define test cases as wine pairs with expected behavior assertions
**When to use:** Validating that specific notes outscore generic notes
**Example:**
```typescript
// Source: Based on existing lemmatizeAndWeight.ts and profiles/weights.ts

interface ValidationTestCase {
  id: string;
  description: string;
  text1: string;  // Contains specific descriptors
  text2: string;  // Contains generic descriptors
  expectation: 'text1_higher' | 'text2_higher' | 'similar';
  category: 'specific_vs_generic' | 'same_category' | 'edge_case';
}

const testCases: ValidationTestCase[] = [
  {
    id: 'berry-vs-structure',
    description: 'Specific berry notes should score higher than generic structure',
    text1: 'solbaer og kirsebær',        // Specific: Frukt category (weight 2.0)
    text2: 'balansert og frisk',          // Generic: GENERIC category (weight 1.0)
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'oak-vs-quality',
    description: 'Oak aging terms should score higher than quality adjectives',
    text1: 'eik fatpreg vanilje',          // Specific: Eik/fat (2.5)
    text2: 'elegant kompleks dybde',       // Generic: GENERIC (1.0)
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'spice-vs-acidity',
    description: 'Spice notes score higher than acidity terms',
    text1: 'pepper nellik kanel',          // Specific: Krydder (2.2)
    text2: 'frisk syre syrlig',            // Generic: GENERIC (1.0)
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  }
];
```

**Why this pattern:**
- Declarative test cases make assertions clear
- Category field enables grouping in reports
- Expectation field enables automated pass/fail verification
- Can run same cases with different profiles

### Pattern 2: Multi-Profile Comparison Matrix
**What:** Compute scores for same text pair across all three profiles, display as matrix
**When to use:** Showing how each profile weights the same content differently
**Example:**
```typescript
// Source: Based on profiles/weights.ts structure

interface ProfileScoreMatrix {
  testCase: ValidationTestCase;
  scores: {
    inverted: { text1Weight: number; text2Weight: number; ratio: number };
    moderate: { text1Weight: number; text2Weight: number; ratio: number };
    dataDriven: { text1Weight: number; text2Weight: number; ratio: number };
  };
  passesExpectation: {
    inverted: boolean;
    moderate: boolean;
    dataDriven: boolean;
  };
}

function computeScoreMatrix(testCase: ValidationTestCase): ProfileScoreMatrix {
  const profiles = ['inverted', 'moderate', 'data-driven'] as const;
  const scores: ProfileScoreMatrix['scores'] = {} as any;
  const passesExpectation: ProfileScoreMatrix['passesExpectation'] = {} as any;

  for (const profileName of profiles) {
    // Set profile env var and get weights
    process.env.NEXT_PUBLIC_WEIGHT_PROFILE = profileName;

    // Re-import to get fresh profile
    const { lemmatizeAndWeight } = await import('../src/lib/lemmatizeAndWeight');

    const result1 = lemmatizeAndWeight(testCase.text1);
    const result2 = lemmatizeAndWeight(testCase.text2);

    const ratio = result1.weightSum / result2.weightSum;

    scores[profileName === 'data-driven' ? 'dataDriven' : profileName] = {
      text1Weight: result1.weightSum,
      text2Weight: result2.weightSum,
      ratio
    };

    // Check expectation
    const passes =
      (testCase.expectation === 'text1_higher' && ratio > 1.0) ||
      (testCase.expectation === 'text2_higher' && ratio < 1.0) ||
      (testCase.expectation === 'similar' && ratio >= 0.9 && ratio <= 1.1);

    passesExpectation[profileName === 'data-driven' ? 'dataDriven' : profileName] = passes;
  }

  return { testCase, scores, passesExpectation };
}
```

**Why this pattern:**
- Shows all profiles side-by-side for easy comparison
- Ratio makes it obvious which text "wins"
- Pass/fail per profile enables targeted improvements
- Matrix format translates well to markdown tables

### Pattern 3: Real Wine Pair Selection from Database
**What:** Query database for wine pairs that demonstrate specific vs generic contrast
**When to use:** Getting 15-25 validation pairs from real production data
**Example:**
```typescript
// Source: Based on existing scripts/recalculate-scores.ts pattern

interface RealWinePair {
  wine1: { id: string; name: string; smell: string; taste: string };
  wine2: { id: string; name: string; smell: string; taste: string };
  reason: string;  // Why these were paired
}

async function selectValidationWines(supabase: SupabaseClient): Promise<RealWinePair[]> {
  const pairs: RealWinePair[] = [];

  // Category 1: Wines with many specific berry terms (5 pairs)
  const { data: berryWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .or('smell.ilike.%solbaer%,smell.ilike.%kirsebær%,smell.ilike.%bringebær%')
    .limit(10);

  // Category 2: Wines with mostly generic terms (5 pairs for comparison)
  const { data: genericWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .or('smell.ilike.%frisk%,smell.ilike.%balansert%')
    .not('smell', 'ilike', '%solbaer%')
    .not('smell', 'ilike', '%kirsebær%')
    .limit(10);

  // Category 3: Wines with oak/barrel notes (5 pairs)
  const { data: oakWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .or('smell.ilike.%eik%,smell.ilike.%fat%,smell.ilike.%vanilje%')
    .limit(10);

  // Category 4: Wines with spice notes (5 pairs)
  const { data: spiceWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .or('smell.ilike.%pepper%,smell.ilike.%krydder%,smell.ilike.%nellik%')
    .limit(10);

  // Pair wines strategically: specific + generic from same rough category
  // ... pair selection logic

  return pairs;
}
```

**Why this pattern:**
- Uses real wines from production database
- Strategic selection ensures variety of test scenarios
- Reason field documents why pair was chosen
- Replicable: same queries produce consistent results

### Anti-Patterns to Avoid
- **Synthetic test data only:** Real wines may have unexpected term combinations not in synthetic tests
- **Testing only inverted profile:** Must compare all three profiles to show differentiation
- **Ignoring edge cases:** Some wines may have mixed specific/generic terms
- **Hardcoded wine IDs:** Use queries to select wines so tests work on any database state

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weight calculation | Custom scoring function | Existing `lemmatizeAndWeight` | Already tested, profile-aware |
| Profile switching | Manual weight arrays | `getCategoryWeight` with env var | Centralized, validated |
| Database access | Raw SQL | Supabase client from existing scripts | Consistent patterns |
| Report formatting | Custom HTML | Markdown tables | Matches .planning docs |

**Key insight:** The validation phase is about verifying existing implementation, not building new functionality. Reuse the existing lemmatization and profile infrastructure.

## Common Pitfalls

### Pitfall 1: Module Caching Defeats Profile Switching
**What goes wrong:** Setting `NEXT_PUBLIC_WEIGHT_PROFILE` env var doesn't affect already-imported modules
**Why it happens:** Node.js caches module exports; env var read at import time
**How to avoid:** Use `vi.resetModules()` in tests, or use dynamic `import()` after setting env var
**Warning signs:** All profiles return same weights, tests pass individually but fail together

### Pitfall 2: Comparing Similarity Instead of Weights
**What goes wrong:** Using cosine similarity to compare two texts instead of comparing their weight sums
**Why it happens:** Confusion between similarity (how alike are texts) and weights (how specific are terms)
**How to avoid:** Validation compares `weightSum` from `lemmatizeAndWeight`, not similarity score
**Warning signs:** Identical texts get compared to each other instead of comparing different profiles

### Pitfall 3: Selecting Wines Without Both Smell and Taste
**What goes wrong:** Wine has empty smell/taste field, `lemmatizeAndWeight('')` returns minimal data
**Why it happens:** Not all wines in database have complete tasting notes
**How to avoid:** Filter for wines where both `smell` and `taste` are non-null and non-empty
**Warning signs:** Many wines have 0 weight sum, validation seems broken

### Pitfall 4: Not Documenting Test Case Rationale
**What goes wrong:** Report shows pass/fail but nobody understands why cases were chosen
**Why it happens:** Rushing to produce numbers without explanation
**How to avoid:** Each test case should have description and reason fields explaining expectation
**Warning signs:** Report is just tables of numbers with no interpretation

### Pitfall 5: Manual Testing Without Checklist
**What goes wrong:** Tester clicks around randomly, misses critical scenarios
**Why it happens:** No structured checklist for in-app manual verification
**How to avoid:** Create explicit checklist: "Enter 'solbaer' in smell field, verify score > X"
**Warning signs:** Manual testing says "looks fine" but users report unexpected behavior

## Code Examples

Verified patterns from existing codebase:

### Computing Weight Sum Per Profile
```typescript
// Source: Based on src/lib/lemmatizeAndWeight.ts
import { lemmatizeAndWeight } from '../src/lib/lemmatizeAndWeight';

function getWeightSum(text: string): number {
  const result = lemmatizeAndWeight(text);
  return result.weightSum;
}

// Example: Compare specific vs generic
const specificWeight = getWeightSum('solbaer kirsebær eik');
const genericWeight = getWeightSum('frisk balansert god');

console.log(`Specific terms weight: ${specificWeight}`);
console.log(`Generic terms weight: ${genericWeight}`);
console.log(`Ratio: ${(specificWeight / genericWeight).toFixed(2)}x`);
```

### Generating Markdown Comparison Table
```typescript
// Source: Standard markdown table pattern
function generateComparisonTable(results: ProfileScoreMatrix[]): string {
  const lines: string[] = [];

  lines.push('| Test Case | Inverted | Moderate | Data-Driven | Expected | Pass? |');
  lines.push('|-----------|----------|----------|-------------|----------|-------|');

  for (const r of results) {
    const invRatio = r.scores.inverted.ratio.toFixed(2);
    const modRatio = r.scores.moderate.ratio.toFixed(2);
    const ddRatio = r.scores.dataDriven.ratio.toFixed(2);
    const pass = r.passesExpectation.inverted ? 'YES' : 'NO';

    lines.push(`| ${r.testCase.id} | ${invRatio}x | ${modRatio}x | ${ddRatio}x | ${r.testCase.expectation} | ${pass} |`);
  }

  return lines.join('\n');
}
```

### Fetching Real Wines for Validation
```typescript
// Source: Based on scripts/recalculate-scores.ts
import { createClient } from '@supabase/supabase-js';

async function fetchValidationWines() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get wines with specific berry terms
  const { data: specificWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .not('smell', 'is', null)
    .or('smell.ilike.%solbaer%,smell.ilike.%kirsebær%,taste.ilike.%eik%')
    .limit(15);

  // Get wines with mostly generic terms
  const { data: genericWines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .not('smell', 'is', null)
    .ilike('smell', '%frisk%')
    .not('smell', 'ilike', '%solbaer%')
    .limit(15);

  return { specificWines, genericWines };
}
```

### Manual Testing Checklist Format
```markdown
# Manual Validation Checklist

## Pre-requisites
- [ ] App running locally with `npm run dev`
- [ ] Profile set to `inverted` in `.env.local`
- [ ] Test wine selected in app

## Test Cases

### TC-01: Specific Berry Terms
1. Navigate to tasting form for any red wine
2. In "Lukt" (smell) field, enter: "solbaer og kirsebær"
3. In "Smak" (taste) field, enter: "solbaer med bringebær"
4. Submit and view score comparison
5. **Expected:** Smell/taste scores should be > 70%
6. **Result:** [ ] Pass [ ] Fail
7. **Notes:** _______________

### TC-02: Generic Structure Terms
1. For same wine, enter: "frisk og balansert"
2. Submit and view score comparison
3. **Expected:** Scores should be lower than TC-01
4. **Result:** [ ] Pass [ ] Fail
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual spot checks | Automated validation scripts | This phase | Reproducible verification |
| Single profile | Three-profile comparison | Phase 3 | Shows profile differentiation |
| Synthetic test data | Real wine database queries | This phase | Validates real-world behavior |
| Console.log debugging | Markdown reports | This phase | Documented, shareable results |

**Deprecated/outdated:**
- Ad-hoc testing without structured test cases
- Comparing only one profile at a time
- Relying solely on unit tests (need integration with real data)

## Open Questions

Things that couldn't be fully resolved:

1. **Exact wine selection criteria for 15-25 pairs**
   - What we know: Should cover specific vs generic contrasts, different categories
   - What's unclear: Exact SQL queries to ensure good variety without duplicates
   - Recommendation: Start with ~5 berry, ~5 oak, ~5 spice, ~5 mixed, adjust based on results

2. **Where to store validation report**
   - What we know: CONTEXT.md suggests `.planning/phases/05-*` or `scripts/validation-results/`
   - What's unclear: Whether report should be committed to git or generated fresh each time
   - Recommendation: Store in `scripts/validation-results/` with timestamp, optionally commit summary to `.planning`

3. **Failure threshold for validation**
   - What we know: CONTEXT.md says "on failure: document and continue"
   - What's unclear: What percentage of test cases passing constitutes "success"
   - Recommendation: Document all results, flag if inverted profile fails > 20% of specific-vs-generic cases

4. **Integration with existing test suite**
   - What we know: Vitest is configured, some tests exist
   - What's unclear: Whether validation should be Vitest tests or standalone script
   - Recommendation: Standalone script for flexibility, can add Vitest wrapper later

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/lemmatizeAndWeight.ts` - Current scoring implementation
- Existing codebase: `src/lib/profiles/weights.ts` - Profile weight definitions
- Existing codebase: `scripts/recalculate-scores.ts` - Database query patterns
- Existing codebase: `wine-vocabulary-analysis.json` - Real term frequency data (49,067 wines analyzed)
- [Vitest Snapshot Guide](https://vitest.dev/guide/snapshot) - Comparison testing patterns

### Secondary (MEDIUM confidence)
- [Wine Quality Machine Learning - GeeksforGeeks](https://www.geeksforgeeks.org/wine-quality-prediction-machine-learning/) - Model validation approaches
- [Wine Classification by Tasting Notes - Medium](https://medium.com/analytics-vidhya/text-analytics-wine-classification-and-recommendation-by-tasting-notes-6657733fd60d) - Text-based wine comparison

### Tertiary (LOW confidence)
- [Analyses of Wine-Tasting Data - ResearchGate](https://www.researchgate.net/publication/277939169_Analyses_of_Wine-Tasting_Data_A_Tutorial) - Statistical validation methods (academic)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project tools, no new dependencies
- Architecture patterns: HIGH - Based on existing script patterns in codebase
- Pitfalls: HIGH - Derived from existing test patterns and Phase 4 learnings
- Test case design: MEDIUM - Some judgment needed for wine selection criteria

**Research date:** 2026-02-07
**Valid until:** 30 days (validation patterns are stable)

---

## Codebase-Specific Findings

### Weight Differences Across Profiles

From `src/lib/profiles/weights.ts`:

| Category | Inverted | Moderate | Data-Driven |
|----------|----------|----------|-------------|
| Frukt | 2.0 | 1.8 | 2.2 |
| Krydder | 2.2 | 2.0 | 1.4 |
| Urter | 2.0 | 1.8 | 1.0 |
| Blomster | 2.0 | 1.8 | 0.9 |
| Eik/fat | 2.5 | 2.2 | 1.1 |
| Mineral | 2.0 | 1.8 | 1.0 |
| GENERIC | 1.0 | 1.2 | 2.5 |

**Key insight for validation:**
- Inverted profile: Specific categories (2.0-2.5) vs GENERIC (1.0) = 2.0-2.5x ratio
- Data-driven profile: GENERIC (2.5) actually highest = inverts the behavior
- This is intentional: data-driven reflects frequency, not specificity

### Available Lemmas for Testing

From `src/lib/lemmatizeAndWeight.ts`, key terms that should demonstrate weight differences:

**High-weight specific terms (Inverted profile):**
- Berry: solbaer, kirsebær, bringebær, blabaer (Frukt: 2.0)
- Oak: eik, fat, vanilje, fatlagret (Eik/fat: 2.5)
- Spice: pepper, nellik, kanel (Krydder: 2.2)

**Low-weight generic terms (Inverted profile):**
- Structure: balansert, frisk, fyldig (GENERIC: 1.0)
- Quality: elegant, kompleks, god (GENERIC: 1.0)
- Finish: ettersmak, lang, lengde (GENERIC: 1.0)

### Real Wine Data Statistics

From `wine-vocabulary-analysis.json`:
- Total wines: 49,067
- Top specific terms in smell: bær (14,513), sitrus (11,176), kirsebær (5,006)
- Top generic terms in smell: aroma (18,234), duft (9,192), hint (7,638)
- Specific term "solbaer": 1,347 occurrences (good for testing)

### Validation Script Entry Point

Based on existing `recalculate-scores.ts`, the validation script should:

```typescript
#!/usr/bin/env npx tsx
/**
 * Scoring Validation Script
 *
 * Validates that the scoring system correctly weights specific notes higher
 * than generic terms across all three profiles.
 *
 * Usage:
 *   npm run validate-scoring
 *   npm run validate-scoring -- --verbose
 */

import 'dotenv/config'
// ... implementation
```

Add to `package.json`:
```json
{
  "scripts": {
    "validate-scoring": "tsx scripts/validate-scoring.ts"
  }
}
```
