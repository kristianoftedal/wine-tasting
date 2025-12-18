'use server';

import { lemmatizeAndWeight, stopwords } from '@/lib/lemmatizeAndWeight';
import { pipeline } from '@xenova/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

// Lazy load model once
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0));
  return dot / (normA * normB);
}

/**
 * Compute semantic similarity (0–100) between two phrases using embeddings.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const embed = await getEmbedder();

    const cleanedText1: string[] = text1
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0 && !stopwords.has(word));

    const cleanedText2 = text2
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0 && !stopwords.has(word));

    if (cleanedText1.length === 0 || cleanedText2.length === 0) return 0;

    const [out1, out2] = await Promise.all([
      embed(cleanedText1, { pooling: 'mean', normalize: true }),
      embed(cleanedText2, { pooling: 'mean', normalize: true })
    ]);

    const emb1 = Array.from(out1.data);
    const emb2 = Array.from(out2.data);

    const similarity = cosineSimilarity(emb1 as number[], emb2 as number[]);
    return Math.round(similarity * 100);
  } catch (error) {
    console.error('Semantic similarity error:', error);
    return 0;
  }
}

/**
 * Compute semantic similarity between lemmatized words (0-100)
 */
async function lemmaSemanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const data1 = lemmatizeAndWeight(text1);
    const data2 = lemmatizeAndWeight(text2);

    // Extract unique lemmas from both texts
    const lemmas1 = Array.from(new Set(data1.lemmatized.map(item => item.lemma))).join(' ');
    const lemmas2 = Array.from(new Set(data2.lemmatized.map(item => item.lemma))).join(' ');

    if (!lemmas1 || !lemmas2) return 0;

    return await semanticSimilarity(lemmas1, lemmas2);
  } catch (error) {
    console.error('Lemma semantic similarity error:', error);
    return 0;
  }
}

/**
 * Compute semantic similarity between category distributions (0-100)
 */
async function categorySemanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const data1 = lemmatizeAndWeight(text1);
    const data2 = lemmatizeAndWeight(text2);

    // Extract categories as descriptive text
    const categories1 = Object.keys(data1.categories).join(' ');
    const categories2 = Object.keys(data2.categories).join(' ');

    if (!categories1 || !categories2) return 0;

    return await semanticSimilarity(categories1, categories2);
  } catch (error) {
    console.error('Category semantic similarity error:', error);
    return 0;
  }
}

/**
 * Calculate comprehensive similarity score by averaging:
 * - Standard semantic similarity
 * - Lemma-based semantic similarity
 * - Category-based semantic similarity
 */
export async function comprehensiveSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const [standardScore, lemmaScore, categoryScore] = await Promise.all([
      semanticSimilarity(text1, text2),
      lemmaSemanticSimilarity(text1, text2),
      categorySemanticSimilarity(text1, text2)
    ]);

    // Average the three scores
    const averageScore = Math.round((standardScore + lemmaScore + categoryScore) / 3);

    return averageScore;
  } catch (error) {
    console.error('Comprehensive similarity error:', error);
    return 0;
  }
}

/**
 * Calculate all similarity scores for a tasting in one server call
 */
export async function calculateTastingScores(
  userFarge: string,
  userLukt: string,
  userSmak: string,
  wineColor: string,
  wineSmell: string,
  wineTaste: string
): Promise<{ colorScore: number; smellScore: number; tasteScore: number }> {
  const [colorScore, smellScore, tasteScore] = await Promise.all([
    userFarge && wineColor ? comprehensiveSimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? comprehensiveSimilarity(userLukt, wineSmell) : Promise.resolve(0),
    userSmak && wineTaste ? comprehensiveSimilarity(userSmak, wineTaste) : Promise.resolve(0)
  ]);

  return { colorScore, smellScore, tasteScore };
}
