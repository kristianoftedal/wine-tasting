import { stripGenericTerms, norwegianLemmas } from '../lemmatizeAndWeight';
import { cosineSimilarity } from '../math';
import idfRaw from '../idf-weights.generated.json';
import type { TokenAlignment } from './types';

const idfWeights = idfRaw as Record<string, number>;

/**
 * The content words of a normalised note: what survives the generic-term
 * filter, deduplicated, in order of first appearance. Identical for every
 * engine so that engines differ only in their vectors.
 */
export function contentWords(norm: string): string[] {
  return [...new Set(stripGenericTerms(norm).split(' ').filter(Boolean))];
}

/**
 * idf multiplier for a content word, looked up by its lemma. The same file the
 * lexical side uses (`idf-weights.generated.json`), so the soft term and the
 * ladder agree on which descriptors are specific. 1.0 when unknown.
 */
export function idfWeight(word: string): number {
  const lemma = norwegianLemmas[word]?.lemma ?? word;
  return idfWeights[lemma] ?? 1.0;
}

export type WordVector = { word: string; vec: Float32Array };

/**
 * Directional MaxSim precision over the user's words: for each user word, the
 * best similarity to any reference word; then the weighted mean. Reference
 * words the user never wrote are never iterated, so omissions cannot lower
 * the result. This is the scoring objective written as a loop direction.
 *
 * Returns raw = Σ w·best / Σ w (0 when either side is empty) and one
 * alignment per user word that had a vector.
 */
export function maxSimPrecision(
  user: WordVector[],
  reference: WordVector[],
  weightOf: (word: string) => number = () => 1
): { raw: number; alignments: TokenAlignment[] } {
  if (!user.length || !reference.length) return { raw: 0, alignments: [] };
  let num = 0, den = 0;
  const alignments: TokenAlignment[] = [];
  for (const u of user) {
    let best = -Infinity, bestWord: string | null = null;
    for (const r of reference) {
      const sim = cosineSimilarity(u.vec, r.vec);
      if (sim > best) { best = sim; bestWord = r.word; }
    }
    const weight = weightOf(u.word);
    num += weight * best;
    den += weight;
    alignments.push({ word: u.word, best: bestWord, sim: best, weight });
  }
  return { raw: den > 0 ? num / den : 0, alignments };
}
