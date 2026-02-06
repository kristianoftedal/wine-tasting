# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Specific tasting descriptors should contribute more to similarity scores than generic wine structure terms — rewarding actual tasting skill
**Current focus:** Phase 4 - Quality Assurance Complete

## Current Position

Phase: 4 of 5 (Quality Assurance)
Plan: 2 of 2 in current phase
Status: Phase 4 complete (verified)
Last activity: 2026-02-06 — Phase 4 verified, all must-haves passed (57 tests)

Progress: [█████████░] 90% (7 of ~8 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 4 min
- Total execution time: 0.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Data Analysis | 2 | 6 min | 3 min |
| 2. Category Restructuring | 2 | 6 min | 3 min |
| 3. Weight Profile System | 1 | 5 min | 5 min |
| 4. Quality Assurance | 2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 5min, 3min, 3min, 4min
- Trend: Steady velocity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Test isLocalhost logic indirectly via helper function replicating behavior (04-02)
- Use expectTypeOf for compile-time API signature verification (04-02)
- Migration script is read-only by default for safety (04-02)
- Node test environment (not jsdom) for pure function tests (04-01)
- Mock browser alert with vi.stubGlobal for node tests (04-01)
- vi.stubEnv + resetModules + dynamic import for env var testing (04-01)
- Profile weights REPLACE base weights (not multiply) (03-01)
- Data-driven profile uses frequency = high weight (opposite of inverted) (03-01)
- Invalid profile falls back to inverted with console warning (03-01)
- as const satisfies pattern for compile-time type safety (03-01)
- Maintain backwards compatibility: flat category field kept alongside hierarchical categoryPath (02-02)
- Berry merge weight set to 1.6: averaged from mørke bær 1.7 and røde bær 1.5 (Completed - 02-02)
- Weight inversion fully implemented: generic 0.8, specific 1.3+ (Completed - 02-02)
- Use ASCII-safe identifiers (baer not bær) to avoid encoding issues (02-01)
- Each main category has 'annet' fallback subcategory (02-01)
- Query actual database: Base lemmas on real language, not assumptions (Completed - 01-01)
- Use tsx over ts-node for faster TypeScript execution (01-01)
- Export norwegianLemmas to enable external analysis (01-02)

### Pending Todos

None.

### Blockers/Concerns

None - Phase 4 (Quality Assurance) complete. Full test suite with 57 tests covering:
- Lemmatization and weight scoring (20 tests)
- Profile selection and fallback (11 tests)
- Localhost detection and similarity switching (26 tests)

Migration script available: `npm run recalculate-scores`

Ready for Phase 5 (UI Improvements).

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed Phase 4 (Quality Assurance) - verified
Resume file: None
Next: Phase 4 complete - proceed to Phase 5 (Validation)
