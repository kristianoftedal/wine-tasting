'use server';

import type { RecommendationThresholds, RecommendationWeights, WineSimilarityScore } from '@/lib/recommendation-types';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';
import { semanticSimilarity } from './similarity';

export type { RecommendationThresholds, RecommendationWeights, WineSimilarityScore };

/**
 * Find wines similar to the user's highly-rated wines
 * Based on numeric attributes (fylde, friskhet, snaerp, sodme) and semantic similarity (smell, taste)
 * Now accepts configurable weights and thresholds
 */
export async function findSimilarWines(
  userId: string,
  limit = 10,
  weights: RecommendationWeights = { fylde: 1, friskhet: 1, snaerp: 1, sodme: 1, smell: 1, taste: 1 },
  thresholds: RecommendationThresholds = { minKarakter: 70, candidateLimit: 100 }
): Promise<{ wines: Wine[]; scores: WineSimilarityScore[] }> {
  const supabase = await createClient();

  const { data: highRatedTastings } = await supabase
    .from('tastings')
    .select('*')
    .eq('user_id', userId)
    .gte('karakter', thresholds.minKarakter)
    .order('karakter', { ascending: false });

  if (!highRatedTastings || highRatedTastings.length === 0) {
    return { wines: [], scores: [] };
  }

  const highRatedCodes = highRatedTastings.map(t => t.product_id);
  const { data: highRatedWines } = await supabase.from('wines').select('*').in('product_id', highRatedCodes);

  if (!highRatedWines || highRatedWines.length === 0) {
    return { wines: [], scores: [] };
  }

  const { data: allUserTastings } = await supabase.from('tastings').select('product_id').eq('user_id', userId);

  const tastedCodes = new Set(allUserTastings?.map(t => t.product_id) || []);

  // Calculate average attributes from high-rated tastings
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

  const { data: candidateWines } = await supabase.from('wines').select('*').limit(thresholds.candidateLimit);

  if (!candidateWines || candidateWines.length === 0) {
    return { wines: [], scores: [] };
  }

  // Combine smell and taste descriptions from high-rated wines
  const highRatedSmells = highRatedWines.map(w => w.smell || '').filter(Boolean);
  const highRatedTastes = highRatedWines.map(w => w.taste || '').filter(Boolean);
  const combinedSmell = highRatedSmells.join(' ');
  const combinedTaste = highRatedTastes.join(' ');

  const numericFiltered: Array<{ wine: Wine; numericScore: number }> = [];

  for (const wine of candidateWines) {
    if (tastedCodes.has(wine.product_id)) {
      continue;
    }

    const wineFylde = wine.fylde || 0;
    const wineFriskhet = wine.friskhet || 0;
    const wineSnaerp = wine.garvestoff || 0;
    const wineSodme = wine.sodme || 0;

    const fyldeSimilarity = wineFylde ? 100 - Math.abs(avgAttributes.fylde - wineFylde) * 20 : 50;
    const friskhetSimilarity = wineFriskhet ? 100 - Math.abs(avgAttributes.friskhet - wineFriskhet) * 20 : 50;
    const snaerpSimilarity = wineSnaerp ? 100 - Math.abs(avgAttributes.snaerp - wineSnaerp) * 20 : 50;
    const sodmeSimilarity = wineSodme ? 100 - Math.abs(avgAttributes.sodme - wineSodme) * 20 : 50;

    const numericScore = (fyldeSimilarity + friskhetSimilarity + snaerpSimilarity + sodmeSimilarity) / 4;

    numericFiltered.push({ wine, numericScore });
  }

  numericFiltered.sort((a, b) => b.numericScore - a.numericScore);
  const topCandidates = numericFiltered.slice(0, limit * 3);

  const scoredWines: WineSimilarityScore[] = [];

  for (const { wine } of topCandidates) {
    const wineFylde = wine.fylde || 0;
    const wineFriskhet = wine.friskhet || 0;
    const wineSnaerp = wine.garvestoff || 0;
    const wineSodme = wine.sodme || 0;

    const fyldeSimilarity = wineFylde ? 100 - Math.abs(avgAttributes.fylde - wineFylde) * 20 : 50;
    const friskhetSimilarity = wineFriskhet ? 100 - Math.abs(avgAttributes.friskhet - wineFriskhet) * 20 : 50;
    const snaerpSimilarity = wineSnaerp ? 100 - Math.abs(avgAttributes.snaerp - wineSnaerp) * 20 : 50;
    const sodmeSimilarity = wineSodme ? 100 - Math.abs(avgAttributes.sodme - wineSodme) * 20 : 50;

    let smellSimilarity = 50;
    let tasteSimilarity = 50;

    if (combinedSmell && wine.smell) {
      smellSimilarity = await semanticSimilarity(combinedSmell, wine.smell);
    }

    if (combinedTaste && wine.taste) {
      tasteSimilarity = await semanticSimilarity(combinedTaste, wine.taste);
    }

    const overallScore =
      fyldeSimilarity * weights.fylde +
      friskhetSimilarity * weights.friskhet +
      snaerpSimilarity * weights.snaerp +
      sodmeSimilarity * weights.sodme +
      smellSimilarity * weights.smell +
      tasteSimilarity * weights.taste;

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
