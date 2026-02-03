---
phase: 02-category-restructuring
plan: 01
subsystem: data-model
tags: [typescript, category-hierarchy, vinmonopolet, validation, lemma-dictionary]

# Dependency graph
requires:
  - phase: 01-data-analysis
    provides: norwegianLemmas dictionary with flat category structure
provides:
  - New hierarchical category module with 6 main categories
  - Vinmonopolet-inspired aromahjul structure
  - Berry term consolidation into single subcategory
  - Inverted weight hierarchy (generic 0.8 vs specific 1.3+)
  - Category validation script
affects: [02-02-migration-implementation, 03-ui-integration, similarity-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [hierarchical-category-structure, const-assertions, validation-scripts]

key-files:
  created:
    - src/lib/categories/types.ts
    - src/lib/categories/hierarchy.ts
    - src/lib/categories/index.ts
    - scripts/validate-categories.ts
  modified: []

key-decisions:
  - "Use ASCII-safe identifiers (baer not bær) to avoid encoding issues"
  - "Merge all berry terms into single 'baer' subcategory with averaged weight 1.6"
  - "Generic structure terms weighted at 0.8 (lower than all specific categories)"
  - "Each main category has 'annet' fallback subcategory"

patterns-established:
  - "Category hierarchy: MainCategory -> Subcategory -> Terms with const assertions"
  - "Validation scripts using tsx for TypeScript execution"
  - "Separation of aroma categories (WINE_CATEGORIES) from generic structure terms"

# Metrics
duration: 1min
completed: 2026-02-03
---

# Phase 02 Plan 01: Hierarchical Category Module Summary

**Vinmonopolet-inspired category hierarchy with 6 main categories, 25 subcategories, 115 categorized terms, and validation ensuring no duplicates**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-03T06:39:32Z
- **Completed:** 2026-02-03T06:41:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created parallel hierarchical category module that can be validated before replacing flat structure
- Consolidated 8 berry terms ('mørke bær' + 'røde bær') into single 'baer' subcategory
- Implemented weight inversion: generic terms (0.8) now lower than specific aroma terms (1.3-1.8)
- Validation script confirms zero duplicates across 115 terms in 25 subcategories

## Task Commits

Each task was committed atomically:

1. **Task 1: Create categories module with types and hierarchy** - `7172157` (feat)
2. **Task 2: Create validation script for category structure** - `631c1da` (test)

## Files Created/Modified
- `src/lib/categories/types.ts` - Type definitions for MainCategory, WineSubcategory, CategoryPath, LemmaDataV2
- `src/lib/categories/hierarchy.ts` - WINE_CATEGORIES (6 main) and GENERIC_STRUCTURE_TERMS const objects with terms and weights
- `src/lib/categories/index.ts` - Public exports from categories module
- `scripts/validate-categories.ts` - Validation script checking duplicates, berry merge, weight hierarchy, core lemma presence

## Decisions Made

1. **ASCII-safe identifiers for category keys:** Use 'baer' not 'bær', 'toerket' not 'tørket' to prevent encoding issues in TypeScript identifiers. Norwegian characters preserved in terms arrays.

2. **Berry merge to 'baer' subcategory:** Merged old 'mørke bær' (1.7) and 'røde bær' (1.5) categories into single 'Frukt/baer' with averaged weight 1.6. Includes 8 terms: solbaer, bjoernbaer, blabaer, morell, kirsbaer, jordbaer, bringbaer, rips.

3. **Generic weight set to 0.8:** All GENERIC_STRUCTURE_TERMS weighted at 0.8, ensuring they're lower than minimum specific category weight (1.3 for Urter/Blomster). Maximum generic (0.8) < minimum specific (1.3) confirmed by validation.

4. **'annet' fallback in each main category:** Every main category has an 'annet' subcategory for terms that don't fit specialized subcategories (e.g., eple/paere in Frukt/annet).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 02 Plan 02 (migration implementation):**
- New category module is type-safe and validated
- Validation script confirms structural integrity (no duplicates, berry merge complete, weight hierarchy correct)
- Parallel module approach allows migration without breaking existing code
- Next step: Implement automatic migration from flat norwegianLemmas to hierarchical structure

**Statistics from validation:**
- 6 main categories (Frukt, Krydder, Urter, Blomster, Eik/fat, Mineral)
- 25 subcategories total
- 115 terms categorized
- 0 duplicates
- 71 old terms uncategorized (expected - includes inflections, variants)

---
*Phase: 02-category-restructuring*
*Completed: 2026-02-03*
