'use server';

import type { RecommendationThresholds, RecommendationWeights, WineSimilarityScore } from '@/lib/recommendation-types';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';
import { semanticSimilarity } from './similarity';

function getCategoryAttributes(category: string) {
  if (category === 'Rödvin') {
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
 * Handles category-specific attributes (Rödvin has garvestoff, Hvitvin has sødme)
 */
export async function findSimilarWinesSQL(
  userId: string,
  limit = 10,
  weights: RecommendationWeights,
  thresholds: RecommendationThresholds,
  category?: 'Rödvin' | 'Hvitvin' | 'Musserende vin'
): Promise<{ wines: Wine[]; scores: WineSimilarityScore[] }> {
  const supabase = await createClient();

  const { data: allTastings } = await supabase
    .from('tastings')
    .select('*')
    .eq('user_id', userId)
    .gte('karakter', thresholds.minKarakter)
    .order('karakter', { ascending: false });

  if (!allTastings || allTastings.length === 0) {
    return { wines: [], scores: [] };
  }

  // Get all product_ids from tastings to fetch wine data
  const productIds = allTastings.map(t => t.product_id);

  // Fetch wines data for these product_ids
  const { data: winesData } = await supabase
    .from('wines')
    .select('product_id, main_category')
    .in('product_id', productIds);

  // Create a map for quick lookup
  const wineMap = new Map(winesData?.map(w => [w.product_id, w]) || []);

  // Enrich tastings with wine data
  const enrichedTastings = allTastings
    .map(t => ({
      ...t,
      wine: wineMap.get(t.product_id)
    }))
    .filter(t => t.wine); // Only keep tastings where we found the wine

  let highRatedTastings = enrichedTastings;

  // Filter by category if specified
  if (category && highRatedTastings.length > 0) {
    highRatedTastings = highRatedTastings.filter((t: any) => {
      return t.wine?.main_category === category;
    });
  }

  console.log(`[v0] Finding ${category || 'all'} recommendations for user ${userId}`);
  console.log(`[v0] Found ${highRatedTastings.length} high-rated tastings with karakter >= ${thresholds.minKarakter}`);

  if (highRatedTastings.length === 0) {
    return { wines: [], scores: [] };
  }

  // This ensures each section queries wines of the correct type
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

  const { data: allUserTastings } = await supabase.from('tastings').select('product_id').eq('user_id', userId);
  const tastedCodes = allUserTastings?.map(t => t.product_id) || [];

  const { data: candidateWines, error } = await supabase.rpc('find_similar_wines_weighted', {
    p_avg_fylde: avgAttributes.fylde,
    p_avg_friskhet: avgAttributes.friskhet,
    p_avg_snaerp: avgAttributes.snaerp,
    p_avg_sodme: avgAttributes.sodme,
    p_weight_fylde: weights.fylde,
    p_weight_friskhet: weights.friskhet,
    p_weight_snaerp: weights.snaerp,
    p_weight_sodme: weights.sodme,
    p_excluded_codes: tastedCodes,
    p_main_category: targetCategory, // This will filter wines by category in SQL
    p_limit: thresholds.candidateLimit
  });

  if (error) {
    console.error('[v0] Error calling find_similar_wines_weighted:', error);
    return { wines: [], scores: [] };
  }

  if (!candidateWines || candidateWines.length === 0) {
    return { wines: [], scores: [] };
  }

  const highRatedCodes = highRatedTastings.map(t => t.product_id);
  const { data: highRatedWines } = await supabase.from('wines').select('*').in('product_id', highRatedCodes);

  const highRatedSmells = highRatedWines?.map(w => w.smell || '').filter(Boolean) || [];
  const highRatedTastes = highRatedWines?.map(w => w.taste || '').filter(Boolean) || [];
  const combinedSmell = highRatedSmells.join(' ');
  const combinedTaste = highRatedTastes.join(' ');

  const scoredWines: WineSimilarityScore[] = [];

  for (const candidate of candidateWines.slice(0, limit * 2)) {
    const wine = candidate as unknown as Wine & { numeric_score: number };

    let smellSimilarity = 50;
    let tasteSimilarity = 50;

    if (combinedSmell && wine.smell) {
      smellSimilarity = await semanticSimilarity(combinedSmell, wine.smell);
    }

    if (combinedTaste && wine.taste) {
      tasteSimilarity = await semanticSimilarity(combinedTaste, wine.taste);
    }

    const numericScore = wine.numeric_score || 0;
    const semanticScore =
      (smellSimilarity * weights.smell + tasteSimilarity * weights.taste) / (weights.smell + weights.taste);

    const categoryAttrs = getCategoryAttributes(wine.main_category || '');
    const numericWeight =
      weights.fylde +
      weights.friskhet +
      (categoryAttrs.useGarvestoff ? weights.snaerp : 0) +
      (categoryAttrs.useSodme ? weights.sodme : 0);

    const totalWeight = numericWeight + weights.smell + weights.taste;

    const overallScore = (numericScore * numericWeight + semanticScore * (weights.smell + weights.taste)) / totalWeight;

    const fyldeSimilarity = wine.fylde ? 100 - Math.min(Math.abs(avgAttributes.fylde - wine.fylde) * 20, 100) : 50;
    const friskhetSimilarity = wine.friskhet
      ? 100 - Math.min(Math.abs(avgAttributes.friskhet - wine.friskhet) * 20, 100)
      : 50;

    let snaerpSimilarity = 50;
    let sodmeSimilarity = 50;

    if (categoryAttrs.useGarvestoff && wine.garvestoff) {
      snaerpSimilarity = 100 - Math.min(Math.abs(avgAttributes.snaerp - wine.garvestoff) * 20, 100);
    }

    if (categoryAttrs.useSodme && wine.sodme) {
      sodmeSimilarity = 100 - Math.min(Math.abs(avgAttributes.sodme - wine.sodme) * 20, 100);
    }

    scoredWines.push({
      wine,
      similarityScore: overallScore,
      attributeScores: {
        fylde: fyldeSimilarity,
        friskhet: friskhetSimilarity,
        snaerp: snaerpSimilarity,
        sodme: sodmeSimilarity,
        smell: smellSimilarity,
        taste: tasteSimilarity
      }
    });
  }

  scoredWines.sort((a, b) => b.similarityScore - a.similarityScore);

  const topScored = scoredWines.slice(0, limit);
  return {
    wines: topScored.map(sw => sw.wine),
    scores: topScored
  };
}
