# Phase 5: Validation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify that the new scoring system works as intended through before/after comparison using real wine data. This is validation and documentation of the existing implementation, not new feature development.

</domain>

<decisions>
## Implementation Decisions

### Success criteria
- Primary criterion: specific notes (e.g., 'solbær') must always score higher than generic terms (e.g., 'frisk') when matching
- Use real wines from database only (no synthetic test cases)
- Medium test set: 15-25 wine pairs for validation
- On failure: document and continue (don't block completion, log for future improvement)

### Comparison approach
- Compare all three profiles: inverted, moderate, and data-driven
- Show both numerical scores AND ranking (which terms contributed most)
- Automated comparison script + manual app testing checklist
- Validation results stored in appropriate location

### Claude's Discretion
- Where to store validation report (likely .planning/phases/05-* or scripts/validation-results/)
- Exact selection criteria for the 15-25 test wine pairs
- Format of the comparison report
- Manual testing checklist items

</decisions>

<specifics>
## Specific Ideas

- Focus on demonstrating that the inverted profile rewards specific tasting skill
- All three profiles should show their distinct characteristics in the comparison
- Manual verification should confirm that in-app scoring feels right for real comparisons

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-validation*
*Context gathered: 2026-02-06*
