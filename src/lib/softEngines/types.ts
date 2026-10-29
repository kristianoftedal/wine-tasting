/**
 * The soft term of the flavour score, behind one interface.
 *
 * The lexical half of the score (src/lib/flavourScoring.ts) is exact and
 * explainable. The soft half gives partial credit for near-synonyms the
 * dictionary does not link, and is the only part that depends on a model.
 * Production, the regression benchmark and /scoring-demo all consume this
 * interface, so an engine is compared on the same code path it would ship on.
 *
 * Every engine returns a 0–100 `softScore` ready for `combineScoreScaled`, its
 * engine-native `raw` value and the baseline it was rescaled against, and one
 * alignment per user content word: which reference word it matched and how
 * well. The alignments are what a reviewer looks at when two engines disagree.
 */

export type SoftEngineId = 'openai' | 'bert' | 'bert-iso' | 'colbert-word' | 'colbert-token' | 'colbert-iso';

/** `-iso` variants encode each content word on its own, as the OpenAI engine does, instead of the whole note. */
export const SOFT_ENGINE_IDS: readonly SoftEngineId[] = ['openai', 'bert', 'bert-iso', 'colbert-word', 'colbert-token', 'colbert-iso'];

export type TokenAlignment = {
  /** The user's content word (after sanitising and synonym normalisation). */
  word: string;
  /** The reference content word it matched best, or null if the engine had no vector for it. */
  best: string | null;
  /** Engine-native similarity of that pair (cosine for every current engine). */
  sim: number;
  /** Weight the word carried in the mean (1.0 for the OpenAI engine, idf for the others). */
  weight: number;
};

export type SoftResult = {
  engine: SoftEngineId;
  model: string;
  /** Engine-native MaxSim precision before any rescale. */
  raw: number;
  /** Baseline b the rescale used; 0 for an engine that centres instead. */
  baseline: number;
  /** 0–100, what the combine step consumes. */
  softScore: number;
  alignments: TokenAlignment[];
  ms: number;
};

/**
 * One note, in the two forms engines need. `norm` is what the credit ladder
 * sees (negation applied, sanitised, synonym-normalised): the content words
 * are taken from it so every engine scores the same word set. `raw` is the
 * lightly cleaned original (negation applied, nothing else) for engines that
 * need the words in context.
 */
export type NoteInput = { raw: string; norm: string };

export type Availability = { ok: boolean; reason?: string };

export interface SoftEngine {
  readonly id: SoftEngineId;
  readonly model: string;
  available(): Promise<Availability>;
  score(user: NoteInput, reference: NoteInput): Promise<SoftResult>;
}

/** The result shape when an engine could not run; the demo shows the reason. */
export type SoftEngineUnavailable = { engine: SoftEngineId; model: string; available: false; reason: string };
