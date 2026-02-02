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
 * Convert text to its lemmatized form (lemmas joined as space-separated string)
 */
function toLemmatizedText(text: string): string {
  const data = lemmatizeAndWeight(text);
  return data.lemmatized.map(item => item.lemma).join(' ');
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
 * Calculate similarity between lemmatized text strings using semantic comparison
 */
async function lemmatizedTextSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const lemmatizedText1 = toLemmatizedText(text1);
    const lemmatizedText2 = toLemmatizedText(text2);

    if (!lemmatizedText1 || !lemmatizedText2) return 0;

    const result = await semanticSimilarity(lemmatizedText1, lemmatizedText2);
    return result;
  } catch (error) {
    console.error('Lemmatized text similarity error:', error);
    return 0;
  }
}

/**
 * Calculate comprehensive server-side similarity score using:
 * - Lemma matching (set intersection)
 * - Category matching (set intersection)
 * - Lemmatized text semantic similarity
 * - OpenAI embedding similarity (if AI_GATEWAY_API_KEY is available and not localhost)
 * - Falls back to local semantic similarity on localhost or when API key is missing
 * Final score = average of available scores
 */
export async function serverSideSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    // Calculate all similarity scores in parallel
    const [lemmaScore, categoryScore, lemmatizedTextScore] = await Promise.all([
      lemmaSimpleSimilarity(text1, text2),
      categorySimpleSimilarity(text1, text2),
      lemmatizedTextSimilarity(text1, text2)
    ]);

    // Average all three scores
    return Math.round((lemmaScore + categoryScore + lemmatizedTextScore) / 3);
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
