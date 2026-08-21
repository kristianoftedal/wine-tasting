'use server';

import { openai } from '@ai-sdk/openai';
import { embed, generateText, Output } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { expandFoodQuery } from '@/lib/food-synonyms';

export type FoodWineMatch = {
  id: string;
  product_id: string;
  name: string;
  year: string | null;
  main_category: string | null;
  main_country: string | null;
  district: string | null;
  price: number | null;
  matchedFood: string | null;
  matchedGrape: string | null;
  score: number;
};

export type FoodArticleCitation = {
  id: string;
  url: string;
  title: string;
  summary: string;
  food_tags: string[];
  occasion_tags: string[];
  similarity: number;
};

export type FoodPairingResult = {
  query: string;
  recommendation: string;
  categories: string[];
  grapes: string[];
  regions: string[];
  foodTerms: string[];
  themeTerms: string[];
  courseTerms: string[];
  wines: FoodWineMatch[];
  articles: FoodArticleCitation[];
};

const ExtractionSchema = z.object({
  recommendation: z
    .string()
    .describe('Én til to korte setninger på norsk om hva slags vin som passer.'),
  categories: z
    .array(z.string())
    .describe('Vinkategorier (Rødvin, Hvitvin, Rosévin, Musserende vin, etc.). Maks 3.'),
  grapes: z
    .array(z.string())
    .describe('Druesorter som anbefales, internasjonalt navn (f.eks. "Pinot Noir"). Maks 6.'),
  regions: z
    .array(z.string())
    .describe('Land eller vinregioner. Maks 5.'),
  sensory: z
    .object({
      fylde: z.enum(['lett', 'medium', 'fyldig']).nullable().describe('Vinens kropp/fylde. Sett null hvis artiklene ikke sier noe.'),
      friskhet: z.enum(['lav', 'medium', 'frisk']).nullable().describe('Syrlighet/friskhet. Null hvis ikke nevnt.'),
      garvestoff: z.enum(['lite', 'medium', 'mye']).nullable().describe('Garvestoff/tanniner (kun rødvin). Null hvis ikke nevnt.'),
      sodme: z.enum(['tørr', 'halvtørr', 'søt']).nullable().describe('Sødme. Null hvis ikke nevnt.'),
    })
    .describe('Sensoriske egenskaper artiklene anbefaler. Sett feltet til null hvis artiklene ikke beskriver det.'),
});

type SensoryAttr = 'fylde' | 'friskhet' | 'garvestoff' | 'sodme';
type Criteria = z.infer<typeof ExtractionSchema>;

// Maps the LLM's categorical labels to numeric ranges on the wines table's
// 0-12 sensory scale. Overlapping bands (4-5, 7-8) let "medium" stretch into
// the adjacent buckets so a wine on the boundary still scores.
const SENSORY_RANGES: Record<SensoryAttr, Record<string, [number, number]>> = {
  fylde:      { lett: [0, 5],  medium: [4, 9],  fyldig: [8, 12] },
  friskhet:   { lav:  [0, 5],  medium: [4, 9],  frisk:  [7, 12] },
  garvestoff: { lite: [0, 5],  medium: [4, 9],  mye:    [7, 12] },
  sodme:      { tørr: [0, 3],  halvtørr: [2, 6], søt:   [5, 12] },
};

const EMPTY_CRITERIA: Criteria = {
  recommendation: '',
  categories: [],
  grapes: [],
  regions: [],
  sensory: { fylde: null, friskhet: null, garvestoff: null, sodme: null },
};

type WineRaw = {
  id: string;
  product_id: string;
  name: string;
  year: string | null;
  main_category: string | null;
  main_country: string | null;
  district: string | null;
  price: string | null;
  is_good_for: string[] | null;
  search_text: string | null;
  fylde: number | null;
  friskhet: number | null;
  garvestoff: number | null;
  sodme: number | null;
};

const MIN_QUERY_LENGTH = 2;
const ARTICLE_MATCH_COUNT = 4;
const TAG_ARTICLE_LIMIT = 3;   // per tag channel; exact hits, so a small cap is enough
const ARTICLE_CONTENT_TRUNCATE = 700;
const WINE_LIMIT = 14;
const FOOD_QUERY_LIMIT = 150;
const GRAPE_QUERY_LIMIT = 20;
const WINE_COLUMNS = 'id, product_id, name, year, main_category, main_country, district, price, is_good_for, search_text, fylde, friskhet, garvestoff, sodme';

// Scoring weights (tune here to reorder results)
const W_FOOD_TERM = 3;       // per matched is_good_for term
const W_FOOD_SPECIFICITY = 2; // × (matched / total tags) — focused wines first
const W_GRAPE = 4;            // any grape matches
const W_CATEGORY = 2;         // main_category matches LLM rec
const W_REGION = 1;           // country/district matches LLM rec
const W_SENSORY = 1.5;        // per matched sensory attribute (fylde/friskhet/garvestoff/sodme)
const W_BONUS_FOOD_X_GRAPE = 5;    // food AND grape both match
const W_BONUS_FOOD_X_CATEGORY = 2; // food AND category both match

export async function searchFoodPairing(query: string): Promise<FoodPairingResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;

  const supabase = await createClient();

  // ── Phase 1: lemma-driven is_good_for query (fast, eager) ────────────────
  // "ribbe" → ["Svin", "Lyst kjøtt"]. Always include the raw query too so a
  // direct hit (e.g. "Ost", "Aperitiff") works without a lemma entry.
  const expansion = expandFoodQuery(trimmed);
  const foodTerms = Array.from(new Set([
    ...expansion.foodTerms,
    // Title-case the original to give it a chance against the case-sensitive
    // TEXT[] overlap (e.g. "ost" → "Ost").
    titleCase(trimmed),
  ])).filter(Boolean);

  const eagerWinesPromise: Promise<WineRaw[]> = foodTerms.length === 0
    ? Promise.resolve([] as WineRaw[])
    : Promise.resolve(
        supabase
          .from('wines')
          .select(WINE_COLUMNS)
          .overlaps('is_good_for', foodTerms)
          .limit(FOOD_QUERY_LIMIT),
      ).then(({ data, error }) => {
        if (error) console.error('[food-pairing] is_good_for overlap error:', error.message);
        return (data ?? []) as WineRaw[];
      });

  // ── Phase 1b: embed + article match (parallel with eager wine query) ────
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: trimmed,
  });

  type ArticleMatch = { id: string; url: string; title: string; content: string; summary: string; similarity: number };

  // Two retrieval paths, unioned. Cosine alone is unreliable for occasion
  // queries: "julemat" and "påskelam" name a season rather than a flavour, so
  // the query vector lands near generic wine prose. The tag overlap is exact
  // and cheap — it either matches a curated theme/course term or contributes
  // nothing, so it can only add recall.
  const tagTerms = { theme: expansion.themeTerms, course: expansion.courseTerms };
  const [semanticResult, tagArticles] = await Promise.all([
    supabase.rpc('match_wine_articles', {
      query_embedding: embedding,
      match_threshold: 0.25,
      match_count: ARTICLE_MATCH_COUNT,
    }),
    fetchArticlesByTags(supabase, tagTerms),
  ]);

  if (semanticResult.error) console.error('[food-pairing] match_wine_articles error:', semanticResult.error.message);

  const semanticArticles: ArticleMatch[] = semanticResult.data ?? [];
  const byId = new Map<string, ArticleMatch>();
  // Tag hits go in first so an exact occasion match survives the slice below,
  // then semantic hits fill the remaining slots.
  for (const a of tagArticles) byId.set(a.id, a);
  for (const a of semanticArticles) if (!byId.has(a.id)) byId.set(a.id, a);
  const articles: ArticleMatch[] = [...byId.values()].slice(0, ARTICLE_MATCH_COUNT + tagArticles.length);

  const articleIds = articles.map(a => a.id);
  const tagMap = new Map<string, { food_tags: string[]; occasion_tags: string[] }>();
  if (articleIds.length > 0) {
    const { data: tagged } = await supabase
      .from('wine_articles')
      .select('id, food_tags, occasion_tags')
      .in('id', articleIds);
    for (const t of tagged ?? []) {
      tagMap.set(t.id, { food_tags: t.food_tags ?? [], occasion_tags: t.occasion_tags ?? [] });
    }
  }

  // ── Phase 2: LLM extraction (runs while wine query resolves) ─────────────
  const llmPromise: Promise<z.infer<typeof ExtractionSchema>> =
    articles.length === 0
      ? Promise.resolve(EMPTY_CRITERIA)
      : extractCriteria(trimmed, articles);

  const [criteria, eagerWines] = await Promise.all([llmPromise, eagerWinesPromise]);

  // ── Phase 3: grape search via ILIKE on search_text (uses GIN trigram) ────
  // `search_text` already contains the grape list (see generate_wine_search_text).
  const grapePromises = criteria.grapes.slice(0, 5).map(grape =>
    Promise.resolve(
      supabase
        .from('wines')
        .select(WINE_COLUMNS)
        .ilike('search_text', `%${grape}%`)
        .limit(GRAPE_QUERY_LIMIT),
    ).then(({ data, error }) => {
      if (error) console.error(`[food-pairing] grape ilike(${grape}) error:`, error.message);
      return { grape, rows: (data ?? []) as WineRaw[] };
    }),
  );

  const grapeResults = await Promise.all(grapePromises);

  // ── Merge & score ───────────────────────────────────────────────────────
  // Score each unique wine against ALL signals (not just the one it came in
  // from) so a Pinot Noir tagged for Svin scores both food + grape.
  const foodTermSet = new Set(foodTerms);
  const grapesLower = criteria.grapes.map(g => g.toLowerCase()).filter(Boolean);
  const categoryFilters = criteria.categories.map(c => c.toLowerCase()).filter(Boolean);
  const regionFilters = criteria.regions.map(r => r.toLowerCase()).filter(Boolean);

  const rawById = new Map<string, WineRaw>();
  for (const row of eagerWines) rawById.set(row.id, row);
  for (const { rows } of grapeResults) {
    for (const row of rows) if (!rawById.has(row.id)) rawById.set(row.id, row);
  }

  const scored: FoodWineMatch[] = [];
  for (const w of rawById.values()) {
    const tags = w.is_good_for ?? [];
    const matchedFoodTerms = tags.filter(t => foodTermSet.has(t));
    const matchedFood = matchedFoodTerms.length;

    const searchText = (w.search_text ?? '').toLowerCase();
    const matchedGrapes = grapesLower.filter(g => searchText.includes(g));
    const grapeHit = matchedGrapes.length > 0;

    const cat = (w.main_category ?? '').toLowerCase();
    const categoryHit = categoryFilters.some(c => cat.includes(c) || c.includes(cat));

    const hay = `${w.main_country ?? ''} ${w.district ?? ''}`.toLowerCase();
    const regionHit = regionFilters.some(r => hay.includes(r));

    // Sensory match: for each LLM-specified attribute, check if the wine's
    // numeric value falls inside the recommended band. Wines with null on
    // an attribute (e.g. whites have no garvestoff) just don't score it.
    let sensoryHits = 0;
    for (const attr of ['fylde', 'friskhet', 'garvestoff', 'sodme'] as const) {
      const label = criteria.sensory[attr];
      const value = w[attr];
      if (!label || value == null) continue;
      const [lo, hi] = SENSORY_RANGES[attr][label] ?? [0, 12];
      if (value >= lo && value <= hi) sensoryHits++;
    }

    let score = 0;
    score += matchedFood * W_FOOD_TERM;
    if (tags.length > 0 && matchedFood > 0) {
      score += (matchedFood / tags.length) * W_FOOD_SPECIFICITY;
    }
    if (grapeHit) score += W_GRAPE;
    if (categoryHit) score += W_CATEGORY;
    if (regionHit) score += W_REGION;
    score += sensoryHits * W_SENSORY;
    if (matchedFood > 0 && grapeHit) score += W_BONUS_FOOD_X_GRAPE;
    if (matchedFood > 0 && categoryHit) score += W_BONUS_FOOD_X_CATEGORY;

    // Skip wines with zero signal (e.g. came from grape but doesn't actually
    // contain the grape on closer inspection — shouldn't happen, but cheap to guard)
    if (score === 0) continue;

    scored.push({
      id: w.id,
      product_id: w.product_id,
      name: w.name,
      year: w.year ?? null,
      main_category: w.main_category ?? null,
      main_country: w.main_country ?? null,
      district: w.district ?? null,
      price: parsePrice(w.price),
      matchedFood: matchedFoodTerms[0] ?? null,
      matchedGrape: matchedGrapes[0] ?? null,
      score,
    });
  }

  const wines = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, WINE_LIMIT);

  // ── Citations ───────────────────────────────────────────────────────────
  const articleCitations: FoodArticleCitation[] = articles.map(a => ({
    id: a.id,
    url: a.url,
    title: a.title,
    summary: a.summary ?? '',
    food_tags: tagMap.get(a.id)?.food_tags ?? [],
    occasion_tags: tagMap.get(a.id)?.occasion_tags ?? [],
    similarity: a.similarity,
  }));

  return {
    query: trimmed,
    recommendation: criteria.recommendation,
    categories: criteria.categories,
    grapes: criteria.grapes,
    regions: criteria.regions,
    foodTerms,
    themeTerms: expansion.themeTerms,
    courseTerms: expansion.courseTerms,
    wines,
    articles: articleCitations,
  };
}

/**
 * Exact-match article retrieval on the curated tag channels.
 *
 * `food_tags` holds themes and seasons while `occasion_tags` holds the course —
 * the column names are the wrong way round, so each channel is queried against
 * the column whose contents it actually describes. Returns [] when the query
 * resolved to no tags, which is the common case for a plain ingredient search.
 */
async function fetchArticlesByTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  terms: { theme: string[]; course: string[] },
): Promise<Array<{ id: string; url: string; title: string; content: string; summary: string; similarity: number }>> {
  const queries: Array<PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>> = [];
  if (terms.theme.length > 0) {
    queries.push(supabase.from('wine_articles')
      .select('id, url, title, content, summary')
      .overlaps('food_tags', terms.theme)
      .limit(TAG_ARTICLE_LIMIT));
  }
  if (terms.course.length > 0) {
    queries.push(supabase.from('wine_articles')
      .select('id, url, title, content, summary')
      .overlaps('occasion_tags', terms.course)
      .limit(TAG_ARTICLE_LIMIT));
  }
  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  const out = new Map<string, { id: string; url: string; title: string; content: string; summary: string; similarity: number }>();
  for (const { data, error } of results) {
    if (error) { console.error('[food-pairing] tag article query error:', error.message); continue; }
    for (const row of (data ?? []) as Array<{ id: string; url: string; title: string; content: string | null; summary: string | null }>) {
      // An exact tag hit is a stronger signal than a borderline cosine score,
      // but it carries no similarity of its own — surface it as 1 so ordering
      // and the citation UI stay coherent.
      if (!out.has(row.id)) {
        out.set(row.id, { id: row.id, url: row.url, title: row.title, content: row.content ?? '', summary: row.summary ?? '', similarity: 1 });
      }
    }
  }
  return [...out.values()];
}

async function extractCriteria(
  query: string,
  articles: Array<{ title: string; summary: string; content: string }>,
): Promise<z.infer<typeof ExtractionSchema>> {
  const articleContext = articles
    .map((a, i) => `[${i + 1}] ${a.title}\n${a.summary ?? ''}\n${a.content.slice(0, ARTICLE_CONTENT_TRUNCATE)}`)
    .join('\n\n');

  try {
    const { output } = await generateText({
      model: openai('gpt-4o-mini'),
      output: Output.object({ schema: ExtractionSchema }),
      temperature: 0,
      system:
        'Du leser norske artikler fra Vinmonopolet og henter ut konkrete vinanbefalinger. Hold deg til det artiklene sier — ikke finn på druer, regioner eller egenskaper.\n\nFor sensory: les artiklene etter ord som "fyldig", "lett", "frisk", "syrlig", "kraftige tanniner", "lite garvestoff", "tørr", "søt" osv. Sett feltet til null hvis artiklene ikke beskriver akkurat den egenskapen.',
      prompt: `Hva passer til "${query}"?\n\n${articleContext}`,
    });
    return output;
  } catch (err) {
    console.error('[food-pairing] LLM extraction failed:', err);
    return EMPTY_CRITERIA;
  }
}

// "Kr 159,00" → 159 (Norwegian comma decimal)
function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d[\d.,]*)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function titleCase(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}
