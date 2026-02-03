---
phase: 02-category-restructuring
plan: 02
subsystem: data-model
tags: [typescript, lemmatization, category-hierarchy, weight-inversion]

# Dependency graph
requires:
  - phase: 02-01
    provides: Hierarchical category module with CategoryPath types
provides:
  - Migrated lemmatizeAndWeight.ts to use hierarchical categories
  - Weight inversion implemented (generic 0.8, specific 1.3+)
  - Berry category merge (mørke bær + røde bær → bær)
  - All lemmas have categoryPath for hierarchical scoring
affects: [02-03, similarity-calculation, tasting-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [weight-inversion, hierarchical-categories]

key-files:
  created: []
  modified: [src/lib/lemmatizeAndWeight.ts, src/lib/categories/types.ts]

key-decisions:
  - "Weight inversion implemented: generic structure terms (0.8) now lower than specific descriptors (1.3+)"
  - "Berry merge completed: all berries unified into single 'bær' category with weight 1.6"
  - "All lemmas now include optional categoryPath field for hierarchical lookups"

patterns-established:
  - "Backwards compatibility: kept flat category field while adding hierarchical categoryPath"
  - "Generic vs specific abstraction: GENERIC main category for structure terms vs specific aroma categories"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 02 Plan 02: Lemmatization Migration Summary

**Weight-inverted lemma dictionary with hierarchical CategoryPath structure, merged berry categories, and dual-mode compatibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T08:43:56Z
- **Completed:** 2026-02-03T08:48:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Weight inversion successfully implemented: generic structure terms reduced from 1.8-2.5 to 0.8, specific descriptors maintained at 1.3-1.8
- Berry merge completed: merged 'mørke bær' and 'røde bær' into unified 'bær' category with averaged weight 1.6
- All 182 lemma entries now include hierarchical categoryPath field for future hierarchical scoring
- Backwards compatibility maintained with existing flat category field

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate WineCategory type and LemmaData to use CategoryPath** - `fb48d05` (feat)
2. **Task 2: Update norwegianLemmas with inverted weights and merged categories** - `10a8ed5` (feat)

## Files Created/Modified
- `src/lib/lemmatizeAndWeight.ts` - Migrated to hierarchical categories with weight inversion
- `src/lib/categories/types.ts` - Fixed GenericCategory type to include 'general'

## Decisions Made
- **Backwards compatibility approach**: Keep flat `category` field for existing code, add optional `categoryPath` for new hierarchical features
- **Berry merge weight**: Averaged old weights (1.7 + 1.5) / 2 = 1.6 for unified berry category
- **Fixed missing 'general' type**: Added to GenericCategory type definition (was present in hierarchy.ts but missing from type)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing 'general' in GenericCategory type**
- **Found during:** Task 2 (TypeScript compilation of lemma updates)
- **Issue:** hierarchy.ts defined 'general' category but types.ts GenericCategory type didn't include it
- **Fix:** Added 'general' to GenericCategory union type
- **Files modified:** src/lib/categories/types.ts
- **Verification:** TypeScript compilation succeeds
- **Committed in:** 10a8ed5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for type correctness. No scope creep.

## Issues Encountered

TypeScript compilation shows pre-existing warnings about MapIterator spread operator requiring downlevelIteration flag. These existed before migration and are unrelated to category restructuring work.

## Next Phase Readiness

**Ready for 02-03 (Similarity Calculation Update)**
- lemmatizeAndWeight.ts successfully migrated to hierarchical structure
- All lemmas have categoryPath field for hierarchical scoring
- Weight inversion verified: struktur (0.8) < solbær (1.6)
- Berry merge verified: all berry terms use unified 'bær' category
- Validation script passes with no errors

**No blockers**

## Weight Changes Summary

| Category Group | Old Weight | New Weight | Change |
|---------------|-----------|-----------|--------|
| STRUKTUR/KVALITET | 2.5 | 0.8 | ↓ 68% |
| ETTERSMAK | 2.3 | 0.8 | ↓ 65% |
| FYLDE | 2.0 | 0.8 | ↓ 60% |
| FRISKHET | 2.0 | 0.8 | ↓ 60% |
| SØDME | 1.8 | 0.8 | ↓ 56% |
| TEKSTUR | 1.5 | 0.8 | ↓ 47% |
| GENERELL | 0.8 | 0.8 | → (unchanged) |
| BÆR (merged) | 1.5-1.7 | 1.6 | → (averaged) |
| SPECIFIC DESCRIPTORS | 1.3-1.8 | 1.3-1.8 | → (unchanged) |

**Effect:** Specific tasting descriptors (solbær, sitrus, krydder) now contribute 2x more to similarity scores than generic structure terms (balanse, fylde, struktur).

---
*Phase: 02-category-restructuring*
*Completed: 2026-02-03*
