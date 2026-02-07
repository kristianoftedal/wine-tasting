# Project Milestones: Wine Tasting Similarity Scoring

## v1.0 Similarity Scoring (Shipped: 2026-02-07)

**Delivered:** Weight profile system that rewards specific tasting notes over generic terms, validated through comprehensive testing.

**Phases completed:** 1-5 (9 plans total)

**Key accomplishments:**

- Analyzed 49,067 wines from Supabase, extracting Norwegian wine vocabulary
- Implemented weight inversion: specific descriptors (1.3-1.8) score higher than generic terms (0.8)
- Created 3 switchable weight profiles (inverted, moderate, data-driven) with env-based selection
- Built comprehensive test suite with 57 Vitest tests
- Validated scoring: inverted profile achieves 100% pass rate (20/20 test cases)
- Maintained localhost/server compatibility (Xenova and OpenAI embeddings)

**Stats:**

- ~50 files created/modified
- 10,186 lines of TypeScript
- 5 phases, 9 plans
- 6 days from start to ship

**Git range:** `ac4b9ac` → `4dd023d`

**What's next:** Consider bonus point system, progressive scoring, or visual feedback for score contributions.

---
