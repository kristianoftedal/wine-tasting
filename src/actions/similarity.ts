'use server';

import { lemmatizeAndWeight } from '@/lib/lemmatizeAndWeight';
import { semanticSimilarity } from '@/lib/semanticSimilarity';

/**
 * Compute similarity between lemmatized words (0-100)
 */
export async function lemmaSimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const data1 = lemmatizeAndWeight(text1);
    const data2 = lemmatizeAndWeight(text2);

    const lemmas1 = new Set(data1.lemmatized.map(item => item.lemma));
    const lemmas2 = new Set(data2.lemmatized.map(item => item.lemma));

    if (lemmas1.size === 0 || lemmas2.size === 0) return 0;

    const intersection = [...lemmas1].filter(lemma => lemmas2.has(lemma)).length;
    const union = new Set([...lemmas1, ...lemmas2]).size;

    return Math.round((intersection / union) * 100);
  } catch (error) {
    console.error('Lemma similarity error:', error);
    return 0;
  }
}

/**
 * Compute similarity between category distributions (0-100)
 */
async function categorySimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const data1 = lemmatizeAndWeight(text1);
    const data2 = lemmatizeAndWeight(text2);

    const categories1 = new Set(Object.keys(data1.categories));
    const categories2 = new Set(Object.keys(data2.categories));

    if (categories1.size === 0 || categories2.size === 0) return 0;

    const intersection = [...categories1].filter(cat => categories2.has(cat)).length;
    const union = new Set([...categories1, ...categories2]).size;

    return Math.round((intersection / union) * 100);
  } catch (error) {
    console.error('Category similarity error:', error);
    return 0;
  }
}

/**
 * Calculate comprehensive server-side similarity score using:
 * - Lemma matching
 * - Category matching
 * - OpenAI embedding similarity
 * Final score = (lemmaScore + categoryScore + embeddingScore) / 3
 */
export async function serverSideSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const [lemmaScore, categoryScore, embeddingScore] = await Promise.all([
      lemmaSimpleSimilarity(text1, text2),
      categorySimpleSimilarity(text1, text2),
      semanticSimilarity(text1, text2)
    ]);

    // Average all three scores
    const averageScore = Math.round((lemmaScore + categoryScore + embeddingScore) / 3);

    return averageScore;
  } catch (error) {
    console.error('Server-side similarity error:', error);
    return 0;
  }
}

/**
 * Calculate all server-side similarity scores for a tasting in one server call.
 * Uses lemma + category similarity. Should be combined with client-side ML scores.
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
    userFarge && wineColor ? serverSideSimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? serverSideSimilarity(userLukt, wineSmell) : Promise.resolve(0),
    userSmak && wineTaste ? serverSideSimilarity(userSmak, wineTaste) : Promise.resolve(0)
  ]);

  return { colorScore, smellScore, tasteScore };
}
