'use server';

import { stopwords } from '@/lib/lemmatizeAndWeight';
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

  var sum = dot / (normA * normB);
  return sum;
}

/**
 * Compute semantic similarity (0–100) between two phrases.
 * This runs on the server to avoid browser compatibility issues with transformers.
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
    userFarge && wineColor ? semanticSimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? semanticSimilarity(userLukt, wineSmell) : Promise.resolve(0),
    userSmak && wineTaste ? semanticSimilarity(userSmak, wineTaste) : Promise.resolve(0)
  ]);

  return { colorScore, smellScore, tasteScore };
}
