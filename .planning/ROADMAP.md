# Roadmap: Wine Tasting Similarity Scoring

## Overview

This roadmap transforms the similarity scoring system to reward specific tasting notes over generic terms. We start by analyzing real database vocabulary, restructure categories to match Vinmonopolet's standards, build a switchable weight profile system, ensure compatibility across environments, and validate improvements through testing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Analysis** - Extract and analyze actual wine vocabulary from database
- [x] **Phase 2: Category Restructuring** - Align categories with Vinmonopolet tasting wheels
- [x] **Phase 3: Weight Profile System** - Create switchable weight profiles for different scoring strategies
- [ ] **Phase 4: Quality Assurance** - Ensure localhost/server compatibility maintained
- [ ] **Phase 5: Validation** - Verify scoring improvements through testing

## Phase Details

### Phase 1: Data Analysis
**Goal**: Understand actual Norwegian wine vocabulary used in the database
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. All smell/taste notes extracted from Supabase wines table
  2. Frequency analysis shows most common terms and categories
  3. Missing terms identified that should be in lemma dictionary
  4. Existing typos in lemmas documented with corrections needed
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Extract wines from Supabase, analyze term frequency
- [x] 01-02-PLAN.md — Identify missing terms and typos in lemma dictionary

### Phase 2: Category Restructuring
**Goal**: Categories align with Vinmonopolet's official tasting wheel structure
**Depends on**: Phase 1 (need vocabulary data to validate categories)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):
  1. Mørke bær and røde bær merged into unified frukt category
  2. Category structure matches Vinmonopolet aromahjul/smakshjul hierarchy
  3. Six main categories exist: Frukt, Krydder, Urter, Blomster, Eik/fat, Mineral
  4. Generic structure terms have lower category weights than specific descriptors
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Create categories module with hierarchy and validation script
- [x] 02-02-PLAN.md — Migrate lemmatizeAndWeight.ts to use new categories

### Phase 3: Weight Profile System
**Goal**: Three switchable weight profiles available for different scoring strategies
**Depends on**: Phase 2 (profiles depend on category structure)
**Requirements**: WGHT-01, WGHT-02, WGHT-03, WGHT-04, WGHT-05
**Success Criteria** (what must be TRUE):
  1. Configuration file or mechanism exists to switch between three profiles
  2. Inverted profile configured with specific notes 2.0-2.5, generic terms 0.8-1.2
  3. Moderate profile configured with specific notes 1.8-2.2, generic terms 1.0-1.5
  4. Data-driven profile configured with weights based on database frequency analysis
  5. Switching profiles requires minimal effort (single config change or environment variable)
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Create profiles module with typed weights and env-based selection

### Phase 4: Quality Assurance
**Goal**: Localhost and server environments both work correctly with new scoring
**Depends on**: Phase 3 (need new scoring system to test)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Local environment uses Xenova embeddings without errors
  2. Server environment uses OpenAI embeddings without errors
  3. Both environments can switch between localhost/server modes correctly
  4. Existing API signatures unchanged (no breaking changes for consumers)
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Set up Vitest, write unit tests for lemmatization and profiles
- [ ] 04-02-PLAN.md — Integration tests for localhost/server split, migration script

### Phase 5: Validation
**Goal**: Scoring improvements verified through before/after comparison
**Depends on**: Phase 4 (need working system to validate)
**Requirements**: VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Test cases created with known note pairs showing expected behavior
  2. Before/after scores documented showing specific notes now score higher
  3. Manual testing in app confirms scoring rewards tasting skill appropriately
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Analysis | 2/2 | Complete | 2026-02-02 |
| 2. Category Restructuring | 2/2 | Complete | 2026-02-03 |
| 3. Weight Profile System | 1/1 | Complete | 2026-02-06 |
| 4. Quality Assurance | 0/2 | Not started | - |
| 5. Validation | 0/0 | Not started | - |
