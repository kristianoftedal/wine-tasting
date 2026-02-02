# Phase 2: Category Restructuring - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure tasting note categories to align with Vinmonopolet's official tasting wheel hierarchy. Establish six main categories with appropriate subcategories. Ensure generic structure terms have lower category weights than specific descriptors. Does NOT include adding missing terms from Phase 1 (handled separately).

</domain>

<decisions>
## Implementation Decisions

### Category hierarchy
- Nesting depth: Claude's discretion (based on Vinmonopolet structure)
- Each term belongs to exactly ONE category (no multi-category membership)
- Berry terms structure under frukt: Claude's discretion
- Generic terms (like 'fruktig') placement: Claude's discretion

### Term classification
- Classification model: Abstraction-based
  - Abstract qualities (fruktig, krydret) = generic
  - Concrete items (eple, kanel, bringbær) = specific
- Wine structure terms (tannin, syre, alkohol) = generic (low weight)
- Grape variety names (cabernet, pinot) = exclude from scoring entirely
- Intensity modifiers (hint av, mye, kraftig) = ignore for scoring

### Vinmonopolet alignment
- Alignment level: Inspired by (not strict match)
- Use Norwegian category names everywhere (Frukt, not Fruit)
- Terms not on Vinmonopolet wheel: create 'annet' subcategory per main category
- Six main categories: Frukt, Krydder, Urter, Blomster, Eik/fat, Mineral
- Color terms (rubin, gyllen): excluded from aroma/taste categories, handled separately

### Migration strategy
- Clean replacement: delete old categories entirely, no backwards-compat aliases
- Build parallel structure, validate, then swap (not in-place modification)
- Adding missing terms from Phase 1: keep separate (not this phase)
- Fixing typos from Phase 1: include in this restructure

### Claude's Discretion
- Exact nesting depth (2 or 3 levels) based on Vinmonopolet structure
- Berry terms placement within frukt hierarchy
- How to place generic terms (same category flagged, or separate handling)

</decisions>

<specifics>
## Specific Ideas

- Norwegian naming throughout: "Frukt" not "Fruit", "Krydder" not "Spices"
- Each main category should have an 'annet' subcategory for terms not on the official wheel
- Abstraction determines genericity: "fruktig" is abstract/generic, "bringbær" is concrete/specific

</specifics>

<deferred>
## Deferred Ideas

- Adding missing terms from Phase 1 analysis — handle after restructure
- Color term scoring — excluded from aroma/taste categories for now

</deferred>

---

*Phase: 02-category-restructuring*
*Context gathered: 2026-02-02*
