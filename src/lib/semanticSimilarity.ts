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
 * Compute semantic similarity (0–100) between two phrases.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  const embed = await getEmbedder();

  const cleanedText1 = text1.replace(/,|\.|\bmed\b|\bog\b|\bav\b/g, ' ').trim();
  const cleanedText2 = text2.replace(/,|\.|\bmed\b|\bog\b|\bav\b/g, ' ').trim();
  const [out1, out2] = await Promise.all([
    embed(cleanedText1, { pooling: 'mean', normalize: true }),
    embed(cleanedText2, { pooling: 'mean', normalize: true })
  ]);

  const emb1 = Array.from(out1.data);
  const emb2 = Array.from(out2.data);

  const similarity = cosineSimilarity(emb1 as number[], emb2 as number[]);
  return Math.round(similarity * 100);
}
