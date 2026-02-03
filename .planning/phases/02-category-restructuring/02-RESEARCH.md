# Phase 2: Category Restructuring - Research

**Researched:** 2026-02-03
**Domain:** Taxonomy restructuring, wine vocabulary classification, hierarchical category systems
**Confidence:** MEDIUM-HIGH

## Summary

This phase restructures wine tasting vocabulary categories to align with Vinmonopolet-inspired tasting wheel hierarchy. Research focused on understanding wine aroma wheel structures, taxonomy design patterns, abstraction hierarchies, and safe data migration strategies.

Wine aroma wheels consistently use 2-3 level hierarchies moving from generic categories (Frukt, Krydder) to specific descriptors (bringebær, kanel). The Ann Noble wine aroma wheel established the standard: 119 terms in three tiers, with 11 categories at the center for generic families. Cognitive research confirms that hierarchical taxonomies should place generic/abstract terms at higher levels and concrete/specific terms at lower levels, matching how humans process categories.

For TypeScript implementation, the current flat WineCategory union type should be replaced with a hierarchical structure using nested Record types. The user has decided on a "clean replacement" migration strategy - build parallel structure, validate it, then swap completely (no backwards-compatibility). TypeScript 5.8 (Feb 2025) provides excellent support for recursive types and nested hierarchies.

**Primary recommendation:** Implement 2-level hierarchy (6 main categories + specific subcategories) using TypeScript const objects with "as const" assertions, validate against Phase 1 vocabulary data (49,067 wines), then replace old categories atomically.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x+ | Type-safe category structure | Native support for const assertions, recursive types (5.8+) |
| Node.js | 18+ LTS | Script execution for validation | Established in Phase 1 for tsx scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | Latest | TypeScript execution | Already used for Phase 1 analysis scripts |
| Zod | 3.x | Runtime validation | If category structure needs runtime schema validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeScript const objects | JSON files | JSON lacks type safety, harder to refactor, no compile-time checks |
| Flat union types | Class hierarchy | Classes add runtime overhead, overkill for data structure |
| Manual validation | Automated tests | Manual validation error-prone, doesn't scale |

**Installation:**
```bash
# Already installed (Phase 1):
# - tsx for TypeScript execution
# - TypeScript compiler

# Optional (if runtime validation needed):
npm install zod
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── lemmatizeAndWeight.ts     # Update: New category structure
│   └── categories/                # New: Separate category module
│       ├── types.ts               # Category type definitions
│       ├── hierarchy.ts           # Category hierarchy data
│       └── index.ts               # Public exports
└── scripts/
    └── validate-categories.ts     # New: Validation script
```

### Pattern 1: Two-Level Hierarchical Taxonomy

**What:** Main categories (6) contain subcategories (15-25 total), each term belongs to exactly one subcategory
**When to use:** Wine vocabulary classification with inspiration from standardized wheels
**Example:**
```typescript
// Source: Wine aroma wheel structure (Ann Noble, UC Davis)
// Adapted from research on hierarchical taxonomies

type MainCategory = 'Frukt' | 'Krydder' | 'Urter' | 'Blomster' | 'Eik/fat' | 'Mineral';

type FruktSubcategory = 'bær' | 'sitrus' | 'steinfrukt' | 'tropisk' | 'tørket' | 'annet';
type KrydderSubcategory = 'søt' | 'varm' | 'annet';
type UrterSubcategory = 'grønn' | 'tørket' | 'annet';
type BlomsterSubcategory = 'hvit' | 'rød' | 'annet';
type EikSubcategory = 'fatlagring' | 'ristet' | 'annet';
type MineralSubcategory = 'stein' | 'salt' | 'annet';

type WineSubcategory =
  | FruktSubcategory
  | KrydderSubcategory
  | UrterSubcategory
  | BlomsterSubcategory
  | EikSubcategory
  | MineralSubcategory;

interface CategoryHierarchy {
  main: MainCategory;
  sub: WineSubcategory;
}

// Category structure with const assertion for immutability
const CATEGORY_TREE = {
  Frukt: {
    bær: ['solbær', 'bjørnebær', 'blåbær', 'bringebær', 'jordbær', 'kirsebær'],
    sitrus: ['sitron', 'lime', 'grapefrukt'],
    steinfrukt: ['plomme', 'fersken', 'aprikos'],
    tropisk: ['mango', 'ananas', 'melon'],
    tørket: ['sviske', 'fiken', 'daddel', 'rosin'],
    annet: ['eple', 'pære']
  },
  Krydder: {
    søt: ['vanilje', 'kanel'],
    varm: ['pepper', 'nellik'],
    annet: ['anis', 'lakris']
  },
  // ... other main categories
} as const;
```

### Pattern 2: Abstraction-Based Generic Classification

**What:** Classify terms as generic (abstract qualities) vs specific (concrete items) using abstraction level
**When to use:** Determining category weights for scoring system
**Example:**
```typescript
// Source: Cognitive research on abstraction hierarchies
// Reference: "On abstraction: decoupling conceptual concreteness and categorical specificity" (2020)

interface LemmaData {
  lemma: string;
  weight: number;
  category: CategoryHierarchy;
  abstraction: 'generic' | 'specific';
}

// Classification rules:
// GENERIC (low weight ~0.8-1.0): Abstract qualities
const GENERIC_PATTERNS = {
  // Abstract qualities: fruktig, krydret, blomstrete
  adjectives: ['fruktig', 'krydret', 'blomstrete', 'urtete'],
  // Wine structure: tannin, syre, alkohol, fylde
  structure: ['tannin', 'syre', 'alkohol', 'fylde', 'struktur'],
  // Intensity modifiers: hint av, mye, kraftig
  modifiers: ['hint', 'mye', 'kraftig', 'lett', 'intens']
};

// SPECIFIC (higher weight 1.3-1.8): Concrete items
const SPECIFIC_PATTERNS = {
  // Concrete items: eple, kanel, bringbær
  nouns: ['eple', 'kanel', 'bringbær', 'vanilje', 'fiol']
};
```

### Pattern 3: Parallel Build-Validate-Swap Migration

**What:** Build new structure alongside old, validate thoroughly, then atomically replace
**When to use:** Refactoring core data structures with no backwards compatibility
**Example:**
```typescript
// Source: Data migration best practices 2026
// Reference: Multiple sources on parallel migration patterns

// Step 1: Build parallel structure
// File: src/lib/categories/hierarchy.ts (NEW)
export const CATEGORY_HIERARCHY_V2 = { /* new structure */ };

// Step 2: Validation script
// File: scripts/validate-categories.ts (NEW)
async function validateCategoryMigration() {
  // Load Phase 1 vocabulary data
  const vocabData = await loadVocabularyAnalysis();

  // Check every term can be classified
  const unclassifiedTerms = findUnclassifiedTerms(vocabData, CATEGORY_HIERARCHY_V2);

  // Verify no duplicate terms across categories
  const duplicates = findDuplicateTerms(CATEGORY_HIERARCHY_V2);

  // Validate berry merge (mørke bær + røde bær → bær)
  const berryTerms = validateBerryMerge(CATEGORY_HIERARCHY_V2);

  return { unclassifiedTerms, duplicates, berryTerms };
}

// Step 3: Atomic swap (after validation passes)
// File: src/lib/lemmatizeAndWeight.ts (REPLACE)
// Delete old WineCategory type and norwegianLemmas
// Import from new categories module
import { CATEGORY_HIERARCHY, CategoryHierarchy } from './categories';
```

### Anti-Patterns to Avoid

- **Gradual migration with backwards-compatibility aliases:** User decided on clean replacement - avoid complexity of maintaining two systems
- **In-place modification:** Build parallel structure to allow validation before commitment
- **Hand-rolled hierarchy traversal:** Use TypeScript's type system to enforce correct category paths at compile time
- **Runtime category lookups without caching:** Pre-compute category mappings in const objects with "as const"
- **Multi-category membership:** User decided each term belongs to exactly ONE category - no overlapping

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Levenshtein distance | Custom string similarity | Existing levenshteinDistance() from Phase 1 | Already implemented, tested with 239 typo detections |
| TypeScript recursive types | Custom type guards | Native TypeScript 5.8 recursive types | Language-level support, better inference since Feb 2025 |
| Immutability | Deep cloning functions | TypeScript "as const" assertions | Zero runtime cost, compile-time enforcement |
| Validation framework | Custom validators | Validation script pattern from Phase 1 | Proven approach: query DB, analyze, report |

**Key insight:** TypeScript's type system is powerful enough to enforce category hierarchy constraints at compile time. Don't create runtime validation where types can prevent errors before deployment.

## Common Pitfalls

### Pitfall 1: Category Weight Assignment Without Validation

**What goes wrong:** Assigning weights to new categories without testing against real vocabulary data leads to poor similarity scoring
**Why it happens:** Easy to assume weights based on intuition rather than data distribution
**How to avoid:**
1. Use Phase 1 vocabulary data (49,067 wines analyzed) as validation set
2. Check frequency distribution of terms in each category
3. High-frequency categories need careful weight tuning
4. Generic terms (structure, modifiers) should have lower weights than specific descriptors per user decisions
**Warning signs:** Similarity scores dominated by generic terms, specific descriptors not influencing results

### Pitfall 2: Breaking Changes Without Migration Path

**What goes wrong:** Changing category structure breaks existing code that references old categories
**Why it happens:** Flat union types appear in multiple files, easy to miss references
**How to avoid:**
1. Use TypeScript compiler to find all references: `tsc --noEmit` will catch type errors
2. Search codebase for string literals matching old categories: `grep -r "'mørke bær'" src/`
3. Run full test suite after migration (if tests exist)
4. Consider adding validation script that checks for old category references
**Warning signs:** Runtime errors mentioning category names, TypeScript compilation errors

### Pitfall 3: Berry Merge Losing Specificity

**What goes wrong:** Merging "mørke bær" and "røde bær" into unified "bær" subcategory loses distinction between dark/red berries
**Why it happens:** User requirement to merge categories conflicts with specificity preservation
**How to avoid:**
1. Create "bær" as subcategory under Frukt (not remove dark/red distinction entirely)
2. Keep individual berry terms (solbær, bringebær) with same weights
3. Use subcategory name "bær" to group, not to replace specific terms
4. Document that "bær" category encompasses both dark and red berries
**Warning signs:** Loss of 7-8 specific berry terms from dictionary, similarity scores treating all berries identically

### Pitfall 4: Generic Term Weight Too High

**What goes wrong:** Generic structure terms (tannin, syre, struktur) dominate similarity calculations, making specific descriptors irrelevant
**Why it happens:** Structure terms appear frequently, default to higher weights by frequency
**How to avoid:**
1. User decided: structure terms = generic = low weight (0.8-1.0 range)
2. Specific descriptors (eple, kanel) = higher weight (1.3-1.8 range)
3. Abstract qualities (fruktig, krydret) = generic = low weight
4. Validate weight distribution produces reasonable similarity scores
**Warning signs:** All wines with "struktur" score highly similar regardless of specific descriptors

### Pitfall 5: Missing Terms from Phase 1 Analysis

**What goes wrong:** Phase 1 identified 1,559 missing terms (bær: 23,271 occurrences, aroma: 18,477) - if not handled, restructure won't improve coverage
**Why it happens:** Focus on category restructure makes it easy to forget missing term addition
**How to avoid:**
1. User decided: Adding missing terms is SEPARATE from this phase (Phase 2 is category restructure only)
2. Document that coverage remains ~4.49% after restructure
3. Plan subsequent phase for adding high-frequency missing terms
4. Restructure creates proper categories for NEW terms to be added later
**Warning signs:** Expectation that restructure will improve coverage (it won't - that's the next phase)

### Pitfall 6: Vinmonopolet Alignment Confusion

**What goes wrong:** Treating "inspired by" as "strict match" leads to over-constraining category design
**Why it happens:** Natural tendency to follow authoritative source exactly
**How to avoid:**
1. User decided: "Inspired by" not strict match
2. Vinmonopolet wheel provides main category structure (6 main categories)
3. Subcategories and term placement: Claude's discretion
4. Create "annet" subcategory in each main category for terms not on official wheel
5. Prioritize Norwegian wine vocabulary reality over theoretical wheel structure
**Warning signs:** Struggling to fit terms into rigid structure, rejecting valid Norwegian terms because wheel doesn't include them

## Code Examples

Verified patterns from research and analysis:

### Category Hierarchy Definition

```typescript
// Source: Wine aroma wheel structure (Ann Noble, UC Davis)
// Type-safe hierarchy with const assertion

export const WINE_CATEGORIES = {
  Frukt: {
    bær: {
      terms: ['solbær', 'bjørnebær', 'blåbær', 'morell', 'bringebær', 'jordbær', 'kirsebær', 'rips'],
      weight: 1.6 // Average of old mørke bær (1.7) and røde bær (1.5)
    },
    sitrus: {
      terms: ['sitrus', 'sitron', 'lime', 'grapefrukt'],
      weight: 1.5
    },
    steinfrukt: {
      terms: ['plomme', 'fersken', 'aprikos'],
      weight: 1.5
    },
    tropisk: {
      terms: ['tropisk', 'mango', 'ananas', 'melon'],
      weight: 1.4
    },
    tørket: {
      terms: ['tørket', 'moden', 'sviske', 'fiken', 'daddel', 'rosin'],
      weight: 1.6
    },
    annet: {
      terms: ['eple', 'pære'],
      weight: 1.4
    }
  },
  Krydder: {
    søt: {
      terms: ['vanilje', 'kanel'],
      weight: 1.7
    },
    varm: {
      terms: ['pepper', 'nellik'],
      weight: 1.7
    },
    annet: {
      terms: ['krydder', 'anis'],
      weight: 1.7
    }
  },
  Urter: {
    grønn: {
      terms: ['gress', 'urter', 'timian', 'rosmarin', 'laurbær', 'salvie'],
      weight: 1.3
    },
    annet: {
      terms: ['mynte', 'eukalyptus'],
      weight: 1.3
    }
  },
  Blomster: {
    annet: {
      terms: ['blomster', 'rose', 'fiol'],
      weight: 1.3
    }
  },
  'Eik/fat': {
    fatlagring: {
      terms: ['eik', 'fat', 'fatpreg', 'fatlagret'],
      weight: 1.8
    },
    ristet: {
      terms: ['toast', 'ristet', 'vanilje'],
      weight: 1.8
    },
    annet: {
      terms: [],
      weight: 1.8
    }
  },
  Mineral: {
    stein: {
      terms: ['mineralsk', 'mineralitet', 'mineraler', 'stein', 'steinet', 'flint'],
      weight: 1.5
    },
    annet: {
      terms: [],
      weight: 1.5
    }
  }
} as const;

// Generic structure terms (low weight, separate handling)
export const GENERIC_STRUCTURE_TERMS = {
  structure: {
    terms: ['struktur', 'balanse', 'tannin', 'snerp'],
    weight: 0.8
  },
  quality: {
    terms: ['konsentrasjon', 'dybde', 'kompleks', 'sammensatt', 'elegant'],
    weight: 0.8
  },
  finish: {
    terms: ['ettersmak', 'avslutning', 'finish', 'lang', 'lengde'],
    weight: 0.8
  },
  body: {
    terms: ['fylde', 'fyldig', 'kropp', 'rik', 'intens'],
    weight: 0.8
  },
  acidity: {
    terms: ['friskhet', 'frisk', 'syre', 'syrlig', 'saftig'],
    weight: 0.8
  },
  sweetness: {
    terms: ['sødme', 'søt', 'tørr', 'halvtørr'],
    weight: 0.8
  },
  texture: {
    terms: ['myk', 'rund', 'bløt', 'silkemyk', 'kremaktig', 'fast'],
    weight: 0.8
  }
} as const;

// Type extraction
type MainCategory = keyof typeof WINE_CATEGORIES;
type WineCategory = {
  [K in MainCategory]: keyof typeof WINE_CATEGORIES[K]
}[MainCategory];
```

### Validation Script Pattern

```typescript
// Source: Phase 1 analysis script pattern
// File: scripts/validate-categories.ts

import { norwegianLemmas } from '../src/lib/lemmatizeAndWeight';
import { WINE_CATEGORIES, GENERIC_STRUCTURE_TERMS } from '../src/lib/categories';
import { readFile } from 'fs/promises';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalTerms: number;
    categorizedTerms: number;
    uncategorizedTerms: number;
    duplicates: number;
  };
}

async function validateCategories(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load Phase 1 vocabulary data
  const vocabData = JSON.parse(
    await readFile('wine-vocabulary-analysis.json', 'utf-8')
  );

  // Build flat map of all terms in new structure
  const newTerms = new Map<string, string>(); // term -> category path

  for (const [mainCat, subcats] of Object.entries(WINE_CATEGORIES)) {
    for (const [subCat, data] of Object.entries(subcats)) {
      for (const term of data.terms) {
        const path = `${mainCat}/${subCat}`;
        if (newTerms.has(term)) {
          errors.push(`Duplicate term "${term}" in ${path} and ${newTerms.get(term)}`);
        }
        newTerms.set(term, path);
      }
    }
  }

  // Add generic structure terms
  for (const [cat, data] of Object.entries(GENERIC_STRUCTURE_TERMS)) {
    for (const term of data.terms) {
      if (newTerms.has(term)) {
        errors.push(`Duplicate term "${term}" in GENERIC and ${newTerms.get(term)}`);
      }
      newTerms.set(term, `GENERIC/${cat}`);
    }
  }

  // Check all old lemmas have new categories
  let uncategorized = 0;
  for (const [word, data] of Object.entries(norwegianLemmas)) {
    if (!newTerms.has(data.lemma) && !newTerms.has(word)) {
      warnings.push(`Term "${word}" (lemma: ${data.lemma}) not in new structure`);
      uncategorized++;
    }
  }

  // Verify berry merge
  const berryTerms = ['solbær', 'bjørnebær', 'blåbær', 'morell', 'bringebær', 'jordbær', 'kirsebær', 'rips'];
  const berryCategory = WINE_CATEGORIES.Frukt.bær.terms;
  const missingBerries = berryTerms.filter(b => !berryCategory.includes(b));
  if (missingBerries.length > 0) {
    errors.push(`Berry merge incomplete: missing ${missingBerries.join(', ')}`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalTerms: Object.keys(norwegianLemmas).length,
      categorizedTerms: newTerms.size,
      uncategorizedTerms: uncategorized,
      duplicates: errors.filter(e => e.startsWith('Duplicate')).length
    }
  };
}

// Run validation
validateCategories().then(result => {
  console.log('\n=== Category Validation Results ===\n');
  console.log(`Status: ${result.success ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`\nStats:`);
  console.log(`  Total terms in old structure: ${result.stats.totalTerms}`);
  console.log(`  Terms in new structure: ${result.stats.categorizedTerms}`);
  console.log(`  Uncategorized terms: ${result.stats.uncategorizedTerms}`);
  console.log(`  Duplicate terms: ${result.stats.duplicates}`);

  if (result.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    result.errors.forEach(e => console.log(`  ✗ ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    result.warnings.slice(0, 10).forEach(w => console.log(`  ⚠ ${w}`));
    if (result.warnings.length > 10) {
      console.log(`  ... and ${result.warnings.length - 10} more`);
    }
  }

  process.exit(result.success ? 0 : 1);
});
```

### Type-Safe Category Migration

```typescript
// Source: TypeScript 5.8 recursive types
// Type-safe migration from flat to hierarchical

// OLD (to be replaced):
type WineCategory = 'struktur' | 'mørke bær' | 'røde bær' | 'sitrus' | /* ... */;

interface LemmaData {
  lemma: string;
  weight: number;
  category: WineCategory;
}

// NEW (hierarchical):
interface CategoryPath {
  main: MainCategory;
  sub: WineSubcategory;
}

interface LemmaDataV2 {
  lemma: string;
  weight: number;
  category: CategoryPath;
  abstraction: 'generic' | 'specific';
}

// Migration helper
function migrateLemmaData(old: LemmaData): LemmaDataV2 {
  // Map old categories to new paths
  const categoryMap: Record<string, CategoryPath> = {
    'mørke bær': { main: 'Frukt', sub: 'bær' },
    'røde bær': { main: 'Frukt', sub: 'bær' },
    'sitrus': { main: 'Frukt', sub: 'sitrus' },
    'steinfrukt': { main: 'Frukt', sub: 'steinfrukt' },
    'frukt': { main: 'Frukt', sub: 'annet' },
    'krydder': { main: 'Krydder', sub: 'annet' },
    'eik': { main: 'Eik/fat', sub: 'fatlagring' },
    'mineral': { main: 'Mineral', sub: 'stein' },
    'blomst': { main: 'Blomster', sub: 'annet' },
    'urt': { main: 'Urter', sub: 'grønn' },
    // Generic structure terms
    'struktur': { main: 'GENERIC', sub: 'structure' },
    'kvalitet': { main: 'GENERIC', sub: 'quality' },
    'ettersmak': { main: 'GENERIC', sub: 'finish' },
    'fylde': { main: 'GENERIC', sub: 'body' },
    'friskhet': { main: 'GENERIC', sub: 'acidity' },
    'sødme': { main: 'GENERIC', sub: 'sweetness' },
    'tekstur': { main: 'GENERIC', sub: 'texture' },
  };

  const newCategory = categoryMap[old.category];
  if (!newCategory) {
    throw new Error(`No mapping for category: ${old.category}`);
  }

  // Determine abstraction level
  const genericCategories = new Set(['struktur', 'kvalitet', 'ettersmak', 'fylde', 'friskhet', 'sødme', 'tekstur', 'generell']);
  const abstraction = genericCategories.has(old.category) ? 'generic' : 'specific';

  return {
    lemma: old.lemma,
    weight: old.weight,
    category: newCategory,
    abstraction
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat union type categories | Hierarchical category structure | TypeScript 5.8 (Feb 2025) | Better type inference for recursive types, more expressive |
| Runtime category validation | Compile-time type checking with "as const" | TypeScript 3.4+ | Zero runtime cost, catch errors before deployment |
| Manual data migration | Parallel build-validate-swap pattern | 2026 best practices | Safer migrations, validate before committing |
| Separate mørke bær/røde bær | Unified bær subcategory | Phase 2 requirement | Aligns with Vinmonopolet structure, simplifies categorization |

**Deprecated/outdated:**
- WineCategory flat union type: Being replaced with CategoryPath hierarchy
- Old category names: 'mørke bær', 'røde bær' merge into 'bær' under Frukt
- High weight for structure terms: User decided structure = generic = low weight

## Open Questions

Things that couldn't be fully resolved:

1. **Exact Vinmonopolet wheel structure**
   - What we know: 6 main categories confirmed (Frukt, Krydder, Urter, Blomster, Eik/fat, Mineral), uses Norwegian names
   - What's unclear: Exact subcategory structure of official Vinmonopolet aromahjul not publicly documented in detail
   - Recommendation: Use "inspired by" approach - main categories from Vinmonopolet, subcategories based on Norwegian wine vocabulary reality (Phase 1 data)

2. **Generic term placement strategy**
   - What we know: User decided abstraction-based classification (abstract = generic, concrete = specific), structure terms should have lower weights
   - What's unclear: Should generic terms go in same categories flagged as "generic", or separate GENERIC pseudo-category?
   - Recommendation: Create separate GENERIC_STRUCTURE_TERMS const to clearly distinguish from specific descriptors, prevents confusion with Frukt/Krydder terms

3. **Berry term weight after merge**
   - What we know: Old "mørke bær" had weight 1.7, "røde bær" had weight 1.5, merging into unified "bær" subcategory
   - What's unclear: Should all berry terms now have same weight, or maintain dark berry (1.7) vs red berry (1.5) distinction?
   - Recommendation: Use average weight 1.6 for unified bær subcategory, maintains balance without complexity of tracking dark/red distinction

4. **Adding missing terms from Phase 1**
   - What we know: Phase 1 identified 1,559 missing terms (bær: 23,271 occurrences), user decided this is SEPARATE from Phase 2
   - What's unclear: When/how will missing terms be added? Phase 3?
   - Recommendation: Document that restructure creates proper category framework, plan separate phase for bulk term addition using wine-vocabulary-analysis.json

5. **Typo fixes in restructure**
   - What we know: Phase 1 identified 239 typos (krydret→krydrete: 2,428 occurrences), user decided to include typo fixes IN this restructure
   - What's unclear: How to distinguish valid variant spellings vs actual typos? (e.g., "hint" with 11,250 occurrences)
   - Recommendation: Fix clear typos (krydret→krydrete), keep high-frequency "typos" as separate review (hint, modent), validate against linguistic norms

## Sources

### Primary (HIGH confidence)
- Wine Folly Wine Aroma Wheel (100+ flavors, 4-level hierarchy): https://winefolly.com/tips/wine-aroma-wheel-100-flavors/
- Winemakers Research Exchange (Ann Noble wheel, 119 terms in 3 tiers): https://winemakersresearchexchange.com/library/post-fermentation-and-aging/the-wine-aroma-wheel
- TypeScript 5.8 Recursive Types documentation (Feb 2025): https://www.freecodecamp.org/news/recursive-types-in-typescript-a-brief-exploration/
- TypeScript Const Assertions (Jan 2026): https://oneuptime.com/blog/post/2026-01-30-typescript-const-assertions/view
- Phase 1 Verification Report (49,067 wines analyzed, 4.49% coverage): .planning/phases/01-data-analysis/01-VERIFICATION.md

### Secondary (MEDIUM confidence)
- Wine Structure Terms research: https://winefolly.com/deep-dive/wine-characteristics/
- Data Migration Best Practices 2026: https://medium.com/@kanerika/data-migration-best-practices-your-ultimate-guide-for-2026-7cbd5594d92e
- Cognitive research on abstraction hierarchies: https://link.springer.com/article/10.1007/s10339-020-00965-9
- Norwegian wine vocabulary examples: https://www.unitedwinegroup.no/selskaper/nordic-wine

### Tertiary (LOW confidence)
- Vinmonopolet aromahjul product page (no detailed structure visible): https://www.vinskap.no/products/aromahjul-for-vin--norsk
- SoundCloud podcast about aromahjul (audio only, not analyzed): https://soundcloud.com/vinmonopolet/aromahjulet-en-lur-oppfinnelse

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeScript 5.8 features well-documented, tsx established in Phase 1
- Architecture: MEDIUM-HIGH - Wine wheel structure researched from multiple sources, some Vinmonopolet specifics unclear
- Pitfalls: HIGH - Based on real data from Phase 1 (49K wines), common refactoring issues well-documented
- Migration patterns: HIGH - 2026 best practices from multiple sources confirm parallel build-validate-swap
- Category weights: MEDIUM - Abstraction research solid, but specific weight values need validation against real similarity calculations

**Research date:** 2026-02-03
**Valid until:** 60 days (stable domain - wine classification doesn't change rapidly)

**Key research gaps:**
1. Exact Vinmonopolet aromahjul structure not publicly detailed - using "inspired by" approach
2. Subcategory naming conventions under Claude's discretion - following Norwegian wine vocabulary patterns
3. Weight validation needs testing with real similarity calculations - recommendations based on abstraction theory

**Mitigation:**
- Gap 1: Use Phase 1 vocabulary data (49K wines) as ground truth for Norwegian usage
- Gap 2: Follow established wine wheel patterns (Ann Noble), adapt to Norwegian context
- Gap 3: Create validation script to test category structure before committing migration
