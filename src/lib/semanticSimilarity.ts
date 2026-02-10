'use server';

import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { cosineSimilarity } from './math';

/**
 * Compute semantic similarity (0-100) between two texts using OpenAI embeddings.
 * This is serverless-compatible as it uses API calls instead of local ML models.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const [result1, result2] = await Promise.all([
      embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text1
      }),
      embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text2
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
 * Batch calculate similarities for multiple text pairs.
 * More efficient than calling embeddingSimilarity multiple times.
 */
export async function batchSemanticSimilarity(pairs: Array<{ text1: string; text2: string }>): Promise<number[]> {
  if (pairs.length === 0) return [];

  try {
    // Get all unique texts
    const uniqueTexts = [...new Set(pairs.flatMap(p => [p.text1, p.text2]).filter(Boolean))];

    // Get embeddings for all unique texts
    const embeddings = await Promise.all(
      uniqueTexts.map(text =>
        embed({
          model: openai.embedding('text-embedding-3-small'),
          value: text
        })
      )
    );

    // Create a map of text -> embedding
    const embeddingMap = new Map<string, number[]>();
    uniqueTexts.forEach((text, i) => {
      embeddingMap.set(text, embeddings[i].embedding);
    });

    // Calculate similarities for each pair
    return pairs.map(({ text1, text2 }) => {
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
