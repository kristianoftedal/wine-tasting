'use server';

import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { stripGenericTerms } from './lemmatizeAndWeight';
import { cosineSimilarity } from './math';

/**
 * Compute semantic similarity (0-100) between two texts using OpenAI embeddings.
 * Strips structural/quality/texture terms (tannins, body, acidity etc.) before
 * embedding so the comparison focuses on aroma and flavor descriptors only —
 * structure is already captured by numeric scores.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  const cleaned1 = stripGenericTerms(text1);
  const cleaned2 = stripGenericTerms(text2);
  if (!cleaned1 || !cleaned2) return 0;

  try {
    const [result1, result2] = await Promise.all([
      embed({
        model: openai.embedding('text-embedding-3-small'),
        value: cleaned1
      }),
      embed({
        model: openai.embedding('text-embedding-3-small'),
        value: cleaned2
      })
    ]);

    const similarity = cosineSimilarity(result1.embedding, result2.embedding);
    return Math.round(similarity * 100);
  } catch (error) {
    console.error('Semantic similarity error:', error);
    return 0;
  }
}

/**
 * Embed two texts directly and return cosine similarity (0-100) with no preprocessing.
 * Used for color comparison where stripping structural terms would corrupt the input.
 */
export async function rawSemanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1.trim() || !text2.trim()) return 0;
  try {
    const [r1, r2] = await Promise.all([
      embed({ model: openai.embedding('text-embedding-3-small'), value: text1 }),
      embed({ model: openai.embedding('text-embedding-3-small'), value: text2 }),
    ]);
    return Math.round(cosineSimilarity(r1.embedding, r2.embedding) * 100);
  } catch (error) {
    console.error('Raw semantic similarity error:', error);
    return 0;
  }
}

/**
 * Batch calculate similarities for multiple text pairs.
 * More efficient than calling embeddingSimilarity multiple times.
 */
export async function batchSemanticSimilarity(pairs: Array<{ text1: string; text2: string }>): Promise<number[]> {
  if (pairs.length === 0) return [];

  try {
    const cleanedPairs = pairs.map(({ text1, text2 }) => ({
      text1: stripGenericTerms(text1),
      text2: stripGenericTerms(text2)
    }));

    const uniqueTexts = [...new Set(cleanedPairs.flatMap(p => [p.text1, p.text2]).filter(Boolean))];

    const embeddings = await Promise.all(
      uniqueTexts.map(text =>
        embed({
          model: openai.embedding('text-embedding-3-small'),
          value: text
        })
      )
    );

    const embeddingMap = new Map<string, number[]>();
    uniqueTexts.forEach((text, i) => {
      embeddingMap.set(text, embeddings[i].embedding);
    });

    return cleanedPairs.map(({ text1, text2 }) => {
      if (!text1 || !text2) return 0;
      const emb1 = embeddingMap.get(text1);
      const emb2 = embeddingMap.get(text2);
      if (!emb1 || !emb2) return 0;
      return Math.round(cosineSimilarity(emb1, emb2) * 100);
    });
  } catch (error) {
    console.error('Batch semantic similarity error:', error);
    return pairs.map(() => 0);
  }
}

/**
 * BERTScore-style token-level similarity.
 *
 * Embeds each unique word from both texts individually, then computes:
 *   precision = avg over user tokens of max cosine to any reference token
 *   recall    = avg over reference tokens of max cosine to any user token
 *   score     = F1(precision, recall) × 100
 *
 * Captures partial credit for near-synonym matches (e.g. "solbær" vs "bær")
 * that sentence-level cosine handles less precisely because the signal is
 * diluted across the whole sentence vector.
 */
export async function bertScoreTokenSimilarity(text1: string, text2: string): Promise<number> {
  const tokens1 = [...new Set(stripGenericTerms(text1).split(' ').filter(Boolean))];
  const tokens2 = [...new Set(stripGenericTerms(text2).split(' ').filter(Boolean))];
  if (!tokens1.length || !tokens2.length) return 0;

  const allTokens = [...new Set([...tokens1, ...tokens2])];

  try {
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: allTokens,
    });

    const embMap = new Map<string, number[]>();
    allTokens.forEach((t, i) => embMap.set(t, embeddings[i]));

    const embs1 = tokens1.map(t => embMap.get(t)!);
    const embs2 = tokens2.map(t => embMap.get(t)!);

    const precision = embs1.reduce((sum, e1) =>
      sum + Math.max(...embs2.map(e2 => cosineSimilarity(e1, e2))), 0) / embs1.length;

    const recall = embs2.reduce((sum, e2) =>
      sum + Math.max(...embs1.map(e1 => cosineSimilarity(e2, e1))), 0) / embs2.length;

    if (precision + recall === 0) return 0;
    return Math.round((2 * precision * recall) / (precision + recall) * 100);
  } catch (error) {
    console.error('BERTScore error:', error);
    return 0;
  }
}
