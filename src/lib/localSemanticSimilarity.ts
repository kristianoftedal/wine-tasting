import { pipeline } from '@xenova/transformers';
import { stopwords } from './lemmatizeAndWeight';
import { cosineSimilarity } from './math';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

// Lazy load model once
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
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
