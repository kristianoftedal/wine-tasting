'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationThresholds, RecommendationWeights, WineSimilarityScore } from '@/lib/recommendation-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;
import { batchSemanticSimilarity } from '@/lib/semanticSimilarity';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';

/**
 * Compute per-candidate semantic score against a set of the user's high-rated
 * wines. For each candidate we take the mean of its top-N similarities to the
 * high-rated set — "how close is this to my favourite things?" — instead of
 * comparing to a single corpus concatenating every high-rated wine, which
 * collapses into an average-wine centroid and returns a flat number for
 * everyone. Returns null for candidates that can't be scored (missing text or
 * no high-rated references).
 */
async function scoreAgainstHighRated(
  highRatedTexts: string[],
  candidateTexts: Array<string | null>,
  useLocal: boolean,
  topN = 3
): Promise<Array<number | null>> {
  const hr = highRatedTexts.filter(t => t && t.length >= 10);
  if (hr.length === 0) return candidateTexts.map(() => null);

  const pairs: Array<{ text1: string; text2: string; candidateIdx: number } | null> = [];
  candidateTexts.forEach((text, idx) => {
    if (!text || text.length < 10) return;
    for (const h of hr) pairs.push({ text1: h, text2: text, candidateIdx: idx });
  });

  if (pairs.length === 0) return candidateTexts.map(() => null);

  let sims: number[];
  try {
    sims = await batchSemanticSimilarity(
      pairs.filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({ text1: p.text1, text2: p.text2 }))
    );
  } catch (err) {
    if (!useLocal) throw err;
    sims = await fallbackLocalSimilarity(
      pairs.filter((p): p is NonNullable<typeof p> => p !== null).map(p => ({ text1: p.text1, text2: p.text2 }))
    );
  }

  const bucketByCandidate = new Map<number, number[]>();
  let i = 0;
  for (const p of pairs) {
    if (p === null) continue;
    const list = bucketByCandidate.get(p.candidateIdx) ?? [];
    list.push(sims[i++]);
    bucketByCandidate.set(p.candidateIdx, list);
  }

  return candidateTexts.map((_, idx) => {
    const scores = bucketByCandidate.get(idx);
    if (!scores || scores.length === 0) return null;
    const top = [...scores].sort((a, b) => b - a).slice(0, topN);
    return top.reduce((s, v) => s + v, 0) / top.length;
  });
}

async function fallbackLocalSimilarity(pairs: Array<{ text1: string; text2: string }>): Promise<number[]> {
  const { localSemanticSimilarity } = await import('@/lib/localSemanticSimilarity');
  return Promise.all(pairs.map(p => localSemanticSimilarity(p.text1, p.text2)));
}

function numericSimilarity(userAvg: number, wineValue: number | null | undefined): number | null {
  if (wineValue === null || wineValue === undefined) return null;
  return 100 - Math.min(Math.abs(userAvg - wineValue) * 20, 100);
}

function weightedAverage(components: Array<{ score: number | null; weight: number }>): number {
  const active = components.filter(c => c.score !== null && c.weight > 0) as Array<{ score: number; weight: number }>;
  const totalWeight = active.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 0;
  return active.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
}

function getCategoryAttributes(category: string) {
  if (category === 'Rødvin') {
    return {
      useGarvestoff: true,
      useSodme: false
    };
  } else {
    // Hvitvin and Musserende vin
    return {
      useGarvestoff: false,
      useSodme: true
    };
  }
}

/**
 * Find wines similar to user's highly-rated wines using SQL-based calculations
 * Leverages database indexes and PostgreSQL functions for efficient querying
 * Handles category-specific attributes (Rødvin has garvestoff, Hvitvin has sødme)
 */
export async function findSimilarWinesSQL(
  userId: string,
  limit = 10,
  weights: RecommendationWeights,
  thresholds: RecommendationThresholds,
  category?: 'Rødvin' | 'Hvitvin' | 'Musserende vin',
  useLocalSimilarity = false,
  // Optional pre-built Supabase client. Production callers (Next.js pages/
  // actions) rely on the cookie-based server client and leave this unset;
  // offline scripts inject a service-role client to bypass the request-scope
  // requirement of next/headers. Loose generics because the SSR and
  // service-role clients use different parameterisations.
  injectedClient?: AnySupabaseClient
): Promise<{ wines: Wine[]; scores: WineSimilarityScore[] }> {
  try {
    console.log('[v0] findSimilarWinesSQL called with userId:', userId, 'category:', category);

    const supabase = injectedClient ?? (await createClient());
    if (!supabase) {
      console.error('[v0] Supabase client unavailable');
      return { wines: [], scores: [] };
    }
    console.log('[v0] Supabase client ready');

    const { data: allTastings, error: tastingError } = await supabase
      .from('tastings')
      .select('*')
      .eq('user_id', userId)
      .gte('karakter', thresholds.minKarakter)
      .order('karakter', { ascending: false });

    if (tastingError) {
      console.error('[v0] Error fetching tastings:', tastingError);
      return { wines: [], scores: [] };
    }

    console.log(`[v0] Fetched ${allTastings?.length || 0} tastings with karakter >= ${thresholds.minKarakter}`);

    if (!allTastings || allTastings.length === 0) {
      console.log('[v0] No tastings found for user');
      return { wines: [], scores: [] };
    }

    const wineIds = allTastings.map(t => t.wine_id).filter(Boolean);
    console.log(`[v0] Extracted ${wineIds.length} unique wine IDs from tastings`);

    const { data: winesData, error: winesError } = await supabase
      .from('wines')
      .select('id, main_category')
      .in('id', wineIds);

    if (winesError) {
      console.error('[v0] Error fetching wines data:', winesError);
      return { wines: [], scores: [] };
    }

    console.log(`[v0] Fetched ${winesData?.length || 0} wines data`);

    const wineMap = new Map(winesData?.map(w => [w.id, w]) || []);

    const enrichedTastings = allTastings
      .map(t => ({
        ...t,
        wine: wineMap.get(t.wine_id)
      }))
      .filter(t => t.wine);

    console.log(`[v0] Enriched ${enrichedTastings.length} tastings with wine data`);

    let highRatedTastings = enrichedTastings;

    if (category && highRatedTastings.length > 0) {
      highRatedTastings = highRatedTastings.filter((t: any) => {
        return t.wine?.main_category === category;
      });
      console.log(`[v0] Filtered to ${highRatedTastings.length} tastings in category ${category}`);
    }

    console.log(`[v0] Finding ${category || 'all'} recommendations for user ${userId}`);
    console.log(
      `[v0] Found ${highRatedTastings.length} high-rated tastings with karakter >= ${thresholds.minKarakter}`
    );

    if (highRatedTastings.length === 0) {
      console.log('[v0] No high-rated tastings found after filtering');
      return { wines: [], scores: [] };
    }

    const targetCategory = category || null;

    const avgAttributes = {
      fylde: 0,
      friskhet: 0,
      snaerp: 0,
      sodme: 0
    };

    let count = 0;
    highRatedTastings.forEach(t => {
      if (t.fylde !== null) avgAttributes.fylde += t.fylde;
      if (t.friskhet !== null) avgAttributes.friskhet += t.friskhet;
      if (t.snaerp !== null) avgAttributes.snaerp += t.snaerp;
      if (t.sodme !== null) avgAttributes.sodme += t.sodme;
      count++;
    });

    if (count > 0) {
      avgAttributes.fylde /= count;
      avgAttributes.friskhet /= count;
      avgAttributes.snaerp /= count;
      avgAttributes.sodme /= count;
    }

    console.log('[v0] Calculated average attributes:', avgAttributes);

    const { data: allUserTastings, error: userTastingsError } = await supabase
      .from('tastings')
      .select('wine_id')
      .eq('user_id', userId);

    if (userTastingsError) {
      console.error('[v0] Error fetching user tastings:', userTastingsError);
      return { wines: [], scores: [] };
    }

    const tastedWineIds = allUserTastings?.map(t => t.wine_id).filter(Boolean) || [];
    console.log(`[v0] User has already tasted ${tastedWineIds.length} wines (excluding from recommendations)`);

    console.log('[v0] Calling find_similar_wines_weighted RPC with params:', {
      p_fylde: avgAttributes.fylde,
      p_friskhet: avgAttributes.friskhet,
      p_garvestoff: avgAttributes.snaerp,
      p_sodme: avgAttributes.sodme,
      p_excluded_wine_ids_count: tastedWineIds.length,
      p_main_category: targetCategory,
      p_limit: thresholds.candidateLimit || limit * 2
    });

    const { data: candidateWines, error } = await supabase.rpc('find_similar_wines_weighted', {
      p_fylde: avgAttributes.fylde,
      p_friskhet: avgAttributes.friskhet,
      p_garvestoff: avgAttributes.snaerp,
      p_sodme: avgAttributes.sodme,
      p_excluded_wine_ids: tastedWineIds,
      p_main_category: targetCategory,
      p_limit: thresholds.candidateLimit || limit * 2
    });

    if (error) {
      console.error('[v0] Error calling find_similar_wines_weighted:', error);
      return { wines: [], scores: [] };
    }

    console.log(`[v0] RPC returned ${candidateWines?.length || 0} candidate wines`);

    if (!candidateWines || candidateWines.length === 0) {
      console.log('[v0] No candidate wines returned from RPC');
      return { wines: [], scores: [] };
    }

    const highRatedWineIds = highRatedTastings.map(t => t.wine_id).filter(Boolean);
    const { data: highRatedWines, error: highRatedError } = await supabase
      .from('wines')
      .select('*')
      .in('id', highRatedWineIds);

    if (highRatedError) {
      console.error('[v0] Error fetching high-rated wines:', highRatedError);
      return { wines: [], scores: [] };
    }

    console.log(`[v0] Fetched ${highRatedWines?.length || 0} high-rated wines for semantic analysis`);

    const highRatedSmells = (highRatedWines ?? []).map(w => w.smell ?? '').filter(Boolean);
    const highRatedTastes = (highRatedWines ?? []).map(w => w.taste ?? '').filter(Boolean);

    console.log(
      `[v0] Embedding against ${highRatedSmells.length} high-rated smell texts and ${highRatedTastes.length} taste texts`
    );

    // Score *all* candidates returned by the RPC rather than the first
     // limit*2. Wines with integer attributes (fylde, friskhet, …) tie a lot
     // at any given distance, and with a narrow slice we'd see identical
     // numeric sub-scores across the entire returned set — spread would have
     // to come from semantic alone. Widening to the full candidate window
     // lets distant-but-semantically-strong matches reach the final sort.
     // `batchSemanticSimilarity` dedupes embeddings, so doubling the window
     // only adds a handful of OpenAI calls.
    const slicedCandidates = candidateWines as Wine[];

    // Batch-embed all smell/taste pairs once. For each candidate we take the
    // mean of its top-3 similarities to the high-rated set, which preserves
    // per-candidate variance instead of collapsing into one averaged corpus.
    const [smellScores, tasteScores] = await Promise.all([
      scoreAgainstHighRated(highRatedSmells, slicedCandidates.map(c => c.smell ?? null), useLocalSimilarity),
      scoreAgainstHighRated(highRatedTastes, slicedCandidates.map(c => c.taste ?? null), useLocalSimilarity)
    ]);

    const scoredWines: WineSimilarityScore[] = [];

    slicedCandidates.forEach((wine, idx) => {
      const categoryAttrs = getCategoryAttributes(wine.main_category || '');

      // Per-attribute sub-scores. null = wine lacks data for this dimension;
      // we don't synthesise a middle value because that homogenises rankings.
      const fyldeSim = numericSimilarity(avgAttributes.fylde, wine.fylde ?? null);
      const friskhetSim = numericSimilarity(avgAttributes.friskhet, wine.friskhet ?? null);
      const snaerpSim = categoryAttrs.useGarvestoff
        ? numericSimilarity(avgAttributes.snaerp, wine.garvestoff ?? null)
        : null;
      const sodmeSim = categoryAttrs.useSodme ? numericSimilarity(avgAttributes.sodme, wine.sodme ?? null) : null;
      const smellSim = smellScores[idx];
      const tasteSim = tasteScores[idx];

      // Weighted average over only the components that have data. Skipping
      // absent fields (rather than imputing 50) stops wines with sparse
      // metadata from clustering at the middle of the ranking.
      const overallScore = weightedAverage([
        { score: fyldeSim, weight: weights.fylde },
        { score: friskhetSim, weight: weights.friskhet },
        { score: snaerpSim, weight: categoryAttrs.useGarvestoff ? weights.snaerp : 0 },
        { score: sodmeSim, weight: categoryAttrs.useSodme ? weights.sodme : 0 },
        { score: smellSim, weight: weights.smell },
        { score: tasteSim, weight: weights.taste }
      ]);

      scoredWines.push({
        wine,
        similarityScore: overallScore,
        attributeScores: {
          fylde: fyldeSim,
          friskhet: friskhetSim,
          snaerp: snaerpSim,
          sodme: sodmeSim,
          smell: smellSim,
          taste: tasteSim
        }
      });
    });

    scoredWines.sort((a, b) => b.similarityScore - a.similarityScore);

    const topScored = scoredWines.slice(0, limit);
    console.log(`[v0] Returning top ${topScored.length} scored wines`);

    return {
      wines: topScored.map(sw => sw.wine),
      scores: topScored
    };
  } catch (error) {
    console.error('[v0] Unexpected error in findSimilarWinesSQL:', error);
    return { wines: [], scores: [] };
  }
}
