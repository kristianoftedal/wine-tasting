'use server';

import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { stripGenericTerms } from './lemmatizeAndWeight';
import { cosineSimilarity } from './math';
import { EMBEDDING_MODEL } from './scoringConfig';

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
        model: openai.embedding(EMBEDDING_MODEL),
        value: cleaned1
      }),
      embed({
        model: openai.embedding(EMBEDDING_MODEL),
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
      embed({ model: openai.embedding(EMBEDDING_MODEL), value: text1 }),
      embed({ model: openai.embedding(EMBEDDING_MODEL), value: text2 }),
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
    if (uniqueTexts.length === 0) return pairs.map(() => 0);

    // One request for the whole batch. This previously mapped `embed` over the
    // unique texts, issuing one HTTP round trip per text — for recommendation
    // scoring that meant tens of concurrent requests where one suffices.
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: uniqueTexts,
    });

    const embeddingMap = new Map<string, number[]>();
    uniqueTexts.forEach((text, i) => {
      embeddingMap.set(text, embeddings[i]);
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
