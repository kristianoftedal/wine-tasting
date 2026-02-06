# Phase 4: Quality Assurance - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure the new scoring system (profiles, categories, lemmatization) works correctly in both localhost (Xenova embeddings) and server (OpenAI embeddings) environments without breaking existing functionality. This is verification and testing, not new features.

</domain>

<decisions>
## Implementation Decisions

### Testing scope
- All levels: unit tests + integration tests + manual smoke test
- Use Vitest as testing framework (fast, native ESM, good for Next.js)
- Focus on lemmatization/scoring logic, not embedding providers (those work independently)
- No coverage percentage requirements — write sensible tests for critical paths

### API compatibility
- Current graceful fallback behavior is sufficient (invalid profile falls back to inverted)
- No additional startup validation needed
- Provide migration path to recalculate existing scores with new system

### Claude's Discretion
- Determining which exports are critical for stability (likely lemmatizeAndWeight and profile functions)
- Best approach for verifying no breaking changes (TypeScript compilation, manual review, or snapshot tests)
- Exact test organization and naming conventions

</decisions>

<specifics>
## Specific Ideas

- Migration path should allow recalculating scores stored in the database with the new weight profiles
- Tests should verify profile switching works correctly via environment variable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-quality-assurance*
*Context gathered: 2026-02-06*
