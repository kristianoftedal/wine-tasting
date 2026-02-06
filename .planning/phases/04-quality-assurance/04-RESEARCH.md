# Phase 4: Quality Assurance - Research

**Researched:** 2026-02-06
**Domain:** Testing, TypeScript API compatibility, localhost/server environment split
**Confidence:** HIGH

## Summary

This phase ensures the new scoring system (profiles, categories, lemmatization) works correctly in both localhost (Xenova embeddings) and server (OpenAI embeddings) environments without breaking existing functionality. Research focused on Vitest setup for Next.js, environment variable mocking, pure function testing patterns, and API compatibility verification.

The standard approach for Next.js testing in 2026 is Vitest with `@vitejs/plugin-react` for fast, native ESM testing. The project has no existing test infrastructure, so tests will be added from scratch. The codebase already has a clean localhost/server split via the `isLocalhost()` function that checks `VERCEL_URL` environment variables.

**Key findings:**
- Vitest is the recommended test runner for Next.js, with native ESM and TypeScript support
- Environment variable mocking uses `vi.stubEnv()` with `vi.unstubAllEnvs()` cleanup
- Profile switching is testable by mocking `NEXT_PUBLIC_WEIGHT_PROFILE` environment variable
- Critical exports to test: `lemmatizeAndWeight`, `getCategoryWeight`, `getActiveProfile`, `analyze`
- Localhost/server split already works via `isLocalhost()` in `wine-recommendations-sql.ts`

**Primary recommendation:** Add Vitest with minimal configuration, write unit tests for pure functions (lemmatization, profiles, similarity calculations), and verify API signatures remain unchanged via TypeScript compilation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 2.x+ | Test runner | Official Next.js recommendation, fast native ESM |
| @vitejs/plugin-react | 4.x+ | React plugin for Vitest | Required for JSX support |
| vite-tsconfig-paths | 5.x+ | Path alias support | Enables `@/` imports in tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.x+ | Component testing | If UI component tests needed |
| jsdom | 24.x+ | DOM environment | If tests need DOM APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest requires more config for ESM, slower |
| Integration tests | E2E with Playwright | E2E slower, more infrastructure |
| Snapshot tests for API | Contract testing | Overkill for internal API stability |

**Installation:**
```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

## Architecture Patterns

### Recommended Test Structure
```
src/
├── lib/
│   ├── lemmatizeAndWeight.ts
│   ├── lemmatizeAndWeight.test.ts    # Co-located unit tests
│   ├── profiles/
│   │   ├── config.ts
│   │   ├── config.test.ts            # Profile selection tests
│   │   └── weights.test.ts           # Weight value tests
│   └── categories/
│       └── hierarchy.test.ts         # Category structure tests
└── __tests__/                        # Integration tests (optional)
    └── similarity.integration.test.ts
```

### Pattern 1: Unit Testing Pure Functions
**What:** Test pure functions (no side effects, deterministic output) in isolation
**When to use:** For `lemmatizeAndWeight`, `analyze`, profile weight calculations
**Example:**
```typescript
// Source: Vitest best practices
import { describe, it, expect } from 'vitest'
import { lemmatizeAndWeight } from './lemmatizeAndWeight'

describe('lemmatizeAndWeight', () => {
  it('should lemmatize Norwegian wine terms', () => {
    const result = lemmatizeAndWeight('solbær og kirsebær')

    expect(result.lemmatized).toHaveLength(2)
    expect(result.lemmatized[0].lemma).toBe('solbær')
    expect(result.lemmatized[1].lemma).toBe('kirsebær')
  })

  it('should apply profile weights based on category', () => {
    const result = lemmatizeAndWeight('frisk og saftig')

    // GENERIC category terms should have profile-defined weight
    result.lemmatized.forEach(item => {
      expect(item.weight).toBeGreaterThan(0)
    })
  })

  it('should handle unknown terms with GENERIC weight', () => {
    const result = lemmatizeAndWeight('ukjentord')

    expect(result.lemmatized[0].category).toBe('ukjent')
  })
})
```

### Pattern 2: Environment Variable Mocking for Profile Testing
**What:** Use `vi.stubEnv()` to test different profile configurations
**When to use:** Testing profile switching via `NEXT_PUBLIC_WEIGHT_PROFILE`
**Example:**
```typescript
// Source: Vitest environment mocking docs
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

describe('getActiveProfile', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should return inverted profile by default', async () => {
    // Dynamic import to get fresh module with current env
    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
  })

  it('should return moderate profile when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'moderate')

    // Clear module cache and re-import
    vi.resetModules()
    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('moderate')
  })

  it('should fall back to inverted for invalid profile', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'invalid-profile')

    vi.resetModules()
    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
  })
})
```

### Pattern 3: API Signature Verification
**What:** TypeScript compilation as API contract enforcement
**When to use:** Ensuring exports remain compatible
**Example:**
```typescript
// api-compatibility.test.ts
// Source: TypeScript type testing patterns
import { describe, it, expectTypeOf } from 'vitest'
import type { TextAnalysis, LemmatizedWord, WineCategory } from './lemmatizeAndWeight'
import { lemmatizeAndWeight, analyze } from './lemmatizeAndWeight'

describe('API Compatibility', () => {
  it('lemmatizeAndWeight should return TextAnalysis', () => {
    expectTypeOf(lemmatizeAndWeight).returns.toMatchTypeOf<TextAnalysis>()
  })

  it('TextAnalysis should have expected shape', () => {
    expectTypeOf<TextAnalysis>().toHaveProperty('lemmatized')
    expectTypeOf<TextAnalysis>().toHaveProperty('categories')
    expectTypeOf<TextAnalysis>().toHaveProperty('weightSum')
  })

  it('LemmatizedWord should have weight property', () => {
    expectTypeOf<LemmatizedWord>().toHaveProperty('weight')
    expectTypeOf<LemmatizedWord['weight']>().toBeNumber()
  })
})
```

### Anti-Patterns to Avoid
- **Testing Xenova/OpenAI embeddings directly:** These are external dependencies that work independently; test the switching logic, not the providers
- **Mocking lemma data for every test:** Use real lemma data to catch regression in actual behavior
- **Coverage percentage targets:** Focus on critical path tests, not arbitrary coverage
- **Testing private functions:** Only test exported public API

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom script | Vitest | Watch mode, parallel execution, snapshots |
| Environment mocking | Direct process.env assignment | vi.stubEnv | Proper cleanup, consistent behavior |
| Type assertions in tests | Manual type checks | expectTypeOf | Compile-time verification |
| Test organization | Ad-hoc file placement | Co-location pattern | Discoverability, maintenance |

**Key insight:** Vitest provides everything needed for this project's testing requirements. No additional testing libraries are necessary for pure function and configuration testing.

## Common Pitfalls

### Pitfall 1: Module Caching with Environment Variables
**What goes wrong:** Environment variable stub doesn't affect already-imported module
**Why it happens:** Node.js caches modules; stubbing env var after import has no effect
**How to avoid:** Use `vi.resetModules()` and dynamic `import()` after stubbing
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: Testing Embedding Providers Instead of Logic
**What goes wrong:** Tests become slow and flaky by calling real Xenova/OpenAI
**Why it happens:** Wanting to test "everything" including external services
**How to avoid:** Mock embedding functions, test the switching logic separately
**Warning signs:** Test suite takes minutes, fails on network issues

### Pitfall 3: Forgetting `vi.unstubAllEnvs()` Cleanup
**What goes wrong:** Environment stubs leak between tests causing false failures
**Why it happens:** Tests modify global state without cleanup
**How to avoid:** Always use `afterEach(() => vi.unstubAllEnvs())`
**Warning signs:** Tests pass in isolation but fail when run with other tests

### Pitfall 4: Testing Implementation Details
**What goes wrong:** Tests break when refactoring even though behavior is unchanged
**Why it happens:** Testing internal structure instead of public API behavior
**How to avoid:** Test inputs → outputs, not how the function works internally
**Warning signs:** Every code change requires test changes

### Pitfall 5: Async Server Component Testing
**What goes wrong:** Vitest doesn't support async Server Components in unit tests
**Why it happens:** Vitest limitation with React Server Components
**How to avoid:** Extract logic into pure functions, test those instead
**Warning signs:** "Objects are not valid as React child" errors

## Code Examples

Verified patterns from official sources:

### Vitest Configuration for Next.js
```typescript
// vitest.config.mts
// Source: https://nextjs.org/docs/app/guides/testing/vitest
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',  // 'node' for pure function tests, 'jsdom' for component tests
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
    },
  },
})
```

### Package.json Test Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Integration Test for Localhost/Server Split
```typescript
// Source: Based on existing isLocalhost() implementation
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('isLocalhost detection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should return true when VERCEL_URL is empty', async () => {
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_URL', '')

    vi.resetModules()
    // Import function that calls isLocalhost
    // Verify local similarity is used
  })

  it('should return false when VERCEL_URL is set to production', async () => {
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app')

    vi.resetModules()
    // Verify OpenAI similarity is used (when AI_GATEWAY_API_KEY present)
  })
})
```

### Migration Script Pattern for Score Recalculation
```typescript
// scripts/recalculate-scores.ts
// Source: Supabase migration patterns
import { createClient } from '@supabase/supabase-js'
import { lemmatizeAndWeight, analyze } from '../src/lib/lemmatizeAndWeight'

async function recalculateScores() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch tastings that need recalculation
  const { data: tastings } = await supabase
    .from('tastings')
    .select('id, lukt, smak')
    .not('lukt', 'is', null)

  for (const tasting of tastings || []) {
    // Recalculate with new profile weights
    const newLuktAnalysis = lemmatizeAndWeight(tasting.lukt)
    const newSmakAnalysis = lemmatizeAndWeight(tasting.smak)

    // Update stored scores if needed
    // (actual implementation depends on schema)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Next.js | Vitest | 2024-2025 | Faster, native ESM |
| Manual env var assignment | vi.stubEnv | Vitest 0.30+ | Proper isolation |
| Separate test directories | Co-located tests | Community consensus | Better discoverability |
| Coverage targets | Critical path testing | Industry shift | More meaningful tests |

**Deprecated/outdated:**
- Jest for new Next.js projects: Vitest is faster and requires less configuration
- `process.env.X = 'value'` in tests: Use `vi.stubEnv()` for proper isolation

## Open Questions

Things that couldn't be fully resolved:

1. **Exact test file organization**
   - What we know: Co-location (`*.test.ts` next to source) is recommended
   - What's unclear: Whether integration tests need separate folder
   - Recommendation: Start with co-location, add `__tests__/integration/` if needed

2. **Score recalculation migration scope**
   - What we know: CONTEXT.md mentions "provide migration path to recalculate existing scores"
   - What's unclear: Whether this is a one-time script or ongoing capability
   - Recommendation: Create standalone script in `scripts/` folder, not a database migration

3. **Xenova embeddings in test environment**
   - What we know: Xenova loads ML model lazily, may be slow in tests
   - What's unclear: Whether to mock or let it run
   - Recommendation: Mock `localSemanticSimilarity` in unit tests, only run real embeddings in smoke tests

## Sources

### Primary (HIGH confidence)
- [Next.js Vitest Setup Guide](https://nextjs.org/docs/app/guides/testing/vitest) - Official Next.js documentation
- [Vitest Environment Guide](https://vitest.dev/guide/environment) - Official Vitest documentation
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking) - Official stubEnv documentation
- Existing codebase: `src/lib/lemmatizeAndWeight.ts`, `src/lib/profiles/`, `src/actions/wine-recommendations-sql.ts`

### Secondary (MEDIUM confidence)
- [Vitest Features Guide](https://vitest.dev/guide/features) - Configuration options
- [Stub Environment Variables in Vitest](https://til.hashrocket.com/posts/ghwn4zzhj4-stub-environment-variables-in-vitest) - Practical examples
- [Better Stack Vitest Guide](https://betterstack.com/community/guides/testing/vitest-explained/) - Testing patterns

### Tertiary (LOW confidence)
- [TypeScript API Breaking Changes Detection](https://lostintime.dev/2021/01/02/typescript-api-breaking-changes.html) - General approach (older article)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js recommendation, verified with current docs
- Architecture patterns: HIGH - Based on Vitest official docs and existing codebase analysis
- Pitfalls: HIGH - Common issues documented in Vitest issues and guides
- Migration script: MEDIUM - Pattern is standard, exact implementation depends on schema

**Research date:** 2026-02-06
**Valid until:** 30 days (Vitest patterns are stable)

---

## Codebase-Specific Findings

### Critical Exports to Test

From analysis of `src/lib/` exports:

1. **`lemmatizeAndWeight(text: string): TextAnalysis`** - Core scoring function
2. **`analyze(text1: string, text2: string): AnalysisResult | undefined`** - Comparison function
3. **`getCategoryWeight(category: MainCategory | 'GENERIC'): number`** - Profile weight lookup
4. **`getActiveProfile(): WeightProfile`** - Profile selection
5. **`localSemanticSimilarity(text1: string, text2: string): Promise<number>`** - Local embeddings
6. **`semanticSimilarity(text1: string, text2: string): Promise<number>`** - OpenAI embeddings

### Localhost/Server Split Implementation

The codebase already implements environment detection in `src/actions/wine-recommendations-sql.ts`:

```typescript
function isLocalhost(): boolean {
  const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || '';
  return !host || host.includes('localhost') || host.includes('127.0.0.1');
}

async function calculateSemanticSimilarity(text1: string, text2: string) {
  const useLocalSimilarity = isLocalhost() || !process.env.AI_GATEWAY_API_KEY;

  if (useLocalSimilarity) {
    return await localSemanticSimilarity(text1, text2);
  } else {
    try {
      return await semanticSimilarity(text1, text2);
    } catch {
      return await localSemanticSimilarity(text1, text2);
    }
  }
}
```

This pattern is already correct and just needs testing to verify it works.

### Profile Configuration

Profile switching is controlled by `NEXT_PUBLIC_WEIGHT_PROFILE` env var with graceful fallback:

```typescript
// src/lib/profiles/config.ts
export function getActiveProfile(): WeightProfile {
  const profileName = process.env.NEXT_PUBLIC_WEIGHT_PROFILE as ProfileName | undefined;

  if (!profileName) {
    return PROFILES['inverted'];  // Default fallback
  }

  const profile = PROFILES[profileName];

  if (!profile) {
    console.warn(`Invalid NEXT_PUBLIC_WEIGHT_PROFILE: "${profileName}". Using "inverted".`);
    return PROFILES['inverted'];  // Invalid profile fallback
  }

  return profile;
}
```

Tests should verify:
1. Default behavior (no env var)
2. Valid profile selection (inverted, moderate, data-driven)
3. Invalid profile fallback with warning
