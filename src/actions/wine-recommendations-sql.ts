'use server';

import type { RecommendationThresholds, RecommendationWeights, WineSimilarityScore } from '@/lib/recommendation-types';
import { semanticSimilarity } from '@/lib/semanticSimilarity';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';

/**
 * Get semantic similarity using OpenAI, or dynamically loaded local similarity
 */
async function getSemanticSimilarity(text1: string, text2: string, useLocal: boolean): Promise<number> {
  if (useLocal) {
    const { localSemanticSimilarity } = await import('@/lib/localSemanticSimilarity');
    return localSemanticSimilarity(text1, text2);
  }
  try {
    return await semanticSimilarity(text1, text2);
  } catch {
    console.warn('[v0] OpenAI embedding failed, falling back to local similarity');
    const { localSemanticSimilarity } = await import('@/lib/localSemanticSimilarity');
    return localSemanticSimilarity(text1, text2);
  }
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
 * Handles category-specific attributes (Rödvin has garvestoff, Hvitvin has sødme)
 */
export async function findSimilarWinesSQL(
  userId: string,
  limit = 10,
  weights: RecommendationWeights,
  thresholds: RecommendationThresholds,
  category?: 'Rödvin' | 'Hvitvin' | 'Musserende vin',
  useLocalSimilarity = false
): Promise<{ wines: Wine[]; scores: WineSimilarityScore[] }> {
  try {
    console.log('[v0] findSimilarWinesSQL called with userId:', userId, 'category:', category);

    const supabase = await createClient();
    console.log('[v0] Supabase client created');

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
      p_smell_similarity: 0.5,
      p_taste_similarity: 0.5,
      p_alcohol_similarity: 0.5,
      p_price_similarity: 0.5,
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

    const highRatedSmells = highRatedWines?.map(w => w.smell || '').filter(Boolean) || [];
    const highRatedTastes = highRatedWines?.map(w => w.taste || '').filter(Boolean) || [];
    const combinedSmell = highRatedSmells.join(' ');
    const combinedTaste = highRatedTastes.join(' ');

    console.log(`[v0] Combined smell text length: ${combinedSmell.length}, taste text length: ${combinedTaste.length}`);

    const scoredWines: WineSimilarityScore[] = [];

    for (const candidate of candidateWines.slice(0, limit * 2)) {
      try {
        const wine = candidate as unknown as Wine & { numeric_score: number };

        let smellSimilarity = 50;
        let tasteSimilarity = 50;

        if (combinedSmell && wine.smell) {
          console.log(`[v0] Computing smell similarity for wine: ${wine.name}`);
          smellSimilarity = await getSemanticSimilarity(combinedSmell, wine.smell, useLocalSimilarity);
          console.log(`[v0] Smell similarity score: ${smellSimilarity}`);
        }

        if (combinedTaste && wine.taste) {
          console.log(`[v0] Computing taste similarity for wine: ${wine.name}`);
          tasteSimilarity = await getSemanticSimilarity(combinedTaste, wine.taste, useLocalSimilarity);
          console.log(`[v0] Taste similarity score: ${tasteSimilarity}`);
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

        const overallScore =
          (numericScore * numericWeight + semanticScore * (weights.smell + weights.taste)) / totalWeight;

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

        console.log(`[v0] Wine ${wine.name} overall score: ${overallScore}`);

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
      } catch (wineError) {
        console.error('[v0] Error scoring wine:', wineError);
        continue;
      }
    }

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
