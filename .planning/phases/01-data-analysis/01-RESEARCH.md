# Phase 1: Data Analysis - Research

**Researched:** 2026-02-02
**Domain:** Database text analysis with TypeScript/Node.js
**Confidence:** HIGH

## Summary

This phase involves extracting and analyzing Norwegian wine tasting vocabulary from the Supabase wines table to inform lemma dictionary improvements. The standard approach is to create a standalone TypeScript script using modern tooling (tsx for execution), query all wine records via Supabase's JavaScript client with pagination, perform frequency analysis using TypeScript Map data structures, and export findings to JSON/CSV for review.

The research confirms that TypeScript's built-in Map provides optimal performance for frequency counting, Supabase requires pagination for datasets over 1,000 rows, and Norwegian UTF-8 characters (æ, ø, å) are natively supported in modern TypeScript/Node.js environments. The biggest pitfall is forgetting to use `.order()` with `.range()` queries, which causes unpredictable pagination results.

**Primary recommendation:** Use tsx to execute a standalone TypeScript script that queries Supabase with range-based pagination, analyzes text with Map-based frequency counters, and exports structured JSON results for human review.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.84.0 | Database queries | Already in project, official Supabase client for JavaScript/TypeScript |
| tsx | Latest | TypeScript execution | 5-10x faster than ts-node, modern default for running TS scripts in 2026 |
| Node.js built-in Map | Native | Frequency counting | O(1) average lookup, built-in, no dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | 0.7.0 | Server-side auth | Already in project, handle auth if needed |
| fs/promises | Native | File export | Export JSON/CSV results to filesystem |
| TextEncoder/TextDecoder | Native | UTF-8 handling | Process Norwegian characters (æ, ø, å) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsx | ts-node | ts-node is 5-10x slower but offers runtime type checking; IDEs already provide type checking in 2026 |
| Map | Record<string, number> | Record works but Map has guaranteed O(1) performance and safer iteration |
| Standalone script | Next.js API route | API routes add HTTP overhead for one-time analysis tasks |
| Supabase client | Raw SQL | Raw SQL more complex to setup, JS client provides type safety and abstraction |

**Installation:**
```bash
npm install --save-dev tsx
# All other dependencies already in project
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── analyze-wine-vocabulary.ts    # Main analysis script
└── utils/
    ├── supabase-client.ts        # Reusable Supabase client
    └── text-analysis.ts          # Frequency analysis utilities
```

### Pattern 1: Paginated Data Fetching
**What:** Fetch all rows from Supabase using range-based pagination with explicit ordering
**When to use:** When querying tables with more than 1,000 rows (Supabase default limit)
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/range
// Source: https://mulungood.com/supabase-all-rows-pagination

async function fetchAllWines(supabase: SupabaseClient) {
  const wines: Wine[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error } = await supabase
      .from('wines')
      .select('id, name, smell, taste, color')
      .order('id') // CRITICAL: Must use .order() with .range()
      .range(start, end);

    if (error) throw error;

    if (data && data.length > 0) {
      wines.push(...data);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return wines;
}
```

### Pattern 2: Map-Based Frequency Counter
**What:** Use TypeScript Map for efficient frequency counting with O(1) average lookup
**When to use:** Analyzing term frequency in text data
**Example:**
```typescript
// Source: https://codesignal.com/learn/courses/typescript-map-in-practice-revision-and-application/lessons/using-maps-in-typescript-for-efficient-element-counting
// Source: https://naviava.hashnode.dev/frequency-counter-in-typescript

function analyzeFrequency(texts: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const text of texts) {
    if (!text) continue;

    // Tokenize: lowercase, remove punctuation, split on whitespace
    const words = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    for (const word of words) {
      // Efficient increment pattern
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return frequency;
}

// Sort by frequency
function sortByFrequency(freq: Map<string, number>): [string, number][] {
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1]);
}
```

### Pattern 3: Standalone Script Execution
**What:** Use tsx to execute TypeScript scripts without compilation step
**When to use:** One-time data analysis tasks, migrations, admin scripts
**Example:**
```typescript
// Source: https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/
// scripts/analyze-wine-vocabulary.ts

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';

async function main() {
  console.log('Starting wine vocabulary analysis...');

  // Analysis logic here
  const results = {
    totalWines: 0,
    smellTerms: new Map(),
    tasteTerms: new Map(),
    // ...
  };

  // Export results
  await writeFile(
    'analysis-results.json',
    JSON.stringify(Object.fromEntries(results.smellTerms), null, 2),
    'utf-8'
  );

  console.log('Analysis complete!');
}

main().catch(console.error);
```

```json
// package.json
{
  "scripts": {
    "analyze": "tsx scripts/analyze-wine-vocabulary.ts"
  }
}
```

### Pattern 4: Category-Based Frequency Analysis
**What:** Group frequency counts by semantic categories (existing lemma categories)
**When to use:** When analyzing domain-specific vocabulary with known categories
**Example:**
```typescript
type CategoryFrequency = {
  category: string;
  terms: Map<string, number>;
  total: number;
};

function analyzeByCategoryPattern(
  texts: string[],
  lemmas: Record<string, LemmaData>
): Map<string, CategoryFrequency> {
  const categoryFreqs = new Map<string, CategoryFrequency>();

  // Initialize categories from existing lemma dictionary
  for (const [word, data] of Object.entries(lemmas)) {
    if (!categoryFreqs.has(data.category)) {
      categoryFreqs.set(data.category, {
        category: data.category,
        terms: new Map(),
        total: 0
      });
    }
  }

  // Count terms by category
  for (const text of texts) {
    const words = tokenize(text);
    for (const word of words) {
      const lemmaData = lemmas[word];
      if (lemmaData) {
        const catFreq = categoryFreqs.get(lemmaData.category)!;
        catFreq.terms.set(word, (catFreq.terms.get(word) || 0) + 1);
        catFreq.total++;
      }
    }
  }

  return categoryFreqs;
}
```

### Anti-Patterns to Avoid
- **Fetching without .order():** Using `.range()` without explicit `.order()` causes unpredictable pagination results due to undefined database ordering
- **Using any type:** Disables TypeScript type checking; use explicit types or `unknown` instead
- **Nested loops for frequency:** O(n²) complexity; use Map for O(n) frequency counting
- **Loading all data at once:** Supabase limits to 1,000 rows by default; use pagination to avoid incomplete results
- **Ignoring Norwegian characters:** æ, ø, å are UTF-8 and work natively; don't apply special encoding transforms

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript execution | Custom ts compiler + node runner | tsx | 5-10x faster, handles ES modules, watch mode included |
| CSV export | Manual string concatenation | export-to-csv npm package | Handles escaping, quotes, newlines, BOM for Excel |
| Text normalization | Custom regex chains | Existing tokenization pattern | Punctuation removal regex is well-tested, covers edge cases |
| Frequency sorting | Custom sort algorithm | Array.from(map.entries()).sort() | Built-in, optimized, readable |
| UTF-8 encoding | Custom character mapping | Node.js native TextEncoder | Norwegian characters work natively in modern Node.js |

**Key insight:** Data analysis scripts benefit from using native JavaScript/TypeScript features (Map, Array methods) over external libraries. The ecosystem has matured to where built-in features handle most text processing needs efficiently.

## Common Pitfalls

### Pitfall 1: Pagination Without Ordering
**What goes wrong:** Using `.range()` without `.order()` returns inconsistent, unpredictable results across pagination requests
**Why it happens:** Databases don't guarantee row order without explicit ORDER BY clause; natural order is implementation-dependent
**How to avoid:** Always pair `.range(start, end)` with `.order('id')` or another stable column
**Warning signs:** Different results when running script multiple times, duplicate records across pages, missing records

### Pitfall 2: Map to JSON Conversion
**What goes wrong:** JSON.stringify() on Map returns empty object `{}`
**Why it happens:** Map is not a plain object; JSON.stringify doesn't know how to serialize it
**How to avoid:** Use `Object.fromEntries(map)` or `Array.from(map.entries())` before stringifying
**Warning signs:** Empty objects in exported JSON files despite populated Map

### Pitfall 3: Overusing `any` Type
**What goes wrong:** Type checking disabled, runtime errors from wrong types, no IDE autocomplete
**Why it happens:** Quick fix to silence TypeScript errors without understanding types
**How to avoid:** Use explicit types from src/lib/types.ts (Wine, LemmaData); use `unknown` if type truly unknown
**Warning signs:** No autocomplete, unexpected undefined/null errors at runtime

### Pitfall 4: Memory Issues with Large Datasets
**What goes wrong:** Script runs out of memory or hits Supabase rate limits
**Why it happens:** Loading all data into memory at once, not processing in batches
**How to avoid:** Process and aggregate data during fetching loop, don't store all raw records
**Warning signs:** "JavaScript heap out of memory" error, slow script execution, Supabase 429 errors

### Pitfall 5: Ignoring Stopwords
**What goes wrong:** Generic words ("og", "i", "en", "med") dominate frequency counts, obscuring meaningful terms
**Why it happens:** Analyzing all words without filtering common Norwegian stopwords
**How to avoid:** Reuse existing `stopwords` Set from src/lib/lemmatizeAndWeight.ts
**Warning signs:** Top frequency terms are articles/prepositions, not wine descriptors

### Pitfall 6: Case Sensitivity
**What goes wrong:** Same word counted separately ("Solbær" vs "solbær"), inflated unique term count
**Why it happens:** Not normalizing text to lowercase before frequency counting
**How to avoid:** Apply `.toLowerCase()` during tokenization, as shown in Pattern 2
**Warning signs:** Duplicate-looking terms in frequency results with different capitalization

## Code Examples

Verified patterns from official sources:

### Complete Analysis Script Structure
```typescript
// Source: Combined patterns from research
// scripts/analyze-wine-vocabulary.ts

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import type { Wine } from '../src/lib/types';
import { stopwords } from '../src/lib/lemmatizeAndWeight';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface AnalysisResults {
  totalWines: number;
  smellTermFrequency: [string, number][];
  tasteTermFrequency: [string, number][];
  colorTermFrequency: [string, number][];
  missingInLemmas: string[];
  typoSuggestions: { word: string; suggestion: string; count: number }[];
}

async function fetchAllWines() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const wines: Wine[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  console.log('Fetching wines from Supabase...');

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error } = await supabase
      .from('wines')
      .select('id, name, smell, taste, color')
      .order('id')
      .range(start, end);

    if (error) throw error;

    if (data && data.length > 0) {
      wines.push(...data);
      console.log(`Fetched page ${page + 1}: ${data.length} wines`);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total wines fetched: ${wines.length}`);
  return wines;
}

function tokenize(text: string | null): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word));
}

function analyzeFrequency(texts: (string | null)[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const text of texts) {
    const words = tokenize(text);
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return frequency;
}

async function main() {
  console.log('Starting wine vocabulary analysis...\n');

  const wines = await fetchAllWines();

  console.log('\nAnalyzing term frequencies...');
  const smellFreq = analyzeFrequency(wines.map(w => w.smell));
  const tasteFreq = analyzeFrequency(wines.map(w => w.taste));
  const colorFreq = analyzeFrequency(wines.map(w => w.color));

  const results: AnalysisResults = {
    totalWines: wines.length,
    smellTermFrequency: Array.from(smellFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100), // Top 100
    tasteTermFrequency: Array.from(tasteFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
    colorTermFrequency: Array.from(colorFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    missingInLemmas: [], // To be implemented in Phase 1 tasks
    typoSuggestions: []  // To be implemented in Phase 1 tasks
  };

  await writeFile(
    'wine-vocabulary-analysis.json',
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\nAnalysis complete!');
  console.log(`Results saved to wine-vocabulary-analysis.json`);
  console.log(`\nTop 10 smell terms:`);
  results.smellTermFrequency.slice(0, 10).forEach(([term, count]) => {
    console.log(`  ${term}: ${count}`);
  });
}

main().catch(console.error);
```

### Supabase Client Setup
```typescript
// Source: https://supabase.com/docs/reference/javascript/select
// scripts/utils/supabase-client.ts

import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node for scripts | tsx for scripts | 2024-2025 | 5-10x faster execution, better ES module support |
| Object/Record for frequency | Map for frequency | 2023+ | Guaranteed O(1) lookup, safer iteration, better memory |
| fetch() all at once | Paginated fetching | Always best practice | Prevents memory issues, respects API limits |
| Runtime type checking | IDE + tsc --noEmit | 2024+ | Separate concerns: fast execution + thorough type validation |
| Custom CSV generators | export-to-csv library | 2022+ | Handles edge cases, Excel compatibility (BOM) |

**Deprecated/outdated:**
- **ts-node without --transpile-only**: Slow compilation makes iteration painful; tsx is now standard
- **Object.keys() iteration over Map**: Maps iterate in insertion order reliably; Object key order only guaranteed for strings in spec
- **Setting charset in tsconfig.json**: Deprecated as of TypeScript 5.5 (January 2026); UTF-8 is always assumed

## Open Questions

Things that couldn't be fully resolved:

1. **Norwegian lemmatization libraries**
   - What we know: Limited JavaScript/TypeScript libraries exist; Python has better support (norlem-norwegian-lemmatizer)
   - What's unclear: Whether integrating Python lemmatizer worth complexity vs. manual dictionary approach
   - Recommendation: Continue with manual dictionary approach (existing pattern in codebase), only consider Python integration if analysis reveals thousands of missing terms

2. **Optimal frequency threshold for missing terms**
   - What we know: Common practice is to flag terms appearing 3+ times as potentially significant
   - What's unclear: Right threshold for wine vocabulary domain (high-frequency or low-frequency matters more)
   - Recommendation: Export all frequencies, let human review determine threshold based on actual data distribution

3. **Typo detection algorithm**
   - What we know: Edit distance (Levenshtein) commonly used, but computationally expensive for large vocabularies
   - What's unclear: Whether simple pattern matching (common Norwegian typos) sufficient vs. full edit distance
   - Recommendation: Start with pattern matching for known patterns (double letters, æ/ae confusion), only implement edit distance if needed

4. **Database table size**
   - What we know: Pagination needed for >1,000 rows
   - What's unclear: Actual number of wines in database
   - Recommendation: Script handles pagination regardless; monitor performance during execution

## Sources

### Primary (HIGH confidence)
- [Supabase JavaScript select() documentation](https://supabase.com/docs/reference/javascript/select) - Query patterns, default limits
- [Supabase range() documentation](https://supabase.com/docs/reference/javascript/range) - Pagination implementation, ordering requirement
- [tsx vs ts-node comparison - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/) - Execution speed benchmarks, 2026 best practices
- [TypeScript Map for frequency counting - CodeSignal](https://codesignal.com/learn/courses/typescript-map-in-practice-revision-and-application/lessons/using-maps-in-typescript-for-efficient-element-counting) - O(1) performance guarantees
- [Frequency counter algorithm - Learn with Nav](https://naviava.hashnode.dev/frequency-counter-in-typescript) - Implementation patterns
- [Supabase pagination guide - Mulungood](https://mulungood.com/supabase-all-rows-pagination) - fetchAllPaginatedResults pattern

### Secondary (MEDIUM confidence)
- [TypeScript Record vs Map performance - WebDevTutor](https://www.webdevtutor.net/blog/typescript-record-vs-map-performance) - Performance comparison
- [JavaScript Maps vs Sets 2026 guide - DEV Community](https://dev.to/cristiansifuentes/javascript-maps-vs-sets-a-scientific-production-minded-guide-2026-58j8) - Data structure selection
- [Running TypeScript scripts in Next.js - Ironeko](https://ironeko.com/posts/how-to-run-typescript-scripts-in-your-next-js-project) - Script execution patterns
- [Norwegian NLP resources - GitHub](https://github.com/web64/norwegian-nlp-resources) - Language-specific tools overview
- [Supabase performance tuning](https://supabase.com/docs/guides/platform/performance) - Memory and query optimization
- [Node.js TypeScript best practices - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/nodejs-typescript/) - Modern tooling recommendations

### Tertiary (LOW confidence)
- [Norwegian UTF-8 encoding issues - Various sources](https://groups.google.com/g/mailchimp-api-discuss/c/6NlT7YGbBoQ) - Historical issues, not applicable to modern Node.js
- [TypeScript common mistakes compilations](https://medium.com/@helleugilles/10-common-typescript-mistakes-and-how-to-avoid-them-6e4fe39788d0) - General guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tsx, Map, Supabase client are well-documented 2026 standards
- Architecture: HIGH - Pagination, frequency counting patterns verified from official docs
- Pitfalls: HIGH - Ordering requirement, Map serialization, stopwords are documented gotchas

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable technologies, unlikely to change)
