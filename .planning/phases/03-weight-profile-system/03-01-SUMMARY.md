---
phase: 03-weight-profile-system
plan: 01
subsystem: scoring
tags: [typescript, profiles, environment-variables, lemmatization, weights]

# Dependency graph
requires:
  - phase: 02-category-restructuring
    provides: MainCategory type, categoryPath in lemmas
provides:
  - WeightProfile interface and ProfileName type
  - Three weight profiles (inverted, moderate, data-driven)
  - Profile selection via NEXT_PUBLIC_WEIGHT_PROFILE env var
  - getCategoryWeight() for profile-based scoring
affects: [04-testing-framework, 05-scoring-refinement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as const satisfies pattern for type-safe config objects"
    - "Environment variable profile selection with fallback"
    - "Centralized config module for runtime settings"

key-files:
  created:
    - src/lib/profiles/types.ts
    - src/lib/profiles/weights.ts
    - src/lib/profiles/config.ts
    - src/lib/profiles/index.ts
  modified:
    - src/lib/lemmatizeAndWeight.ts

key-decisions:
  - "Profile weights REPLACE base weights (not multiply)"
  - "Data-driven profile uses frequency-based weights (common = high)"
  - "Invalid profile falls back to inverted with console warning"

patterns-established:
  - "as const satisfies WeightProfile for compile-time validation"
  - "NEXT_PUBLIC_ prefix for client-accessible env vars"
  - "getCategoryWeight() as single source of truth for scoring weights"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 3 Plan 1: Weight Profile System Summary

**Three switchable weight profiles (inverted/moderate/data-driven) with environment-based selection integrated into lemmatization scoring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T12:22:00Z
- **Completed:** 2026-02-03T12:27:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created profiles module with WeightProfile interface and ProfileName type
- Defined three weight profiles with category-level weights:
  - Inverted: specific 2.0-2.5, generic 1.0 (rewards tasting skill)
  - Moderate: specific 1.8-2.2, generic 1.2 (balanced approach)
  - Data-driven: frequency-based weights (GENERIC highest at 2.5)
- Implemented profile selection via NEXT_PUBLIC_WEIGHT_PROFILE environment variable
- Integrated profile weights into lemmatizeAndWeight function

## Task Commits

Each task was committed atomically:

1. **Task 1: Create profiles module with type definitions and weight profiles** - `1ec5131` (feat)
2. **Task 2: Create profile configuration with environment variable selection** - `415c7ee` (feat)
3. **Task 3: Integrate profiles into lemmatizeAndWeight** - `f0a216c` (feat)

## Files Created/Modified

- `src/lib/profiles/types.ts` - WeightProfile interface and ProfileName type
- `src/lib/profiles/weights.ts` - Three profile definitions (INVERTED, MODERATE, DATA_DRIVEN)
- `src/lib/profiles/config.ts` - Profile selection logic with getActiveProfile() and getCategoryWeight()
- `src/lib/profiles/index.ts` - Public exports for profiles module
- `src/lib/lemmatizeAndWeight.ts` - Modified to use getCategoryWeight() for scoring

## Decisions Made

- **Profile weights REPLACE base weights:** Per CONTEXT.md, profiles replace the base weights in norwegianLemmas rather than multiplying them
- **Data-driven uses frequency = high weight:** Common terms get higher weight in data-driven profile (opposite of inverted)
- **Fallback to inverted profile:** Invalid NEXT_PUBLIC_WEIGHT_PROFILE values fall back to inverted with console warning
- **as const satisfies pattern:** Used for compile-time type safety while preserving literal types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in codebase (unrelated to this phase) - ignored per plan focus
- Build succeeds despite `tsc --noEmit` showing errors (Next.js skips type validation in build)

## User Setup Required

**Environment variable configuration:**

To switch weight profiles, set in `.env.local`:
```
NEXT_PUBLIC_WEIGHT_PROFILE=inverted  # or: moderate, data-driven
```

If not set or invalid, defaults to `inverted` profile.

## Next Phase Readiness

- Profile system complete and integrated with lemmatization
- Ready for Phase 4 testing to validate profile behavior
- getCategoryWeight() available for any component needing profile-aware weights
- No blockers

---
*Phase: 03-weight-profile-system*
*Completed: 2026-02-03*
