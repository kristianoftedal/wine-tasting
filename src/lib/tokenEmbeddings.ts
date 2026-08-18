'use server';

import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { EMBEDDING_MODEL } from './scoringConfig';
import { centerEmbedding } from './embeddingCentering';

/**
 * Cache of centered embeddings for individual flavour descriptors.
 *
 * The descriptor vocabulary is small and closed — 892 distinct tokens across
 * 6 000 reference notes — so after warm-up almost every scoring request is
 * served entirely from memory. Misses for one request are resolved in a single
 * `embedMany` call rather than one HTTP round trip per token.
 *
 * This replaces per-request sentence embedding of wine notes. Reference notes
 * are static Vinmonopolet text, so re-embedding them on every tasting was
 * paying repeatedly for a fixed answer.
 */
const tokenCache = new Map<string, Float32Array>();

/** Bounded so a flood of typos cannot grow the cache without limit. */
const MAX_CACHE_ENTRIES = 20_000;

export async function embedTokens(tokens: string[]): Promise<Map<string, Float32Array>> {
  const wanted = [...new Set(tokens.filter(Boolean))];
  const missing = wanted.filter(t => !tokenCache.has(t));

  if (missing.length > 0) {
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: missing,
      });
      if (tokenCache.size + missing.length > MAX_CACHE_ENTRIES) tokenCache.clear();
      missing.forEach((token, i) => tokenCache.set(token, centerEmbedding(embeddings[i])));
    } catch (error) {
      console.error('Token embedding error:', error);
      // Fall through: callers treat absent tokens as "no soft signal" rather
      // than failing the whole score.
    }
  }

  const out = new Map<string, Float32Array>();
  for (const token of wanted) {
    const vec = tokenCache.get(token);
    if (vec) out.set(token, vec);
  }
  return out;
}

export async function tokenCacheSize(): Promise<number> {
  return tokenCache.size;
}
