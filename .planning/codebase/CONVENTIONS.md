# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Summary.tsx`, `FlavorSelection.tsx`, `WineSearch.tsx`)
- Utilities/Actions: camelCase (e.g., `lemmatizeAndWeight.ts`, `localSemanticSimilarity.ts`)
- Types/Models: camelCase with suffix (e.g., `tastingModel.ts`, `productModel.ts`)
- Store/Atoms: camelCase (e.g., `tasting.ts`)
- Styles: PascalCase with `.module.css` suffix (e.g., `Summary.module.css`, `TastingWizard.module.css`)

**Functions:**
- camelCase for all functions (server actions, client functions, utilities)
- Examples: `serverSideSimilarity()`, `lemmaSimpleSimilarity()`, `calculateNumericSimilarity()`, `searchWines()`
- Async functions follow same convention: `calculateScores()`, `addTasting()`, `getEmbedder()`

**Variables:**
- camelCase for all local and state variables
- Examples: `tastingState`, `setTastingState`, `wineAtom`, `selectedIndex`, `isCalculating`
- Constants in camelCase (not UPPER_CASE). Examples: `stopwords`, `initialTastingForm`
- Temporary/internal: Single letter allowed for map/reduce functions: `x`, `i`, `c`

**Types:**
- PascalCase for all type names: `Wine`, `Tasting`, `TastingFormData`, `WineType`, `Event`, `Group`, `Profile`
- Union types: `WineType = 'Rødvin' | 'Hvitvin' | 'Musserende vin' | 'Rosévin'`
- Intensitet enum-like: `Intensitet = 'lav' | 'middels' | 'høy' | ''`

**Database/Domain vs UI:**
- Database fields: snake_case (from Supabase schema): `product_id`, `main_category`, `main_country`, `lukt_intensitet`
- UI/Form fields: camelCase when normalized: `tastedAt`, `wineId`, `userId`, `overallScore`
- Flavor/Category types: PascalCase: `Category`, `Flavor`, `Subcategory`, `SelectedFlavor`

## Code Style

**Formatting:**
- Formatter: Prettier (configured)
- Tab width: 2 spaces
- Print width: 120 characters
- Single quotes: true (`'` not `"`)
- Trailing commas: none
- Arrow function parens: avoid when possible (`x => x` not `(x) => x`)
- Brace style: same line (`bracketSameLine: true`)
- Single attribute per line: true (in JSX)

**Key Prettier settings from `.prettierrc`:**
```json
{
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 120,
  "trailingComma": "none",
  "arrowParens": "avoid",
  "useTabs": false,
  "bracketSameLine": true,
  "singleAttributePerLine": true
}
```

**Linting:**
- Tool: ESLint with Next.js and TypeScript rules
- Config: `.eslintrc.json`
- Strict rules enforced:
  - `@typescript-eslint/no-explicit-any`: error - must use proper typing
  - `@typescript-eslint/no-unused-vars`: error - remove unused imports
  - `no-undef`: error - all variables must be defined
- Ignored paths: `*/api/auth/**/*.ts` (authentication endpoints)

## Import Organization

**Order:**
1. React/Next.js imports: `import React from 'react'`, `import { useEffect } from 'react'`
2. Next.js specific: `import { useRouter } from 'next/navigation'`, `import Image from 'next/image'`
3. Third-party libraries: `import { useAtom } from 'jotai'`, `import he from 'he'`
4. Type imports: `import type { Wine } from '@/lib/types'`
5. Internal imports: `import { serverSideSimilarity } from '@/actions/similarity'`
6. Local relative imports: `import { initialtastingForm, tastingAtom } from '../store/tasting'`
7. Styles: `import styles from './Summary.module.css'`

**Path Aliases:**
- Configured: `@/*` → `./src/*`
- All imports use `@/` prefix for absolute imports from `src/` directory
- Examples: `@/actions/`, `@/app/`, `@/lib/`, `@/app/store/`, `@/app/data/`

**Type imports convention:**
```typescript
import type { Wine, TastingFormData } from '@/lib/types';
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and error-prone code
- Console logging on errors: `console.error()` for serious errors, `console.warn()` for recoverable issues
- Fallback returns: Return sensible defaults rather than throwing (e.g., similarity functions return 0 on error)
- Server actions use `redirect()` for auth failures: `redirect('/login')`

**Examples from codebase:**
```typescript
// similarity.ts error handling
try {
  // calculation
  return Math.round((intersection / union) * 100);
} catch (error) {
  console.error('Lemma similarity error:', error);
  return 0; // Graceful fallback
}

// Summary.tsx error handling
try {
  // async calculation
  const [colorScore, smellScore, tasteScore] = await Promise.all([...]);
  setScores(newScores);
} catch (error) {
  console.log(JSON.stringify(error));
  setScores(initState());
} finally {
  setIsCalculating(false);
}

// tasting.ts server action
if (!user) {
  redirect('/login'); // Use redirect for auth
}
if (error) {
  console.error('Error adding tasting:', error);
  throw new Error('Failed to add tasting');
}
```

## Logging

**Framework:** `console` (native JavaScript)

**Patterns:**
- Use `console.error()` for errors: `console.error('Error adding tasting:', error)`
- Use `console.warn()` for warnings: `console.warn('OpenAI embedding failed, falling back to local similarity')`
- Use `console.log()` for debugging (should be removed in production): `console.log(JSON.stringify(error))`
- Server actions may log to server console, client components log to browser console

## Comments

**When to Comment:**
- JSDoc/TSDoc for exported functions and public APIs
- Inline comments for complex logic sections
- Comments explaining WHY, not WHAT (code should be self-documenting)

**JSDoc/TSDoc Usage:**
Comments use block syntax over implementation details:

```typescript
/**
 * Compute similarity between lemmatized words (0-100)
 */
export async function lemmaSimpleSimilarity(text1: string, text2: string): Promise<number>

/**
 * Calculate comprehensive server-side similarity score using:
 * - Lemma matching
 * - Category matching
 * - OpenAI embedding similarity (if AI_GATEWAY_API_KEY is available and not localhost)
 * - Falls back to local semantic similarity on localhost or when API key is missing
 * Final score = average of available scores
 */
export async function serverSideSimilarity(text1: string, text2: string): Promise<number>
```

## Function Design

**Size:** Functions are concise, typically 20-50 lines. Longer functions are broken into smaller helpers.

**Parameters:**
- Typed with TypeScript: `(text1: string, text2: string): Promise<number>`
- Optional parameters marked: `(type?: 'lukt' | 'smak')`
- Destructuring used for props: `({ type = 'lukt', vintype }: Props)`

**Return Values:**
- Type annotations always present: `: Promise<number>`, `: Wine | null`
- Consistent return paths (always return same type)
- Async functions always return Promise: `Promise<number>`, `Promise<void>`

## Module Design

**Exports:**
- Named exports for functions and types (not default exports)
- Single default export for React components sometimes used
- Example: `export const Summary: React.FC = () => { ... }`
- Example: `export async function serverSideSimilarity(...): Promise<number>`

**Barrel Files:**
- Not commonly used; imports are direct to specific files
- Store atoms are re-exported: `export { initialTastingForm }` in `tasting.ts`

**Separation of Concerns:**
- Server actions in `src/actions/` with `'use server'` directive
- Client components marked with `'use client'` directive
- Types centralized in `src/lib/types.ts`
- Store/state management in `src/app/store/`
- Utilities in `src/lib/`
- UI components in `src/app/components/`

## TypeScript Strictness

**Config notes from tsconfig.json:**
- Target: ES2017
- `strict: false` - Not using strict mode (allows implicit `any` in some cases)
- `noEmit: true` - Type checking only, no output
- JSX: `react-jsx` (modern React JSX transform)
- Module resolution: bundler

## React/Next.js Patterns

**Component Types:**
- Functional components with `React.FC<Props>` type annotation
- Use of hooks: `useAtom`, `useAtomValue`, `useSetAtom` (Jotai state management)
- Use of Next.js hooks: `useRouter`, `useSearchParams`

**State Management:**
- Jotai atoms for global state: `tastingAtom`, `wineAtom`
- Atoms are initialized with default values: `atom<TastingFormData>(initialTastingForm)`
- Local React state for UI-only state: `useState()` for UI interactions

**Server Components vs Client:**
- `'use server'` for server actions (database, external APIs)
- `'use client'` for interactive components
- Implicit server components for layouts and pages

---

*Convention analysis: 2026-02-02*
