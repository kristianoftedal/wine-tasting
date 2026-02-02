import { pipeline } from '@xenova/transformers';
import { stopwords } from './lemmatizeAndWeight';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

// Lazy load model once
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  // Calculate dot product: A·B = Σ(A[i] * B[i])
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);

  // Calculate magnitudes using Math.hypot()
  const magnitudeA = Math.hypot(...vecA);
  const magnitudeB = Math.hypot(...vecB);

  // Check for zero magnitude
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  // Calculate cosine similarity: (A·B) / (|A|*|B|)
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Compute semantic similarity (0–100) between two phrases.
 */
export async function localSemanticSimilarity(text1: string, text2: string): Promise<number> {
  const embed = await getEmbedder();

  const cleanedText1 = text1
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word))
    .join(' ');

  const cleanedText2 = text2
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopwords.has(word))
    .join(' ');

  const [out1, out2] = await Promise.all([
    embed(cleanedText1, { pooling: 'mean', normalize: true }),
    embed(cleanedText2, { pooling: 'mean', normalize: true })
  ]);

  const emb1 = Array.from(out1.data);
  const emb2 = Array.from(out2.data);

  const similarity = cosineSimilarity(emb1 as number[], emb2 as number[]);
  const result = Math.round(similarity * 100);
  return result;
}
