# Codebase Structure

**Analysis Date:** 2026-02-02

## Directory Layout

```
wine-tasting/
├── src/
│   ├── app/                       # Next.js app router pages and components
│   │   ├── api/                   # API routes
│   │   │   ├── embeddings/        # OpenAI embedding generation
│   │   │   ├── wine-image/        # Vinmonopolet image proxy
│   │   │   └── sommailer/         # Sommailer integration
│   │   ├── components/            # Shared components
│   │   │   ├── tasting/           # Multi-step tasting wizard components
│   │   │   ├── AppBar.tsx         # Navigation header
│   │   │   ├── Search.tsx         # Homepage search wrapper
│   │   │   ├── WineSearch.tsx     # Wine autocomplete search component
│   │   │   ├── UpcomingEvents.tsx # Event listing
│   │   │   └── WineDetailsModal.tsx # Wine information dialog
│   │   ├── store/                 # Jotai state atoms
│   │   ├── models/                # Database model definitions
│   │   ├── smaking/               # Wine tasting pages (/smaking/[id])
│   │   ├── profil/                # User profile pages
│   │   ├── gruppe/                # Group management pages
│   │   ├── arrangement/           # Event management pages
│   │   ├── login/                 # Login page
│   │   ├── register/              # Registration page
│   │   ├── toppliste/             # Rankings/leaderboards page
│   │   ├── sommailer/             # Sommelier integration page
│   │   ├── loader/                # Loading page
│   │   ├── layout.tsx             # Root layout with Provider
│   │   ├── page.tsx               # Home page
│   │   ├── provider.tsx           # Jotai Provider wrapper
│   │   ├── globals.css            # Global styles
│   │   └── favicon.ico            # App icon
│   ├── actions/                   # Server actions (form handlers, mutations)
│   ├── hooks/                     # React hooks (if any)
│   ├── lib/                       # Shared utilities and configurations
│   │   ├── supabase/              # Supabase client initialization
│   │   ├── types.ts               # TypeScript definitions
│   │   ├── recommendation-types.ts # Recommendation system types
│   │   ├── semanticSimilarity.ts  # OpenAI embedding similarity
│   │   ├── localSemanticSimilarity.ts # @xenova local embeddings
│   │   └── lemmatizeAndWeight.ts  # Lemmatization utility
│   └── middleware.ts              # Auth middleware (if at root)
├── types/                         # Global type definitions
├── public/                        # Static assets
├── .planning/codebase/            # GSD mapping documents
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── next.config.js                 # Next.js configuration
└── README.md                      # Project documentation
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js app router root; pages and layout
- Contains: Page components, API routes, component library
- Key files: `layout.tsx` (root), `page.tsx` (home), `provider.tsx` (state provider)

**`src/app/api/`:**
- Purpose: Backend API endpoints
- Contains: Route handlers for embeddings, image proxy, integrations
- Key files: `embeddings/route.ts`, `wine-image/[productId]/route.ts`

**`src/app/components/`:**
- Purpose: Reusable UI components shared across pages
- Contains: Search, navigation, modals, form components
- Key files: `WineSearch.tsx` (autocomplete), `tasting/TastingWizard.tsx` (multi-step form)

**`src/app/components/tasting/`:**
- Purpose: Components specific to multi-step wine tasting wizard
- Contains: Color selection, flavor/aroma selection, attributes, summary/scoring
- Key files: `TastingWizard.tsx` (orchestrator), `Summary.tsx` (scoring), `FlavorSelection.tsx` (flavor picker)

**`src/app/store/`:**
- Purpose: Global state atoms using Jotai
- Contains: Atoms for tasting form data and wine selection
- Key files: `tasting.ts` (tastingAtom, wineAtom), `session.ts` (anonymSession)

**`src/app/smaking/`:**
- Purpose: Wine tasting pages
- Routes: `/smaking/[id]` with optional `?eventId` query parameter
- Key files: `[id]/page.tsx` (entry point), `loading.tsx` (fallback UI)

**`src/app/profil/`:**
- Purpose: User profile and tasting history
- Routes: `/profil` (main profile), `/profil/tabs` (profile sections)
- Key files: Contains user's previous tastings and recommendations

**`src/app/gruppe/`:**
- Purpose: Group creation and management
- Routes: `/gruppe` (group list), `/gruppe/[id]` (group detail), `/gruppe/[id]/arrangement/` (events)
- Key files: Group pages and event management

**`src/actions/`:**
- Purpose: Server-side form handlers and mutations (Server Actions)
- Contains: Database mutations, search operations, similarity calculations
- Key files: `tasting.ts` (save tastings), `wine-search.ts` (search), `similarity.ts` (score calculations), `wine-recommendations-sql.ts` (recommendation engine)

**`src/lib/`:**
- Purpose: Shared utilities, configuration, type definitions
- Contains: Supabase clients, similarity algorithms, type definitions
- Key files: `types.ts` (all data types), `supabase/client.ts` (browser), `supabase/server.ts` (server)

**`src/lib/supabase/`:**
- Purpose: Supabase client initialization and configuration
- Contains: Browser client singleton, server client factory, auth middleware
- Key files: `client.ts` (createClient for client components), `server.ts` (createClient for server actions), `middleware.ts` (auth middleware)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout; wraps with Jotai Provider and AppBar
- `src/app/page.tsx`: Home page with featured wines and search
- `src/app/smaking/[id]/page.tsx`: Wine tasting entry point (fetches wine server-side)
- `src/app/login/page.tsx`: Login/authentication page
- `src/app/profil/page.tsx`: User dashboard

**Configuration:**
- `tsconfig.json`: Path alias `@/*` → `src/*`
- `package.json`: Scripts (dev, build, start, lint) and dependencies
- `next.config.js`: Next.js configuration (if present)

**Core Logic:**
- `src/lib/types.ts`: Data types for Wine, Tasting, Profile, Group, Event
- `src/lib/recommendation-types.ts`: Recommendation weights and thresholds
- `src/lib/semanticSimilarity.ts`: OpenAI embedding-based similarity (0-100 scale)
- `src/lib/localSemanticSimilarity.ts`: @xenova local ML similarity (fallback)
- `src/actions/similarity.ts`: Multi-strategy similarity with fallback chain
- `src/actions/wine-recommendations-sql.ts`: Wine recommendation engine

**Tasting Form:**
- `src/app/components/tasting/TastingWizard.tsx`: Multi-step form orchestrator
- `src/app/components/tasting/Color.tsx`: Color selection step
- `src/app/components/tasting/FlavorSelection.tsx`: Flavor/aroma/taste selection
- `src/app/components/tasting/TastingAttributes.tsx`: Numeric attributes (friskhet, fylde, etc.)
- `src/app/components/tasting/Summary.tsx`: Results and comparison with expert data

**Testing:**
- No test files present in codebase

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `WineSearch.tsx`, `Summary.tsx`)
- Server actions: camelCase (e.g., `wine-search.ts`, `similarity.ts`)
- Utilities: camelCase (e.g., `lemmatizeAndWeight.ts`)
- Pages: lowercase with brackets for dynamic segments (e.g., `[id]/page.tsx`)
- Styles: ComponentName.module.css (e.g., `WineSearch.module.css`)

**Directories:**
- Feature areas: lowercase plural (e.g., `components/`, `actions/`, `models/`)
- Page routes: lowercase kebab-case (e.g., `smaking/`, `profil/`, `gruppe/`)
- Dynamic segments: brackets (e.g., `[id]/`, `[eventId]/`, `[productId]/`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/app/components/` for UI, `src/actions/` for server logic
- Tests: Create `.test.ts` or `.test.tsx` file in same directory as implementation
- Types: Add to `src/lib/types.ts` or create feature-specific types file
- Example: Feature for wine ratings would go in `src/app/components/RatingForm.tsx` and `src/actions/rating.ts`

**New Component/Module:**
- Implementation: `src/app/components/` for reusable components
- Page components: `src/app/[feature]/` directory
- Styling: Create `ComponentName.module.css` alongside component
- Example: New filter component → `src/app/components/WineFilter.tsx` and `src/app/components/WineFilter.module.css`

**Utilities:**
- Shared helpers: `src/lib/` (unless domain-specific, then feature directory)
- Math/algorithms: `src/lib/` (e.g., similarity calculation)
- Database queries: `src/actions/` (server actions)
- Example: New tasting scoring formula → `src/lib/scoringFormula.ts`

**Server Actions:**
- Location: `src/actions/` with descriptive names
- Pattern: One file per feature area (tasting.ts, wine-search.ts, etc.)
- Signature: Export async functions marked with `'use server'` directive
- Example: New wine recommendation endpoint → `src/actions/wine-recommendations.ts`

## Special Directories

**`src/app/data/`:**
- Purpose: Static data or seed data (if present)
- Generated: No
- Committed: Yes

**`public/`:**
- Purpose: Static assets (images, icons, etc.)
- Generated: No
- Committed: Yes
- Examples: Icons, apple-icon.png, favicon.ico

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build`)
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents (created by orchestrator)
- Generated: Yes (by mapper agents)
- Committed: Yes (for team reference)

---

*Structure analysis: 2026-02-02*
