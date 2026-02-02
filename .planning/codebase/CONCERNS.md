# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Large monolithic files in similarity logic:**
- Issue: `src/lib/lemmatizeAndWeight.ts` (426 lines) is a monolithic file combining type definitions, lemma data, utility functions, and analysis logic without clear separation
- Files: `src/lib/lemmatizeAndWeight.ts`
- Impact: Difficult to maintain, extend lemma dictionary, or test individual components independently. File includes 274-line hardcoded lemma dictionary mixed with algorithm logic
- Fix approach: Extract lemma dictionary into separate `src/lib/lemmas.ts`, move type definitions to `src/lib/types.ts`, and keep only analysis functions in `lemmatizeAndWeight.ts`

**Duplicate similarity calculation implementations:**
- Issue: Three separate similarity approaches exist (`semanticSimilarity`, `localSemanticSimilarity`, `lemmaSimpleSimilarity`, `categorySimpleSimilarity`) without clear responsibilities or documentation on when to use each
- Files: `src/lib/semanticSimilarity.ts`, `src/lib/localSemanticSimilarity.ts`, `src/actions/similarity.ts`
- Impact: Cognitive overhead, maintenance burden, risk of inconsistent results. Different scoring methodologies not clearly documented
- Fix approach: Create `src/lib/similarity/index.ts` that exports all methods with clear JSDoc explaining trade-offs (API cost, latency, accuracy). Add routing logic to `serverSideSimilarity` strategy selection

**Type safety issues with `any` types:**
- Issue: 14 instances of `any` type in codebase, primarily in `src/lib/localSemanticSimilarity.ts` (line 4) and `src/app/components/tasting/Summary.tsx` (lines 97, 98)
- Files: `src/lib/localSemanticSimilarity.ts`, `src/app/components/tasting/Summary.tsx`, `src/app/components/tasting/TastingWizard.tsx`
- Impact: Loss of TypeScript type checking, harder to refactor, potential runtime errors
- Fix approach: Replace `any` with proper types. Use `Record<string, any>` only when unavoidable with explanation comment. Create utility types for wine characteristics

**Hardcoded magic numbers:**
- Issue: Similarity calculations use hardcoded constants (0.5 thresholds, 100 score scaling, 20x multipliers for attribute differences) scattered across `src/actions/wine-recommendations-sql.ts` and `src/app/components/tasting/Summary.tsx`
- Files: `src/actions/wine-recommendations-sql.ts` (lines 109-112, 166-179), `src/app/components/tasting/Summary.tsx` (lines 14-15, 20)
- Impact: Hard to tune recommendation quality, no single source of truth for scoring logic
- Fix approach: Extract all constants to `src/lib/constants/scoring.ts` with documented rationale for each value

## Known Bugs

**Browser alert() in server-side code:**
- Issue: `src/lib/lemmatizeAndWeight.ts` line 412 contains `alert('Vennligst fyll inn begge tekstfeltene')` which is a browser API called in library code that may be used on server
- Files: `src/lib/lemmatizeAndWeight.ts` (line 412)
- Trigger: Call `lemmatizeAndWeight.analyze()` with empty strings
- Workaround: Function returns `undefined` on empty input, so caller should check return value
- Fix approach: Remove alert, throw typed error or return validation result object instead

**Alert dialogs for user feedback:**
- Issue: Multiple instances of browser `alert()` and `confirm()` dialogs for critical operations mixed in server actions and client components
- Files: `src/app/gruppe/[id]/arrangement/[eventId]/page.tsx` (lines with alert/confirm), `src/lib/lemmatizeAndWeight.ts`
- Trigger: Arrangement updates, deletions, validation failures
- Impact: Breaks accessibility standards, non-standard UX, not testable
- Fix approach: Replace with toast notifications or modal dialogs using existing toast setup in `src/app/provider.tsx`

**Unhandled promise rejections in similarity calculations:**
- Issue: `src/app/components/tasting/Summary.tsx` calls `serverSideSimilarity()` in useEffect without catching potential rejections
- Files: `src/app/components/tasting/Summary.tsx` (lines 120+)
- Trigger: Network failures, API quota exceeded
- Workaround: `serverSideSimilarity()` catches errors and returns 0
- Fix approach: Add explicit error boundary and user-facing error state in component

**Missing null checks for wine data:**
- Issue: `src/app/components/tasting/Summary.tsx` accesses `wine.content?.characteristics` and other nested properties without sufficient guards
- Files: `src/app/components/tasting/Summary.tsx` (lines 93-100)
- Trigger: Wine object missing expected properties
- Impact: Runtime errors when wine data structure varies
- Fix approach: Add optional chaining throughout, use type guards or schema validation

## Type Safety Concerns

**Inconsistent null handling for wine attributes:**
- Issue: Wine columns `fylde`, `friskhet`, `garvestoff`, `sodme` can be null (type `number | null`), but similarity scoring assumes they exist
- Files: `src/actions/wine-recommendations-sql.ts` (lines 166-180), `src/lib/types.ts` (lines 43-46)
- Impact: NaN values propagate through calculations, producing silent failures (returns 50 as default)
- Fix approach: Either require these fields (update schema/types) or add explicit null-coalescing before calculations

**Form data transformation without validation:**
- Issue: `TastingFormData` in `src/lib/types.ts` has duplicate fields (e.g., both `smell` and `selectedFlavorsLukt`, both `taste` and `selectedFlavorsSmak`) with unclear transformation rules
- Files: `src/lib/types.ts` (lines 150-168)
- Impact: Data inconsistency, confusion about which field is source of truth
- Fix approach: Use Zod schemas to validate transformations, document why both representations exist

## Security Considerations

**No input validation for user-submitted text:**
- Issue: Similarity calculations accept any string input without sanitization or length limits
- Files: `src/lib/semanticSimilarity.ts` (lines 23-45), `src/lib/localSemanticSimilarity.ts` (lines 39-66)
- Risk: Potential for embedding API abuse (very long inputs), ReDoS in regex replacements
- Current mitigation: OpenAI API truncates at 8000 chars (`src/app/api/embeddings/route.ts` line 10)
- Recommendations: Add validation at handler level (max length 2000), sanitize regex patterns, add request rate limiting for embedding API

**Database RPC call parameters not validated:**
- Issue: `findSimilarWinesSQL()` calls database RPC with numeric parameters without bounds checking
- Files: `src/actions/wine-recommendations-sql.ts` (lines 104-116)
- Risk: Invalid thresholds could return unexpected results or cause database errors
- Current mitigation: Supabase RLS policies
- Recommendations: Add bounds checking for `p_fylde`, `p_friskhet`, `p_sodme` (should be 1-10), validate `p_limit` (max 500)

**Console logging of sensitive data:**
- Issue: Debug console logs include user IDs, wine data, and potentially sensitive context
- Files: Multiple files with `console.log('[v0]')` prefix including `src/app/profil/page.tsx`, `src/app/sommailer/page.tsx`
- Risk: Accidentally exposed in production logs, visible to client-side users
- Current mitigation: None
- Recommendations: Replace `console.log` with environment-based logger that respects `NODE_ENV`, never log user data or wine details

## Performance Bottlenecks

**Sequential API calls for embeddings in recommendations:**
- Issue: `findSimilarWinesSQL()` calls `semanticSimilarity()` once per candidate wine (potentially 20+ calls)
- Files: `src/actions/wine-recommendations-sql.ts` (lines 137-149)
- Problem: Unoptimized loop - calls `embed()` function which may queue requests sequentially
- Impact: Recommendation generation slow (>10 seconds for 20 wines)
- Improvement path: Batch embedding requests using `batchSemanticSimilarity()` (already exists but not used), pre-compute wine embeddings and cache them

**Expensive lemmatization on every similarity call:**
- Issue: `lemmatizeAndWeight()` processes same text repeatedly during batch similarity checks
- Files: `src/lib/lemmatizeAndWeight.ts` (lines 326-361)
- Impact: Redundant string processing, regex operations on same inputs
- Improvement path: Memoize `lemmatizeAndWeight()` results by text hash, add LRU cache for common wine descriptions

**Inefficient Set/Map operations in similarity scoring:**
- Issue: `calculateWeightedSimilarity()` creates new Maps and Sets for every similarity calculation
- Files: `src/lib/lemmatizeAndWeight.ts` (lines 363-408)
- Impact: GC pressure during batch operations
- Improvement path: Pool Map objects, pre-allocate collections

**Missing database indexes on frequently queried columns:**
- Issue: Queries filter by `user_id`, `wine_id`, `karakter` but index status unknown
- Files: Supabase schema (not in repo)
- Impact: N+1 queries during recommendation generation
- Improvement path: Verify indexes on `tastings(user_id, karakter)`, `wines(id, main_category)`

## Fragile Areas

**Tasting form complexity:**
- Files: `src/app/components/tasting/Summary.tsx`, `src/app/components/tasting/TastingWizard.tsx`
- Why fragile: Summary component has nested try-catch blocks (3 levels) attempting to extract characteristics from multiple possible data structures. Multiple calculation functions with similar logic (`calculateNumericSimilarity`, `calculateDirectSimilarity`) that could diverge
- Safe modification: Add unit tests for all calculation functions with fixed test data. Create schema for wine.content.characteristics and validate on load. Consolidate calculation logic into single tested function
- Test coverage: No tests found for calculation logic

**Similarity function fallback chain:**
- Files: `src/actions/similarity.ts` (lines 73-107)
- Why fragile: Complex decision tree (local vs API, fallback on API failure) with multiple code paths. If fallback chain breaks, system silently returns score 0
- Safe modification: Extract decision logic to testable function, add explicit logging at each fallback point, add integration tests for failure scenarios
- Test coverage: No tests, only console.warn statements

**Wine recommendations without user feedback loop:**
- Files: `src/actions/wine-recommendations-sql.ts`, `src/actions/wine-similarity.ts`
- Why fragile: Scoring heavily depends on numeric attributes that may not reflect actual wine quality. Users cannot easily correct poor recommendations
- Safe modification: Add feedback mechanism (thumbs up/down on recommendations) before changing weights. Track recommendation accuracy over time
- Test coverage: No metrics on recommendation quality

## Scaling Limits

**Embedding API costs:**
- Current state: Each similarity call triggers 1-2 embedding API requests
- Limit: OpenAI text-embedding-3-small costs add up with thousands of user tastings
- At scale: 10,000 users × 100 tastings × 2 comparisons = 2M API calls/month
- Scaling path: Implement caching strategy (Redis cache of wine embeddings with 30-day TTL), batch similarity calculations, consider self-hosted embeddings (already have `localSemanticSimilarity`)

**Local embeddings model size:**
- Current state: `@xenova/transformers` model loaded on demand
- Limit: All-MiniLM-L6-v2 is ~80MB, loaded into Node memory once per server
- At scale: Serverless function cold starts with model loading
- Scaling path: Pre-warm model in dedicated service, use lighter model (DistilBERT), or pre-compute embeddings

**Memory usage in batch operations:**
- Current state: `batchSemanticSimilarity()` loads all unique texts into memory for embedding
- Limit: 10,000 wine descriptions simultaneously
- Scaling path: Stream embeddings, process in batches of 100, use async generators

## Dependencies at Risk

**@xenova/transformers (2.17.2):**
- Risk: Heavy weight dependency (80MB+), not actively maintained for production use
- Impact: Cold starts on serverless, model loading failures
- Migration plan: Remove from production code path. Keep `localSemanticSimilarity` for fallback only. Move to dedicated embedding service or switch to OpenAI embeddings exclusively

**@ai-sdk/openai and ai (latest):**
- Risk: Using `latest` version pins in package.json create non-deterministic builds
- Impact: Unexpected breaking changes between deployments
- Migration plan: Pin to specific minor versions (e.g., `^2.15.0` for ai SDK), add automated dependency updates with CI testing

**Supabase SDK version (2.84.0):**
- Risk: Version has known issues with RLS policies and CORS in some edge cases
- Current mitigation: Works in current deployment
- Monitoring: Track Supabase changelogs for security updates, test before upgrading

## Missing Critical Features

**No recommendation explainability:**
- Problem: Users see wine recommendations but don't understand why (which attributes matched)
- Blocks: Building user trust, allowing users to refine preferences
- Impact: Lower engagement with recommendations
- Approach: Add `attributeScores` breakdown to recommendation display (already calculated in `wine-recommendations-sql.ts` line 185-192)

**No graceful degradation for missing wine attributes:**
- Problem: Wines without `fylde`/`friskhet` data score 50 (neutral) in similarity calculations
- Blocks: Incomplete wine database coverage
- Impact: Poor recommendations for wines with sparse data
- Approach: Track attribute coverage per wine, weight recommendations inversely to data completeness

**No A/B testing framework for recommendation algorithms:**
- Problem: Cannot safely test new similarity approaches without affecting all users
- Blocks: Iterating on recommendation quality
- Approach: Add feature flag system to run multiple algorithms in parallel, track which produces better user engagement

## Test Coverage Gaps

**No tests for similarity calculations:**
- What's not tested: All three similarity functions (`lemmaSimpleSimilarity`, `categorySimpleSimilarity`, `serverSideSimilarity`), `calculateWeightedSimilarity`, `localSemanticSimilarity`
- Files: `src/lib/lemmatizeAndWeight.ts`, `src/lib/semanticSimilarity.ts`, `src/lib/localSemanticSimilarity.ts`, `src/actions/similarity.ts`
- Risk: Refactoring breaks silent scoring logic, no regression detection when lemma data changes
- Priority: High - recommendations core to app value

**No integration tests for wine recommendations:**
- What's not tested: `findSimilarWines()` and `findSimilarWinesSQL()` end-to-end with actual database data
- Files: `src/actions/wine-similarity.ts`, `src/actions/wine-recommendations-sql.ts`
- Risk: Database changes (schema, indexes, RLS) could break recommendations silently
- Priority: High - critical user-facing feature

**No tests for form components:**
- What's not tested: Tasting form validation, Summary component score calculations, score display logic
- Files: `src/app/components/tasting/TastingWizard.tsx`, `src/app/components/tasting/Summary.tsx`
- Risk: UI bugs in scoring calculation, form submission issues not caught
- Priority: Medium - impacts user experience

**No API route tests:**
- What's not tested: Embedding endpoint, Sommailer endpoint, error handling, retry logic
- Files: `src/app/api/embeddings/route.ts`, `src/app/api/sommailer/route.ts`
- Risk: API failures go undetected, retry logic never validated
- Priority: Medium - external integrations need validation

**No unit tests for helper functions:**
- What's not tested: `calculateNumericSimilarity()`, `calculateDirectSimilarity()`, `normalizeNumber()` in Summary component
- Files: `src/app/components/tasting/Summary.tsx` (lines 11-69)
- Risk: Numeric edge cases (NaN, division by zero) not handled correctly
- Priority: Medium - calculation correctness directly affects scoring

---

*Concerns audit: 2026-02-02*
