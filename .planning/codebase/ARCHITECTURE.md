# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Next.js App Router with server/client component separation and asynchronous data flow

**Key Characteristics:**
- Server components for data fetching and authentication checks
- Client components for interactive features and state management
- Server Actions for backend operations
- Jotai atoms for cross-component state synchronization
- Supabase as primary data layer with RPC functions for complex queries
- Multi-strategy similarity matching (lemma, category, semantic)

## Layers

**Presentation Layer:**
- Purpose: User interface and interactive forms
- Location: `src/app/components/`, `src/app/**/page.tsx`
- Contains: React components, form handlers, modal dialogs
- Depends on: Jotai atoms, server actions, lib utilities
- Used by: Next.js routing system

**State Management Layer:**
- Purpose: Cross-component state synchronization without prop drilling
- Location: `src/app/store/`
- Contains: Jotai atoms (`tastingAtom`, `wineAtom`, `anonymSession`)
- Depends on: Jotai library
- Used by: Client components in tasting flow

**Server Action Layer:**
- Purpose: Encapsulate backend operations with authentication context
- Location: `src/actions/`
- Contains: Database mutations, similarity calculations, wine search
- Depends on: Supabase clients, similarity utilities
- Used by: Client components via form submissions

**Data Access Layer:**
- Purpose: Database connection and query execution
- Location: `src/lib/supabase/`
- Contains: Browser client (`client.ts`), server client (`server.ts`), middleware
- Depends on: @supabase/ssr, @supabase/supabase-js
- Used by: Server actions and API routes

**Similarity & Matching Layer:**
- Purpose: Calculate semantic and lexical similarity scores
- Location: `src/lib/semanticSimilarity.ts`, `src/lib/localSemanticSimilarity.ts`, `src/actions/similarity.ts`
- Contains: OpenAI embeddings, local ML embeddings, lemma matching, category matching
- Depends on: @xenova/transformers, ai SDK, lemmatization utilities
- Used by: Summary component, wine recommendation system

**Type/Domain Layer:**
- Purpose: Define data structures and business logic shapes
- Location: `src/lib/types.ts`, `src/lib/recommendation-types.ts`
- Contains: Tasting, Wine, Profile, Group types; form data shapes
- Depends on: None (pure definitions)
- Used by: All layers for type safety

## Data Flow

**Wine Tasting Flow:**

1. User navigates to `/smaking/[id]?eventId=optional`
2. `src/app/smaking/[id]/page.tsx` fetches wine from Supabase server-side
3. Wine data passed to `<TastingWizard>` client component
4. Wine stored in `wineAtom` via Jotai
5. User progresses through wizard steps (Color → Aroma → Taste → Attributes → Summary)
6. Each step updates `tastingAtom` in Jotai store
7. Summary component calls `serverSideSimilarity()` (server action) with user selections
8. Server action combines three strategies:
   - Lemma matching via `lemmatizeAndWeight()`
   - Category distribution matching
   - Semantic similarity (OpenAI embeddings or local @xenova/transformers)
9. Scores calculated and merged into `tastingAtom`
10. User submits via `addTasting()` server action
11. Server action inserts full tasting record to Supabase including scores

**Wine Search Flow:**

1. User types in search input (debounced 200ms)
2. Calls `searchWines()` server action
3. Server action invokes `search_wines_fuzzy` RPC on Supabase (trigram similarity)
4. Results with fuzzy-matched similarity scores returned
5. Results displayed in dropdown with keyboard navigation
6. Selection triggers `onSelect` callback, stores wine in `wineAtom`

**Wine Recommendation Flow:**

1. Called from profile/group pages
2. Invokes `findSimilarWinesSQL()` server action
3. Queries user's high-rated tastings (karakter >= threshold)
4. Groups tastings by wine category (Rødvin vs Hvitvin)
5. Calculates average attributes (fylde, friskhet, sødme, snærp)
6. Calls `find_similar_wines_weighted` RPC with averaged attributes
7. For each candidate wine, calculates semantic similarity of smell/taste vs user preferences
8. Combines numeric scores (weighted by category attributes) with semantic scores
9. Returns sorted list of recommended wines with detailed similarity breakdowns

**State Management:**

- `tastingAtom`: Holds form data across wizard steps; subscribed to by Summary for score calculation
- `wineAtom`: Current wine being tasted; read by Summary and TastingWizard
- `anonymSession`: Tracks anonymous user flag

## Key Abstractions

**Similarity Score Calculation:**
- Purpose: Compare user input against expert/wine data across multiple dimensions
- Examples: `src/lib/semanticSimilarity.ts`, `src/lib/localSemanticSimilarity.ts`, `src/actions/similarity.ts`
- Pattern: Three-method consensus with fallback chain
  - Method 1: Lemma-based Jaccard similarity (fast, lexical)
  - Method 2: Category distribution Jaccard similarity (fast, categorical)
  - Method 3: Semantic embeddings (slower, semantic understanding)
  - Fallback: Local @xenova model if OpenAI API unavailable
  - Final: Average of available scores

**Wine Recommendation Engine:**
- Purpose: Find wines similar to user's preferences
- Examples: `src/actions/wine-recommendations-sql.ts`
- Pattern: Attribute aggregation + numeric ranking + semantic re-scoring
  - Aggregates user's high-rated tastings into average wine profile
  - Queries database for candidates with similar numeric attributes
  - Re-ranks candidates by semantic similarity of flavor descriptions
  - Applies category-specific attribute weights (Rødvin uses garvestoff, Hvitvin uses sødme)

**Tasting Form Data:**
- Purpose: Persist form state across multi-step wizard
- Examples: `src/lib/types.ts` TastingFormData, `src/app/store/tasting.ts`
- Pattern: Dual representation in state (raw form values) and database (transformed scores)
  - Form tracks user input as strings/numbers
  - On summary display, calculates numeric scores
  - On save, transforms and persists all scores plus original input

## Entry Points

**Home Page:**
- Location: `src/app/page.tsx`
- Triggers: User visits /
- Responsibilities: Display featured wines, upcoming events, search prompt

**Wine Tasting Wizard:**
- Location: `src/app/smaking/[id]/page.tsx`
- Triggers: User clicks "Taste this wine" from search results
- Responsibilities: Multi-step form for recording tasting observations

**Wine Search:**
- Location: `src/app/page.tsx` and `src/app/smaking/[id]/page.tsx`
- Triggers: User types in search input
- Responsibilities: Query fuzzy-matched wines via `searchWines()` server action

**Profile:**
- Location: `src/app/profil/page.tsx`
- Triggers: User clicks profile link in AppBar
- Responsibilities: Show user's tasting history and recommendations

**API Routes:**
- `/api/embeddings` (`src/app/api/embeddings/route.ts`): Generate OpenAI text embeddings
- `/api/wine-image/[productId]` (`src/app/api/wine-image/[productId]/route.ts`): Proxy wine images from Vinmonopolet
- `/api/sommailer` (`src/app/api/sommailer/route.ts`): Sommailer integration endpoint

## Error Handling

**Strategy:** Graceful degradation with user-facing fallbacks

**Patterns:**

- **Similarity Calculation Fallback Chain:**
  ```typescript
  // Try OpenAI embeddings first
  try {
    semanticScore = await semanticSimilarity(text1, text2);
  } catch {
    // Fall back to local ML model
    semanticScore = await localSemanticSimilarity(text1, text2);
  }
  ```
  Located in `src/actions/similarity.ts` `serverSideSimilarity()`

- **Wine Search Fallback:**
  - Primary: RPC function `search_wines_fuzzy` with trigram similarity
  - Fallback: Simple ILIKE query on wine name
  - Located in `src/actions/wine-search.ts` line 36-42

- **Network Error Handling:**
  - Wine image proxy with 5-second timeout, returns 404 on failure
  - OpenAI API retries with exponential backoff (1s, 2s, 4s)
  - Located in `src/app/api/embeddings/route.ts` `generateEmbeddingWithRetry()`

- **Auth Error Handling:**
  - Server actions check for user; redirect to /login if missing
  - Located in `src/actions/tasting.ts`

## Cross-Cutting Concerns

**Logging:**
- Console errors for API failures (Supabase RPC, OpenAI embeddings)
- No centralized logging infrastructure; uses `console.error()` and `console.log()`
- Examples: `src/actions/wine-recommendations-sql.ts` lines 69-70, 119

**Validation:**
- TypeScript strict mode disabled (`"strict": false` in tsconfig.json)
- Runtime validation minimal; relies on Supabase RPC parameter validation
- Form validation via React Hook Form patterns in tasting components

**Authentication:**
- Supabase Auth via `createClient()` and `createServerClient()`
- User context checked in server actions and middleware
- Session state tracked via Supabase auth cookies

**Caching:**
- HTTP image cache: 1 day for wine images (`Cache-Control: public, max-age=86400`)
- No application-level caching (Jotai atoms persist only during session)
- Supabase client caches connections (singleton pattern in `src/lib/supabase/client.ts`)

**Environment Configuration:**
- Supabase URL and anon key via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- OpenAI API key via `AI_GATEWAY_API_KEY` (checked to decide local vs remote embeddings)
- Vercel deployment detection via `VERCEL_URL` and `NEXT_PUBLIC_VERCEL_URL`

---

*Architecture analysis: 2026-02-02*
