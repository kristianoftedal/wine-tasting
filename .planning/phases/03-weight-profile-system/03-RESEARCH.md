# Phase 3: Weight Profile System - Research

**Researched:** 2026-02-03
**Domain:** TypeScript configuration management, scoring systems, weight profiles
**Confidence:** HIGH

## Summary

This phase creates three switchable weight profiles (inverted, moderate, data-driven) for category-level scoring weights. Research focused on TypeScript patterns for type-safe configuration objects, profile selection mechanisms, and normalization strategies for frequency-based weights.

The standard approach in 2026 is to use TypeScript's `as const` assertions with `satisfies` operator for type-safe, immutable configuration objects. Profile selection is typically implemented through environment variables with centralized configuration modules. For data-driven profiles, frequencies should be normalized to a common scale (e.g., 0.8-2.5) to maintain consistency with manually-tuned profiles.

**Key findings:**
- Const assertions (`as const`) with `satisfies` operator provide compile-time type safety for configuration objects
- Centralized configuration modules with environment variable validation are the 2026 standard for profile selection
- Frequency normalization should use min-max scaling to map database frequencies to the weight range

**Primary recommendation:** Use typed const objects with `satisfies` for profiles, environment variable for profile selection, and min-max normalization for frequency-to-weight conversion.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x+ | Type-safe configuration | Native language feature, zero dependencies |
| Node process.env | Built-in | Environment-based profile selection | Standard in all Node/Next.js applications |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 16.x+ | Load env vars from .env files | Development/local testing of profiles |
| zod | 3.x+ | Runtime validation of env vars | Production apps needing startup validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Environment variable | Config file (JSON/YAML) | Env var is simpler, standard for Next.js deployment |
| Manual normalization | ML library (numpy) | Overkill for simple min-max scaling, adds dependencies |
| Const objects | Class-based profiles | Const objects are lighter, sufficient for static data |

**Installation:**
```bash
# No new dependencies required - using TypeScript native features
# dotenv already installed (from Phase 1)
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── categories/          # Existing - Phase 2
│   ├── types.ts
│   ├── hierarchy.ts
│   └── index.ts
├── profiles/            # NEW - Phase 3
│   ├── types.ts         # Profile type definitions
│   ├── weights.ts       # Weight profile definitions
│   ├── config.ts        # Profile selection logic
│   └── index.ts         # Public exports
└── lemmatizeAndWeight.ts  # Modified to use active profile
```

### Pattern 1: Typed Const Profiles with Satisfies Operator
**What:** Use `as const satisfies` to create immutable, type-safe configuration objects
**When to use:** Defining static configuration data that won't change at runtime
**Example:**
```typescript
// Source: TypeScript 5.x satisfies operator
// https://oneuptime.com/blog/post/2026-01-30-typescript-const-assertions/view

import type { MainCategory, GenericCategory } from '../categories';

// Weight profile structure
export interface WeightProfile {
  readonly name: string;
  readonly description: string;
  readonly weights: {
    readonly [K in MainCategory | 'GENERIC']: number;
  };
}

// Profile type for all three profiles
export type ProfileName = 'inverted' | 'moderate' | 'data-driven';

// Inverted profile: specific high, generic low
export const INVERTED_PROFILE = {
  name: 'inverted',
  description: 'Specific descriptors valued highly (2.0-2.5), generic terms low (0.8-1.2)',
  weights: {
    'Frukt': 2.0,
    'Krydder': 2.2,
    'Urter': 2.0,
    'Blomster': 2.0,
    'Eik/fat': 2.5,
    'Mineral': 2.0,
    'GENERIC': 1.0
  }
} as const satisfies WeightProfile;

// Type extraction for safety
export type ProfileWeights = typeof INVERTED_PROFILE.weights;
```

**Why this pattern:**
- `as const` prevents accidental mutation and narrows types to literals
- `satisfies` ensures object matches interface without widening types
- Compile-time type checking catches typos in category names
- IDE autocomplete works perfectly with literal types

### Pattern 2: Centralized Configuration Module
**What:** Single module that validates environment variables and provides active profile
**When to use:** Always - centralized config is the 2026 standard for env var management
**Example:**
```typescript
// Source: Best practices for environment configuration 2026
// https://raulmelo.me/en/blog/best-practices-for-handling-per-environment-config-js-ts-applications

import { INVERTED_PROFILE, MODERATE_PROFILE, DATA_DRIVEN_PROFILE } from './weights';
import type { ProfileName, WeightProfile } from './types';

// Environment variable with type-safe fallback
const ACTIVE_PROFILE = (process.env.NEXT_PUBLIC_WEIGHT_PROFILE as ProfileName) || 'inverted';

// Profile registry
const PROFILES: Record<ProfileName, WeightProfile> = {
  'inverted': INVERTED_PROFILE,
  'moderate': MODERATE_PROFILE,
  'data-driven': DATA_DRIVEN_PROFILE
};

// Validated getter function
export function getActiveProfile(): WeightProfile {
  const profile = PROFILES[ACTIVE_PROFILE];

  if (!profile) {
    console.warn(`Unknown profile "${ACTIVE_PROFILE}", falling back to "inverted"`);
    return PROFILES['inverted'];
  }

  return profile;
}

// Helper to get weight for a category
export function getCategoryWeight(category: MainCategory | 'GENERIC'): number {
  return getActiveProfile().weights[category];
}
```

**Why this pattern:**
- Single source of truth for configuration
- Graceful fallback if env var is invalid
- Type-safe profile access throughout codebase
- Easy to add new profiles by extending PROFILES record

### Pattern 3: Frequency Normalization for Data-Driven Profile
**What:** Convert database frequency counts to weights using min-max normalization
**When to use:** Creating data-driven weights from frequency analysis
**Example:**
```typescript
// Source: Min-max normalization for scoring systems
// https://developers.google.com/machine-learning/crash-course/numerical-data/normalization

// Frequency data from Phase 1 analysis
const CATEGORY_FREQUENCIES = {
  'Frukt': 31752,   // bær (14513) + frukt (8481) + sitrus + steinfrukt
  'Krydder': 9465,
  'Urter': 3200,    // estimated from Phase 1 data
  'Blomster': 2100, // estimated
  'Eik/fat': 5800,  // estimated
  'Mineral': 4500,  // estimated
  'GENERIC': 52000  // aroma (18234) + duft (9192) + hint (7638) + others
} as const;

// Normalize frequencies to weight range [0.8, 2.5]
function normalizeFrequencyToWeight(frequency: number): number {
  const frequencies = Object.values(CATEGORY_FREQUENCIES);
  const min = Math.min(...frequencies);
  const max = Math.max(...frequencies);

  // Min-max normalization: scale to [0, 1] then to target range
  const normalized = (frequency - min) / (max - min);

  // Map to weight range: MORE FREQUENT = HIGHER WEIGHT
  // This inverts the "rare = valuable" logic for data-driven profile
  const minWeight = 0.8;
  const maxWeight = 2.5;
  const weight = minWeight + normalized * (maxWeight - minWeight);

  return Math.round(weight * 10) / 10; // Round to 1 decimal
}

// Data-driven profile with normalized weights
export const DATA_DRIVEN_PROFILE = {
  name: 'data-driven',
  description: 'Weights based on normalized database frequency (common = high weight)',
  weights: {
    'Frukt': normalizeFrequencyToWeight(31752),     // ~2.2
    'Krydder': normalizeFrequencyToWeight(9465),     // ~1.1
    'Urter': normalizeFrequencyToWeight(3200),       // ~0.8
    'Blomster': normalizeFrequencyToWeight(2100),    // ~0.8
    'Eik/fat': normalizeFrequencyToWeight(5800),     // ~0.9
    'Mineral': normalizeFrequencyToWeight(4500),     // ~0.9
    'GENERIC': normalizeFrequencyToWeight(52000)     // ~2.5
  }
} as const satisfies WeightProfile;
```

**Why this pattern:**
- Min-max normalization is standard in scoring systems
- Common categories get higher weight (reflects actual language use)
- Maintains consistency with other profiles (same 0.8-2.5 range)
- Transparent formula makes weights auditable

### Anti-Patterns to Avoid
- **Multiplying profile weights by base weights:** Profiles should REPLACE base weights, not multiply them (per CONTEXT.md decision)
- **Class-based profiles:** Unnecessary complexity when const objects suffice
- **Runtime profile switching:** Profile should be set at startup via env var, not changed during runtime
- **Hardcoded profile selection in code:** Always use environment variable for profile selection

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var validation | Custom parser with if/else | Built-in fallback pattern | Simple cases don't need zod, just use || operator |
| Normalization library | Import numpy/scipy | Simple min-max formula | Overkill for single normalization function |
| Profile registry | Dynamic import() system | Static const object | Static profiles are known at compile time |
| Type generation from profiles | Codegen script | TypeScript type inference | `typeof` and `satisfies` extract types automatically |

**Key insight:** TypeScript's type system (5.x+) is powerful enough to handle profile type safety without external libraries. The `as const satisfies` pattern provides compile-time validation that catches configuration errors before runtime.

## Common Pitfalls

### Pitfall 1: Profile Weights Multiply Base Weights
**What goes wrong:** Implementing profiles as multipliers (profile weight × base weight) instead of replacements
**Why it happens:** Intuition suggests "profile adjusts base" but decision was to replace weights entirely
**How to avoid:** Profile weight IS the final weight - remove base weight lookup when profile is active
**Warning signs:** Weights end up outside expected range (e.g., 0.8 × 1.6 = 1.28 instead of intended 0.8)

### Pitfall 2: Data-Driven Profile Inverts Frequency Logic
**What goes wrong:** Making rare terms high-weight in data-driven profile (inverting the logic)
**Why it happens:** Assuming "rare = valuable" (true for inverted profile) applies to data-driven
**How to avoid:** Data-driven profile should reflect actual language: common terms = high weight
**Warning signs:** Generic terms (aroma, duft) get low weight when they're the most frequent

### Pitfall 3: Environment Variable Not Prefixed for Client-Side
**What goes wrong:** Using `WEIGHT_PROFILE` without `NEXT_PUBLIC_` prefix, variable is undefined in browser
**Why it happens:** Next.js only exposes env vars with `NEXT_PUBLIC_` prefix to client-side code
**How to avoid:** Always use `NEXT_PUBLIC_WEIGHT_PROFILE` for client-accessible configuration
**Warning signs:** Profile selection works in API routes but fails in components

### Pitfall 4: Missing Fallback for Unknown Profile
**What goes wrong:** App crashes when env var has invalid profile name (typo, wrong value)
**Why it happens:** Directly accessing `PROFILES[ACTIVE_PROFILE]` without validation
**How to avoid:** Always validate profile name exists in registry, provide fallback to 'inverted'
**Warning signs:** "Cannot read property 'weights' of undefined" error in production

### Pitfall 5: Const Assertion Without Satisfies
**What goes wrong:** Using only `as const` without `satisfies WeightProfile` allows invalid profiles
**Why it happens:** `as const` narrows types but doesn't validate against interface shape
**How to avoid:** Always use `as const satisfies WeightProfile` pattern for both narrowing and validation
**Warning signs:** TypeScript doesn't catch missing categories or wrong property names

## Code Examples

Verified patterns from research:

### Creating Type-Safe Weight Profiles
```typescript
// Source: TypeScript const assertions 2026
// https://oneuptime.com/blog/post/2026-01-30-typescript-const-assertions/view

import type { MainCategory } from '../categories';

// Profile interface for validation
export interface WeightProfile {
  readonly name: string;
  readonly description: string;
  readonly weights: {
    readonly [K in MainCategory | 'GENERIC']: number;
  };
}

// Moderate profile: balanced weights
export const MODERATE_PROFILE = {
  name: 'moderate',
  description: 'Moderate differentiation: specific 1.8-2.2, generic 1.0-1.5',
  weights: {
    'Frukt': 1.8,
    'Krydder': 2.0,
    'Urter': 1.8,
    'Blomster': 1.8,
    'Eik/fat': 2.2,
    'Mineral': 1.8,
    'GENERIC': 1.2
  }
} as const satisfies WeightProfile;

// Type extraction for reuse
export type ProfileWeights = typeof MODERATE_PROFILE.weights;
```

### Environment-Based Profile Selection
```typescript
// Source: Environment variable best practices 2026
// https://raulmelo.me/en/blog/best-practices-for-handling-per-environment-config-js-ts-applications

import type { ProfileName, WeightProfile } from './types';
import { INVERTED_PROFILE, MODERATE_PROFILE, DATA_DRIVEN_PROFILE } from './weights';

// Profile registry with type-safe keys
const PROFILES: Record<ProfileName, WeightProfile> = {
  'inverted': INVERTED_PROFILE,
  'moderate': MODERATE_PROFILE,
  'data-driven': DATA_DRIVEN_PROFILE
} as const;

// Get active profile from environment with validation
export function getActiveProfile(): WeightProfile {
  const profileName = (process.env.NEXT_PUBLIC_WEIGHT_PROFILE as ProfileName) || 'inverted';

  const profile = PROFILES[profileName];

  if (!profile) {
    console.warn(`Invalid NEXT_PUBLIC_WEIGHT_PROFILE: "${profileName}". Using "inverted".`);
    return PROFILES.inverted;
  }

  return profile;
}

// Get category weight from active profile
export function getCategoryWeight(category: MainCategory | 'GENERIC'): number {
  return getActiveProfile().weights[category];
}
```

### Integrating Profiles with Lemmatization
```typescript
// Source: Integration pattern based on existing lemmatizeAndWeight.ts

import { norwegianLemmas } from './lemmatizeAndWeight';
import { getCategoryWeight } from './profiles';
import type { CategoryPath } from './categories';

// Apply profile weight to a lemma
export function applyProfileWeight(lemma: string): number {
  const lemmaData = norwegianLemmas[lemma];

  if (!lemmaData || !lemmaData.categoryPath) {
    return 1.0; // Default for unknown terms
  }

  // Profile weight REPLACES base weight (not multiplies)
  const categoryWeight = getCategoryWeight(lemmaData.categoryPath.main);
  return categoryWeight;
}

// Modified lemmatizeAndWeight to use profile weights
export function lemmatizeAndWeightWithProfile(text: string): TextAnalysis {
  const words = tokenize(text);
  const lemmatized: LemmatizedWord[] = [];
  let weightSum = 0;

  words.forEach(word => {
    const lemmaData = norwegianLemmas[word];

    if (lemmaData) {
      // Use profile weight instead of base weight
      const weight = getCategoryWeight(lemmaData.categoryPath!.main);

      lemmatized.push({
        original: word,
        lemma: lemmaData.lemma,
        weight: weight, // Profile weight replaces base weight
        category: lemmaData.category
      });

      weightSum += weight;
    } else {
      // Unknown terms get generic profile weight
      const genericWeight = getCategoryWeight('GENERIC');

      lemmatized.push({
        original: word,
        lemma: word,
        weight: genericWeight,
        category: 'ukjent'
      });

      weightSum += genericWeight;
    }
  });

  return { lemmatized, categories: {}, weightSum };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain JS objects | `as const` assertions | TypeScript 3.4 (2019) | Immutability and literal type inference |
| Type assertions only | `satisfies` operator | TypeScript 4.9 (2022) | Type validation without widening |
| Runtime config validation | Compile-time type checking | TypeScript 5.x (2023+) | Catch errors before deployment |
| Config files (JSON/YAML) | Environment variables | Next.js standard | Easier deployment, no file management |
| Hardcoded normalization | Min-max scaling formula | ML best practices | Transparent, auditable weight derivation |

**Deprecated/outdated:**
- Using JSON config files for profiles: Environment variables are standard for Next.js deployment
- Class-based configuration: Const objects with interfaces are lighter and sufficient
- Runtime profile switching: Profiles should be set at startup, not changed dynamically

## Open Questions

Things that couldn't be fully resolved:

1. **Exact frequency counts for all categories**
   - What we know: Phase 1 provided frequencies for top terms (bær: 14,513, frukt: 8,481, krydder: 9,465)
   - What's unclear: Complete frequency counts for Urter, Blomster, Eik/fat, Mineral categories
   - Recommendation: Run additional query in Phase 3 to get accurate frequencies, or estimate from Phase 1 data

2. **Profile switching in production without redeployment**
   - What we know: Environment variables require app restart to change
   - What's unclear: Whether dynamic profile switching is a future requirement
   - Recommendation: Start with env var approach per CONTEXT.md, can add runtime switching later if needed

3. **Term-level vs category-level weights for profiles**
   - What we know: CONTEXT.md specifies category-level weights (all terms in category share one weight)
   - What's unclear: Whether subcategory-level granularity (e.g., Frukt/baer vs Frukt/sitrus) would be beneficial
   - Recommendation: Implement category-level as specified, can add subcategory support in future profiles

## Sources

### Primary (HIGH confidence)
- [TypeScript Const Assertions - OneUpTime (2026-01-30)](https://oneuptime.com/blog/post/2026-01-30-typescript-const-assertions/view) - Recent, authoritative guide to const assertions
- [Best Practices for Environment Configuration - Raul Melo](https://raulmelo.me/en/blog/best-practices-for-handling-per-environment-config-js-ts-applications) - Comprehensive environment variable patterns
- [TypeScript Official Documentation - TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - Official TypeScript documentation
- Existing codebase: `/src/lib/lemmatizeAndWeight.ts`, `/src/lib/categories/` - Current implementation patterns

### Secondary (MEDIUM confidence)
- [A Complete Guide to Const Assertions - LogRocket](https://blog.logrocket.com/complete-guide-const-assertions-typescript/) - Detailed const assertion examples
- [Type-Safe Environment Variables - Coding Matty](https://www.codingmatty.com/type-strict-environment-variables/) - Environment variable type safety patterns
- [Numerical Data Normalization - Google ML](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization) - Min-max normalization explanation
- [Selection of Normalization Technique for MCDM - ResearchGate](https://www.researchgate.net/publication/324076628_Selection_of_Normalization_Technique_for_Weighted_Average_Multi-criteria_Decision_Making) - Normalization for scoring systems

### Tertiary (LOW confidence)
- [TypeScript Advanced Development 2026 - Miracl.in](https://miracl.in/blog/typescript-advanced-development-2026/) - General TypeScript trends
- [TypeScript Best Practices 2026 - Johal.in](https://johal.in/typescript-best-practices-for-large-scale-web-applications-in-2026/) - Best practices overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeScript native features, established patterns, no external dependencies needed
- Architecture: HIGH - Patterns verified in official TypeScript docs and 2026 best practices
- Pitfalls: HIGH - Based on common TypeScript mistakes and Next.js environment variable gotchas
- Normalization: MEDIUM - Min-max scaling is standard, but exact frequency data needs Phase 1 review

**Research date:** 2026-02-03
**Valid until:** 30 days (stable TypeScript patterns, unlikely to change rapidly)
