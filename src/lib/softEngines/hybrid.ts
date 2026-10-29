import { norwegianLemmas } from '../lemmatizeAndWeight';
import { SOFT_SCALE } from '../scoringConfig';
import { rescale } from './baseline';
import type { LexicalCredit } from '../flavourScoring';
import type { SoftResult } from './types';

/**
 * Hybrid soft term: a word the ladder already credited is a full soft match.
 *
 * Why. Reading the per-field reasons across the frozen set
 * (scripts/validation-results/scores-by-engine-2026-10-29.csv) showed that
 * where the local engines score lower than OpenAI, it is almost never because
 * they matched different words. It is the scale on exact matches: an isolated
 * token vector gives cosine 1.0 for the same word on both sides; a contextual
 * vector sees the word in two different sentences and, after centring, gets a
 * raw cosine near 0.45 — about 28 soft credit for a word the ladder has
 * already confirmed as a direct hit. The soft term exists for words the
 * ladder cannot link; it has no business second-guessing the ones it can.
 *
 * So, per user content word: full credit (1.0) if the ladder gave it direct,
 * derived or specific credit; otherwise the engine's own similarity for that
 * word, put on 0–1 the same way the engine does (SOFT_SCALE for OpenAI, the
 * measured floor for the local engines). Weighted mean, times 100.
 *
 * Behind SOFT_HYBRID_ENABLED; measured by scripts/measure-hybrid-soft.ts.
 */
export const SOFT_HYBRID_ENABLED = process.env.SOFT_HYBRID_ENABLED === 'true';

const FULL = new Set(['direct', 'derived', 'specific']);

export function hybridSoftScore(result: SoftResult, lexical: LexicalCredit): number {
  if (!result.alignments.length) return result.softScore;
  const credited = new Set(lexical.matches.filter(m => FULL.has(m.kind)).map(m => m.lemma));
  let num = 0, den = 0;
  for (const a of result.alignments) {
    const lemma = norwegianLemmas[a.word]?.lemma ?? a.word;
    const engineCredit = result.engine === 'openai'
      ? Math.max(0, Math.min(1, (a.sim * SOFT_SCALE) / 100))
      : rescale(a.sim, result.baseline) / 100;
    const credit = credited.has(lemma) ? 1 : engineCredit;
    num += a.weight * credit;
    den += a.weight;
  }
  return den > 0 ? (num / den) * 100 : result.softScore;
}
