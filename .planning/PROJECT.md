# Wine Tasting Similarity Scoring Improvement

## What This Is

Improving the similarity scoring system for a Norwegian wine blind tasting app. The goal is to reward users for identifying specific tasting notes (like "kirsebær", "eik", "pepper") over generic structural terms (like "fylde", "friskhet", "struktur"). Categories should align with Vinmonopolet's official tasting wheels.

## Core Value

Specific tasting descriptors should contribute more to similarity scores than generic wine structure terms — rewarding actual tasting skill.

## Requirements

### Validated

- ✓ Lemma-based similarity scoring — existing (`lemmatizeAndWeight.ts`)
- ✓ Local semantic similarity with Xenova embeddings — existing (`localSemanticSimilarity.ts`)
- ✓ Server-side similarity with OpenAI fallback — existing (`similarity.ts`)
- ✓ Localhost/server environment split — existing
- ✓ Norwegian wine vocabulary with categories — existing

### Active

- [ ] Re-weight terms: lower weights for generic terms (struktur, avslutning, fylde, friskhet, sødme)
- [ ] Re-weight terms: higher weights for specific descriptors (fruit, spice, oak notes)
- [ ] Align categories with Vinmonopolet tasting wheels (aromahjul/smakshjul)
- [ ] Merge "bær" category into "frukt" category
- [ ] Fix typos in existing lemmas
- [ ] Query database to identify actual language patterns used in wine notes
- [ ] Create test cases comparing before/after scoring
- [ ] Maintain localhost/server split functionality

### Out of Scope

- Bonus point system for specific notes — deferred to later
- Changing the ML embedding model — current Xenova model is sufficient
- UI changes — scoring only

## Context

**Current weighting (problematic):**
- Generic terms weighted highest: struktur (2.5), avslutning (2.3), fylde (2.0), friskhet (2.0), sødme (1.8)
- Specific descriptors weighted lower: kirsebær (1.5), eik (1.8), pepper (1.7)

**Vinmonopolet tasting wheel categories:**
- Frukt: mørke bær (bjørnebær, blåbær, solbær), røde bær (kirsebær, bringebær, jordbær, rips), sitrus (sitron, grapefrukt, lime), steinfrukt (plomme, fersken, aprikos), tropisk, tørket frukt
- Krydder: pepper, nellik, kanel, anis
- Urter: timian, rosmarin, laurbær, salvie, mynte, basilikum
- Blomster: rose, fiol
- Eik/fat: vanilje, toast, ristet
- Mineral: stein, flint

**Data source:** Supabase database with `wines` table containing `smell` and `taste` text fields with real Norwegian tasting notes.

## Constraints

- **Tech stack**: Next.js, TypeScript, Supabase — no changes
- **Localhost compatibility**: Must work offline with local Xenova model
- **Server compatibility**: Must work with OpenAI embeddings when deployed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Invert weight hierarchy | Generic terms are easy to guess, specific notes show skill | — Pending |
| Merge bær into frukt | Aligns with Vinmonopolet's categorization | — Pending |
| Query actual database | Base lemmas on real language, not assumptions | — Pending |

---
*Last updated: 2026-02-02 after initialization*
