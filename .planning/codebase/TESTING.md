# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Status:** Not currently configured

**Note:** The codebase has no test suite configured. No Jest, Vitest, or other test runners are installed.

**DevDependencies:** Only type dependencies and build tools:
- `@types/react`, `@types/react-dom`, `typescript`, `postcss`
- SWC plugins for development: `@swc-jotai/debug-label`, `@swc-jotai/react-refresh`
- No test framework dependencies

## Recommended Testing Setup

For implementing tests, the following configuration is suggested (not currently present):

**Framework Options:**
- **Vitest** (recommended for Next.js): Fast, ESM-native, Jest-compatible
- **Jest**: Industry standard, well-integrated with Next.js

**Assertion Library:**
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM matchers
- `vitest` or `jest` built-in assertions

## Test File Organization

**Current State:** No test files exist

**Proposed Convention:**
- Location: Co-located with source files
- Naming: `[filename].test.ts` or `[filename].spec.ts`
- Structure:
  ```
  src/
  ├── actions/
  │   ├── similarity.ts
  │   └── similarity.test.ts
  ├── lib/
  │   ├── types.ts
  │   └── semanticSimilarity.ts
  │   └── semanticSimilarity.test.ts
  └── app/
      └── components/
          ├── tasting/
          │   ├── Summary.tsx
          │   └── Summary.test.tsx
  ```

## Test Structure

**Proposed Patterns for Implementation:**

### Unit Tests - Server Actions

For server-side functions like `serverSideSimilarity()` in `src/actions/similarity.ts`:

```typescript
// similarity.test.ts
describe('serverSideSimilarity', () => {
  it('should return 0 for empty inputs', async () => {
    const result = await serverSideSimilarity('', '');
    expect(result).toBe(0);
  });

  it('should return number between 0-100', async () => {
    const result = await serverSideSimilarity('red wine', 'rød vin');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('should handle null/undefined gracefully', async () => {
    // Test edge cases
  });
});
```

### Component Tests - React Components

For client components like `Summary.tsx` in `src/app/components/tasting/`:

```typescript
// Summary.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { Summary } from './Summary';
import { JotaiRoot } from 'jotai'; // or appropriate test wrapper

describe('Summary Component', () => {
  it('should render loading state initially', () => {
    render(
      <JotaiRoot>
        <Summary />
      </JotaiRoot>
    );
    expect(screen.getByText(/Beregner din smaksscore/i)).toBeInTheDocument();
  });

  it('should display overall score after calculation', async () => {
    render(
      <JotaiRoot>
        <Summary />
      </JotaiRoot>
    );
    await waitFor(() => {
      expect(screen.queryByText(/Beregner din smaksscore/i)).not.toBeInTheDocument();
    });
  });

  it('should toggle comparison view on button click', async () => {
    // Test state changes
  });
});
```

### Utility Function Tests

For calculation helpers like `calculateNumericSimilarity()` in `src/app/components/tasting/Summary.tsx`:

```typescript
describe('calculateNumericSimilarity', () => {
  it('should return 0 for invalid inputs', () => {
    const result = calculateNumericSimilarity('invalid', null);
    expect(result).toBe(0);
  });

  it('should normalize different scales correctly', () => {
    const result = calculateNumericSimilarity(5, 6, 10, 12);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
```

## Mocking

**Framework:** Not yet configured - would use Vitest or Jest mocking

**Patterns to implement:**

```typescript
// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } })
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [] })
      })
    })
  }))
}));

// Mock Jotai atoms
vi.mock('jotai', () => ({
  atom: vi.fn(),
  useAtom: vi.fn(),
  useAtomValue: vi.fn()
}));
```

**What to Mock:**
- External APIs (Supabase, OpenAI)
- Third-party libraries (Jotai atoms for state)
- Slow operations (embeddings, transformers)
- Browser APIs (localStorage, fetch)

**What NOT to Mock:**
- Pure utility functions (calculation helpers, string transformations)
- Type definitions
- Component rendering logic (use real components in integration tests)

## Fixtures and Factories

**Test Data (to be created):**

```typescript
// __fixtures__/wine.fixture.ts
export const mockWine = {
  id: 'wine-123',
  product_id: 'prod-456',
  name: 'Test Wine',
  color: 'Rødlig',
  smell: 'frukt, tanniner',
  taste: 'tørt, fyldig',
  main_category: 'Rødvin',
  alcohol: '14%',
  price: '199',
  friskhet: 8,
  fylde: 7,
  sodme: 3,
  garvestoff: 6
} as Wine;

export const mockTasting = {
  farge: 'Rødlig',
  lukt: 'frukt',
  smak: 'tørt',
  friskhet: 8,
  fylde: 7,
  sodme: 0,
  snaerp: 6,
  karakter: 8,
  egenskaper: 'Fin kvalitet',
  selectedFlavorsLukt: [],
  selectedFlavorsSmak: []
} as TastingFormData;
```

**Location:** `src/__fixtures__/` or `src/**/__fixtures__/`

## Coverage

**Current Coverage:** Not applicable (no tests configured)

**Recommended Targets:**
- Utility functions: 90%+ coverage (calculation, similarity functions)
- Server actions: 85%+ coverage (database operations)
- Components: 70%+ coverage (focus on user interactions, state changes)
- Overall: 80%+ target for production code

**View Coverage (proposed):**
```bash
npm run test:coverage
# Generates coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, methods, utilities
- Approach: Test in isolation with mocked dependencies
- Examples: `lemmaSimpleSimilarity()`, `calculateNumericSimilarity()`, `cosineSimilarity()`
- Coverage priority: High (pure functions with no side effects)

**Integration Tests:**
- Scope: Multiple units working together
- Approach: Test actual database calls, real state management
- Examples: Server action flow `addTasting()` with Supabase, `Summary` component with real atom updates
- Coverage priority: Medium (critical flows)

**E2E Tests:**
- Status: Not configured
- Recommendation: Add Playwright or Cypress for critical user journeys:
  - Wine search → Tasting form → Summary
  - Event participation flow
  - User profile viewing

## Common Patterns

**Async Testing (not currently used, but needed):**

```typescript
// Using async/await
it('should fetch wine and calculate scores', async () => {
  const result = await serverSideSimilarity('red', 'rød');
  expect(result).toBeDefined();
});

// Using promises
it('should handle errors', () => {
  return serverSideSimilarity('', '').then(result => {
    expect(result).toBe(0);
  });
});

// Using waitFor for React state
await waitFor(() => {
  expect(screen.getByText(/score/i)).toBeInTheDocument();
});
```

**Error Testing:**

```typescript
// Test error handling paths
describe('Error scenarios', () => {
  it('should handle similarity calculation errors gracefully', async () => {
    const result = await lemmaSimpleSimilarity('invalid\u0000', 'text');
    expect(result).toBe(0); // Should return fallback value
  });

  it('should catch database errors and return useful messages', async () => {
    // Mock error response
    vi.mocked(createClient).mockRejectedValueOnce(new Error('DB error'));

    expect(() => addTasting(mockTasting)).rejects.toThrow('Failed to add tasting');
  });
});
```

**Component State Testing:**

```typescript
it('should update similarity scores when tasting changes', async () => {
  const { rerender } = render(<Summary />);

  // Update atom value
  act(() => {
    // Update state
  });

  rerender(<Summary />);

  await waitFor(() => {
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });
});
```

## Critical Functions Needing Tests

Priority areas for test implementation:

1. **Similarity Calculations** (`src/actions/similarity.ts`, `src/lib/`):
   - `serverSideSimilarity()` - Core scoring logic
   - `lemmaSimpleSimilarity()` - Lemma matching
   - `categorySimpleSimilarity()` - Category distribution
   - `cosineSimilarity()` - Vector similarity

2. **Server Actions** (`src/actions/`):
   - `addTasting()` - Tasting submission
   - `searchWines()` - Wine search
   - Verify database calls, error handling, redirects

3. **Components** (`src/app/components/`):
   - `Summary.tsx` - Score calculation and display
   - `WineSearch.tsx` - Search input, debounce, selection
   - `FlavorSelection.tsx` - Flavor picker state management
   - `TastingWizard.tsx` - Multi-step form navigation

4. **Numeric Helpers** (`src/app/components/tasting/Summary.tsx`):
   - `calculateNumericSimilarity()` - Normalization logic
   - `calculateDirectSimilarity()` - Percentage difference
   - Edge cases: NaN, zero values, different scales

---

*Testing analysis: 2026-02-02*

**Note:** This codebase requires test infrastructure setup. Consider implementing Vitest configuration and test suite to improve code quality and catch regressions.
