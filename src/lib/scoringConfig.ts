/**
 * Tunables for flavour-note scoring, in one place so the benchmark
 * (scripts/benchmark-scoring.ts) and production read identical values.
 *
 * Scoring objective
 * -----------------
 * Reward the taster for descriptors they correctly picked out; never penalise
 * them for descriptors they did not mention. That makes the metric *directional*:
 * the reference note is a lookup table, never a denominator.
 *
 * Three consequences, each measured on the 148-field tasting corpus:
 *
 *   1. The denominator is the user's own weighted mass. `max(user, wine)` is a
 *      recall penalty by construction (MISS -2.3) and lets a user inflate their
 *      score by padding with guesses (+WRONG +1.8, i.e. wrong guesses paid).
 *      `min(user, wine)` only avoids this while the user's note is the shorter
 *      one, so it is precision by coincidence rather than by construction.
 *
 *   2. Token similarity uses precision only. BERTScore-style F1 folds in a
 *      recall term — "for each reference token, how well did the user cover it"
 *      — which is exactly the omission penalty (MISS -2.2).
 *
 *   3. Sentence-level cosine is not used for smell/taste. Mean-pooling three
 *      tokens versus ten differs *because* of what is missing, so the omission
 *      penalty is baked into the pooling step and cannot be tuned out
 *      (MISS -3.3, the worst of any variant tested).
 *
 * Reward for accumulating correct picks comes from a saturating function of the
 * absolute matched mass, which has no wine-side denominator at all.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Soft-engine decision, 28 Oct 2026 (bert-integration-plan.md, phase 10).
 *
 * Two local engines were built behind src/lib/softEngines and measured on the
 * same benchmark and frozen set: NorBERT3 base (contextual word vectors) and
 * mLateOn (multilingual ColBERT), both int8 ONNX, both centred and rescaled
 * against a measured floor. Neither cleared the gate:
 *
 *                    +HIT  +WRONG   MISS  r(len)     d  top1%
 *   openai          +12.6    -3.2   +3.5    0.26  1.19     18
 *   bert             +9.9    -0.9   +2.0    0.35  0.92     10
 *   colbert-token    +9.6    -1.2   +1.8    0.32  0.94     12
 *
 * The isolated token embeddings reward a correct descriptor more, punish a
 * wrong one more, and separate the real wine from random ones better. The
 * local engines win only on MISS. mLateOn does find links the others miss
 * (brioche -> bakverk) and is better on one- to three-word references; that
 * is a fine-tuning lead, not a reason to switch. SOFT_ENGINE stays `openai`.
 */

/**
 * Written to `tastings.scorer_version` on every new tasting. Stored scores are
 * never recomputed (history is read-only, by decision), so this is how a score
 * from one engine is told apart from a score from the next. Bump it whenever
 * the number a taster sees would change for the same note: a new soft engine,
 * a constant below, a dictionary change that moves scores.
 */
export const SCORER_VERSION = 'directional-5:text-embedding-3-small'; // 2: synonym map grew (brioch, toasty, bakt, autolyse); 3: krydder no longer licenses specific credit; 4: lees-ageing derivations (kjeks/bakverk/brioche -> nøtt, mandel, smør) — 29 Oct 2026; 5: five specific-credit exceptions from the club's review (frukt↛sitrus/solbær/jordbær, sitrus↛grapefrukt, steinfrukt↛plomme) — 31 Oct 2026

/**
 * Saturation constant for matched mass, in weighted-lemma units where a
 * specific descriptor carries ~2.0 under the inverted profile.
 *
 *   1 correct specific descriptor  ->  49
 *   2                              ->  74
 *   3                              ->  87
 *   4                              ->  93
 *
 * Raise it to demand more descriptors for a high score; lower it to be more
 * generous to short notes.
 */
export const SATURATION_TAU = 3.0;

/**
 * Style-relative descriptor weights (src/lib/styleWeights.ts), behind
 * STYLE_WEIGHTS_ENABLED. The global idf multiplier is floored at 1.0 and
 * measured over the whole catalogue, so "sitrus" on a white earns as much as
 * "solbær" on a red; measured against 149 human ratings that was the scorer's
 * largest systematic error. With the flag on, a dictionary word's multiplier
 * is its idf over the median idf *within the wine's main category*, clamped
 * to [FLOOR, CAP]. The floor is what lets a default-for-the-style word earn
 * less than 1.0; it was tuned on the human ratings
 * (scripts/measure-style-weights.ts) — see the plan for the sweep.
 */
export const STYLE_WEIGHTS_ENABLED = process.env.STYLE_WEIGHTS_ENABLED === 'true';
export const STYLE_WEIGHT_FLOOR = 0.5;
export const STYLE_WEIGHT_CAP = 2.0;

/**
 * Credit ladder for a user lemma, as a fraction of its profile weight.
 *
 * A derivation hit scores as high as a direct hit: a taster who writes "vanilje"
 * on a wine the reference calls "fat" has correctly perceived barrel vanillin,
 * and that is exactly the skill being measured.
 *
 * The taxonomic tiers are lower than the 1.0 / 0.5 the previous implementation
 * used. Naming cherry when the wine shows raspberry is a near miss, not a
 * correct pick — both sit in Frukt og bær/baer, so the old rule paid it full
 * credit. Partial credit keeps the encouragement without calling it a hit.
 */
export const CREDIT_DIRECT = 1.0;
export const CREDIT_DERIVED = 1.0;
/**
 * The reference used a category term and the taster named something inside it
 * ("mørk frukt" -> "solbær"). Nearly a direct hit: the answer is correct and
 * more precise than the reference. Just short of 1.0 because the reference
 * never confirmed that specific descriptor.
 */
export const CREDIT_SPECIFIC = 0.85;
export const CREDIT_SUBCATEGORY = 0.6;
export const CREDIT_CATEGORY = 0.3;

/**
 * Blend between the lexical hit term and the soft token-similarity term.
 * The lexical side is exact and explainable; the soft side gives partial credit
 * for near-synonyms the dictionary does not link.
 */
export const HIT_WEIGHT = 0.55;
export const SOFT_WEIGHT = 0.45;

/**
 * Centered token cosine occupies roughly [-0.15, 0.55] on this corpus, so raw
 * values are rescaled onto 0-100 before blending.
 */
export const SOFT_SCALE = 160;

/**
 * How much a note padded with wrong guesses is discounted. `precision` is the
 * share of the user's weighted mass that matched anything at all; the score is
 * multiplied by (floor + (1 - floor) * precision).
 *
 * The floor is deliberately high. Perturbation tests that sample "wrong"
 * descriptors from other wines' notes overstate the true penalty, because wine
 * descriptors are causally linked (oak implies vanilla) and some sampled terms
 * are legitimate inferences rather than errors. A hard penalty would punish
 * good tasting; this discourages shotgunning without doing that.
 */
export const PRECISION_FLOOR = 0.6;
