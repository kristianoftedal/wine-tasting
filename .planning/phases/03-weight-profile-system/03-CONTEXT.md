# Phase 3: Weight Profile System - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Create three switchable weight profiles (inverted, moderate, data-driven) that define category-level weights for scoring. Profiles REPLACE the base weights from Phase 2, not multiply them. Does NOT include wine-type-specific profiles or changes to embedding similarity calculations.

</domain>

<decisions>
## Implementation Decisions

### Weight values
- Profiles REPLACE base weights (not multiply)
- Category-level weights (all terms in a main category share one weight)
- Moderate differentiation (1.5-2x difference between generic and specific)
- Inverted profile: specific ~2.0, generic ~1.0
- Moderate profile: specific ~1.8, generic ~1.2
- Data-driven profile: weights based on NORMALIZED frequency (common terms = higher weight)

### Profile scope
- Global profiles (same weights for all wine types)
- Affects lemma weights only (embedding similarity calculation unchanged)
- Unknown terms get default generic weight (low weight fallback)
- Profiles stored in TypeScript code (typed consts, type-safe)

### Claude's Discretion
- Exact weight values within the moderate differentiation range
- How to structure the TypeScript profile types
- How profiles integrate with existing lemmatizeAndWeight module
- Profile selection mechanism (which profile is active)

</decisions>

<specifics>
## Specific Ideas

- Profiles should be typed TypeScript consts for type safety
- Category-level granularity keeps profiles simple (6 main categories + GENERIC)
- Data-driven profile uses Phase 1 frequency data to set weights
- Unknown terms treated as generic = conservative scoring

</specifics>

<deferred>
## Deferred Ideas

- Wine-type-specific profiles (red vs white vs sparkling) — could be future enhancement
- Profile affects embedding similarity — out of scope, lemma weights only

</deferred>

---

*Phase: 03-weight-profile-system*
*Context gathered: 2026-02-03*
