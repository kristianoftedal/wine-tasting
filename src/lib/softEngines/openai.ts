import { embedTokens } from '../tokenEmbeddings';
import { EMBEDDING_MODEL, SOFT_SCALE } from '../scoringConfig';
import { contentWords, maxSimPrecision, type WordVector } from './maxsim';
import type { NoteInput, SoftEngine, SoftResult } from './types';

/**
 * The engine in production since August 2026: each content word embedded on
 * its own with text-embedding-3-small, mean-centred against the corpus
 * (embeddingCentering.ts), plain-mean MaxSim precision, then `SOFT_SCALE`.
 *
 * Deliberately a plain mean rather than idf-weighted, and `SOFT_SCALE` rather
 * than a measured baseline: this engine must reproduce every stored score
 * bit for bit, since history is never recomputed. Improvements go into the
 * other engines, which are compared against this one.
 *
 * Centred cosine between unrelated descriptors sits near 0 and the useful
 * range is roughly [−0.15, 0.55], which is what `SOFT_SCALE` = 160 maps onto
 * 0–100. `baseline` is reported as 0: centring already removed the floor.
 */
export const openaiEngine: SoftEngine = {
  id: 'openai',
  model: EMBEDDING_MODEL,

  async available() {
    return process.env.OPENAI_API_KEY ? { ok: true } : { ok: false, reason: 'OPENAI_API_KEY er ikke satt' };
  },

  async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
    const started = performance.now();
    const userWords = contentWords(user.norm);
    const refWords = contentWords(reference.norm);
    const done = (raw: number, alignments: SoftResult['alignments']): SoftResult => ({
      engine: 'openai',
      model: EMBEDDING_MODEL,
      raw,
      baseline: 0,
      softScore: Math.max(0, Math.min(100, raw * SOFT_SCALE)),
      alignments,
      ms: performance.now() - started,
    });
    if (!userWords.length || !refWords.length) return done(0, []);

    const vectors = await embedTokens([...userWords, ...refWords]);
    const pick = (words: string[]): WordVector[] =>
      words.flatMap(word => { const vec = vectors.get(word); return vec ? [{ word, vec }] : []; });
    const { raw, alignments } = maxSimPrecision(pick(userWords), pick(refWords));
    return done(raw, alignments);
  },
};
