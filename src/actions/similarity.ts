'use server';

import { lemmatizeAndWeight, norwegianLemmas } from '@/lib/lemmatizeAndWeight';
import { semanticSimilarity } from '@/lib/semanticSimilarity';

type LemmaInfo = { lemma: string; weight: number; main?: string; sub?: string };

/**
 * Extract lemmas with their active-profile weight and hierarchical category.
 * Dedupes per side by keeping the highest weight when the same lemma appears
 * twice. Unknown words (category `ukjent`) are skipped so they neither reward
 * nor penalise the score.
 */
function lemmasWithWeight(text: string): Map<string, LemmaInfo> {
  const data = lemmatizeAndWeight(text);
  const out = new Map<string, LemmaInfo>();
  for (const item of data.lemmatized) {
    if (item.category === 'ukjent') continue;
    const path = (norwegianLemmas[item.original] ?? norwegianLemmas[item.lemma])?.categoryPath;
    const existing = out.get(item.lemma);
    if (!existing || item.weight > existing.weight) {
      out.set(item.lemma, { lemma: item.lemma, weight: item.weight, main: path?.main, sub: path?.sub });
    }
  }
  return out;
}

const sumWeights = (m: Map<string, LemmaInfo>) => [...m.values()].reduce((s, v) => s + v.weight, 0);

/**
 * Weighted lemma overlap. Each lemma contributes its active-profile weight
 * (specifics like "solbær" weigh 2.0, generics like "balanse" weigh 1.0 on the
 * inverted profile). A match on a specific descriptor earns more than a match
 * on a filler word, and matching only on filler words no longer dominates.
 * Denominator is the smaller side's weighted mass so short, precise user notes
 * aren't punished for being short.
 */
export async function lemmaSimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const a = lemmasWithWeight(text1);
    const b = lemmasWithWeight(text2);
    if (!a.size || !b.size) return 0;

    let interWeight = 0;
    for (const [lemma, info] of a) {
      if (b.has(lemma)) interWeight += info.weight;
    }
    const smallerWeight = Math.min(sumWeights(a), sumWeights(b));
    if (smallerWeight === 0) return 0;
    return Math.round((interWeight / smallerWeight) * 100);
  } catch (error) {
    console.error('Lemma similarity error:', error);
    return 0;
  }
}

/**
 * Weighted hierarchical category similarity. Full weight credit when the
 * (main, sub) path matches; half credit when only the main category matches.
 * Weighted by active profile so matching on Frukt earns more than matching on
 * GENERIC, keeping the penalty for "only matched on filler" consistent with
 * the lemma path.
 */
async function categorySimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const a = lemmasWithWeight(text1);
    const b = lemmasWithWeight(text2);
    if (!a.size || !b.size) return 0;

    const mainsB = new Set([...b.values()].map(v => v.main).filter(Boolean));
    const fullB = new Set([...b.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`));

    let credit = 0;
    for (const info of a.values()) {
      if (!info.main) continue;
      const key = info.sub ? `${info.main}/${info.sub}` : null;
      if (key && fullB.has(key)) credit += info.weight;
      else if (mainsB.has(info.main)) credit += info.weight * 0.5;
    }
    const smallerWeight = Math.min(sumWeights(a), sumWeights(b));
    if (smallerWeight === 0) return 0;
    return Math.round((credit / smallerWeight) * 100);
  } catch (error) {
    console.error('Category similarity error:', error);
    return 0;
  }
}

/**
 * Calculate semantic similarity score only (for color comparison)
 * Uses OpenAI embeddings
 */
export async function semanticOnlySimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const result = await semanticSimilarity(text1, text2);
    return result;
  } catch (error) {
    console.error('Semantic similarity error:', error);
    return 0;
  }
}

/**
 * Reward-stacking similarity. Semantic embedding is the fair "meaning floor" —
 * it captures whether the user picked up the broad picture. Lemma overlap and
 * hierarchical category matches are additive precision bonuses layered on top.
 *
 *   score = clamp(semantic + precisionBonus, 0, 100)
 *   precisionBonus = max(0, precision - threshold) * gain
 *
 * The threshold prevents noise from inflating scores; the gain rewards users
 * who name specific descriptors that match the wine. Lemma/category can never
 * drag the score *below* the semantic floor — that was the core flaw of the
 * previous three-way average.
 */
export async function serverSideSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const [lemmaScore, categoryScore, semanticScore] = await Promise.all([
      lemmaSimpleSimilarity(text1, text2),
      categorySimpleSimilarity(text1, text2),
      semanticOnlySimilarity(text1, text2)
    ]);

    const precision = (lemmaScore + categoryScore) / 2;
    const bonus = Math.max(0, precision - 30) * 0.35;
    const final = Math.min(100, semanticScore + bonus);

    return Math.round(final);
  } catch (error) {
    console.error('Server-side similarity error:', error);
    return 0;
  }
}

/**
 * Calculate all server-side similarity scores for a tasting in one server call.
 * - Color uses semantic similarity only
 * - Smell and taste use lemma + category + lemmatized text similarity
 */
export async function calculateServerSideScores(
  userFarge: string,
  userLukt: string,
  userSmak: string,
  wineColor: string,
  wineSmell: string,
  wineTaste: string
): Promise<{ colorScore: number; smellScore: number; tasteScore: number }> {
  const [colorScore, smellScore, tasteScore] = await Promise.all([
    userFarge && wineColor ? semanticOnlySimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? serverSideSimilarity(userLukt, wineSmell) : Promise.resolve(0),
    userSmak && wineTaste ? serverSideSimilarity(userSmak, wineTaste) : Promise.resolve(0)
  ]);

  return { colorScore, smellScore, tasteScore };
}
