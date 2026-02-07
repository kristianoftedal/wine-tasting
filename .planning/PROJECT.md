# Wine Tasting Similarity Scoring

## What This Is

A Norwegian wine blind tasting app with an intelligent similarity scoring system. The system rewards users for identifying specific tasting notes (like "kirsebær", "eik", "pepper") over generic structural terms (like "fylde", "friskhet", "struktur"). Categories align with Vinmonopolet's official tasting wheels.

## Core Value

Specific tasting descriptors should contribute more to similarity scores than generic wine structure terms — rewarding actual tasting skill.

## Current State (v1.0 Shipped)

**Shipped:** 2026-02-07

**What's working:**
- Weight profile system with 3 switchable profiles (inverted, moderate, data-driven)
- Inverted profile rewards specific terms (1.3-2.5) over generic terms (0.8)
- 57 Vitest tests covering all scoring components
- Validation shows 100% pass rate for specific vs generic test cases
- Localhost (Xenova) and server (OpenAI) embeddings both working

**Tech stack:** Next.js, TypeScript, Supabase, Vitest
**LOC:** 10,186 TypeScript

## Requirements

### Validated

- ✓ Re-weight terms: lower weights for generic terms — v1.0
- ✓ Re-weight terms: higher weights for specific descriptors — v1.0
- ✓ Align categories with Vinmonopolet tasting wheels — v1.0
- ✓ Merge "bær" category into "frukt" category — v1.0
- ✓ Query database to identify actual language patterns — v1.0
- ✓ Create test cases comparing before/after scoring — v1.0
- ✓ Maintain localhost/server split functionality — v1.0
- ✓ Three switchable weight profiles — v1.0
- ✓ Environment variable profile selection — v1.0

### Active

(None — milestone just completed. Run `/gsd:new-milestone` to define next goals.)

### Out of Scope

- Bonus point system for specific notes — deferred to v2
- Changing the ML embedding model — current Xenova model sufficient
- UI changes — scoring logic only for v1.0
- Real-time score preview — would require significant frontend changes
- Multi-language support — Norwegian only

## Context

**Weight profiles available:**
- `inverted` (default): Specific notes 2.0-2.5, generic terms 1.0
- `moderate`: Specific notes 1.8-2.2, generic terms 1.2
- `data-driven`: Frequency-based (common terms weighted higher)

**Commands:**
- `npm run validate-scoring` — Run validation test suite
- `npm run validate-scoring -- --report` — Generate validation report
- `npm run recalculate-scores` — Preview score recalculation
- `npm test` — Run 57 unit tests

## Constraints

- **Tech stack**: Next.js, TypeScript, Supabase — no changes
- **Localhost compatibility**: Must work offline with local Xenova model
- **Server compatibility**: Must work with OpenAI embeddings when deployed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Invert weight hierarchy | Generic terms are easy to guess, specific notes show skill | ✓ Implemented — specific 2x higher than generic |
| Merge bær into frukt | Aligns with Vinmonopolet's categorization | ✓ Implemented — unified with weight 1.6 |
| Query actual database | Base lemmas on real language, not assumptions | ✓ Analyzed 49,067 wines |
| Profile weights replace base | Simpler mental model, no multiplication confusion | ✓ Good — cleaner code |
| Use tsx for scripts | 5-10x faster than ts-node | ✓ Good — fast iteration |
| Environment variable profiles | Easy to switch without code changes | ✓ Good — works in dev and prod |

---
*Last updated: 2026-02-07 after v1.0 milestone*
