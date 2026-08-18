/**
 * Pure flavour-note scoring. No I/O, no 'use server' — so the benchmark
 * (scripts/benchmark-scoring.ts) exercises the same code production runs
 * instead of a reimplementation that can drift.
 *
 * The server wrapper in src/actions/similarity.ts supplies the one input this
 * module cannot compute itself: the token-level MaxSim value, which needs
 * embeddings. See src/lib/scoringConfig.ts for the objective and the reasoning
 * behind each constant.
 */
import { lemmatizeAndWeight, norwegianLemmas } from './lemmatizeAndWeight';
import { derivationSource, derivedFrom, isSpecificOfReference } from './derivations';
import {
  CREDIT_CATEGORY,
  CREDIT_DERIVED,
  CREDIT_DIRECT,
  CREDIT_SPECIFIC,
  CREDIT_SUBCATEGORY,
  HIT_WEIGHT,
  PRECISION_FLOOR,
  SATURATION_TAU,
  SOFT_SCALE,
  SOFT_WEIGHT,
} from './scoringConfig';

type LemmaInfo = { lemma: string; weight: number; main?: string; sub?: string };

/** How a user's descriptor earned credit, for the debug surface and UI feedback. */
export type MatchKind = 'direct' | 'derived' | 'specific' | 'subcategory' | 'category' | 'none';

export type TermMatch = {
  lemma: string;
  weight: number;
  kind: MatchKind;
  /**
   * The reference term that licensed the credit — the cause for `derived`
   * ("fat" for "vanilje"), the category term for `specific` ("frukt" for "solbær").
   */
  via?: string;
  credit: number;
};

export type LexicalCredit = {
  /** Weighted credit the user earned across all their descriptors. */
  hitMass: number;
  /** Total weighted mass the user wrote — the only denominator in play. */
  userMass: number;
  /**
   * Credit-weighted share of what the user wrote that earned anything, i.e.
   * hitMass / userMass. Counting a match as binary would let a note padded with
   * category near-misses keep full precision while inflating hitMass.
   */
  precision: number;
  /** Saturating reward on absolute hit mass, 0-100. */
  hitScore: number;
  matches: TermMatch[];
};

export type FlavourScoreBreakdown = LexicalCredit & {
  score: number;
  /** Scaled token-level MaxSim precision, 0-100. */
  softScore: number;
  /**
   * False when the reference note names no aroma at all — 18.7% of Vinmonopolet
   * taste notes describe only structure ("God fylde med lang tørr ettersmak.").
   * There is nothing for a taster to identify, so the component is excluded
   * rather than scored. Scoring it 0 would penalise them for the reference
   * being empty, which is the omission penalty wearing a different hat.
   */
  scoreable: boolean;
};

/**
 * Whether a reference note contains anything a taster could be graded on.
 * Structural and quality terms live under the GENERIC category and describe
 * body, acidity, length or overall impression rather than aroma.
 */
export function hasScoreableFlavour(preppedText: string): boolean {
  for (const info of lemmasWithWeight(preppedText).values()) {
    if (info.main && info.main !== 'GENERIC') return true;
  }
  return false;
}

/**
 * Extract lemmas with their active-profile weight and hierarchical category.
 * Dedupes per side by keeping the highest weight when the same lemma appears
 * twice. Unknown words (category `ukjent`) are skipped so they neither reward
 * nor penalise the score.
 */
export function lemmasWithWeight(text: string): Map<string, LemmaInfo> {
  const data = lemmatizeAndWeight(text);
  const out = new Map<string, LemmaInfo>();
  for (const item of data.lemmatized) {
    if (item.category === 'ukjent') continue;
    const path = (norwegianLemmas[item.original] ?? norwegianLemmas[item.lemma])?.categoryPath;
    const existing = out.get(item.lemma);
    if (!existing || item.weight > existing.weight) {
      out.set(item.lemma, { lemma: item.lemma, weight: item.weight, main: path?.main, sub: path?.sub });
    }
  }
  return out;
}

/**
 * Score every descriptor the user wrote against the reference note.
 *
 * The reference contributes a lookup set and nothing else — it never appears in
 * a denominator — so a descriptor the user omitted cannot lower the result.
 * Reward for naming more correct descriptors comes from `hitScore`, a saturating
 * function of absolute matched mass.
 *
 * Credit ladder, best match wins:
 *   direct       the reference names this exact lemma
 *   derived      the reference names something that implies it (fat -> vanilje)
 *   specific     the reference generalises over it (frukt -> solbær)
 *   subcategory  same (main, sub) path — right family, wrong specific
 *   category     same main category only
 *
 * Both arguments must already be sanitised and synonym-normalised.
 */
export function lexicalCredit(userText: string, referenceText: string): LexicalCredit {
  const user = lemmasWithWeight(userText);
  const reference = lemmasWithWeight(referenceText);

  const referenceLemmas = new Set(reference.keys());
  const derived = derivedFrom(referenceLemmas);
  const referenceSubPaths = new Set(
    [...reference.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`)
  );
  const referenceMains = new Set([...reference.values()].map(v => v.main).filter(Boolean));

  const matches: TermMatch[] = [];
  let hitMass = 0;
  let userMass = 0;

  for (const info of user.values()) {
    userMass += info.weight;

    let kind: MatchKind = 'none';
    let factor = 0;
    let via: string | undefined;

    if (referenceLemmas.has(info.lemma)) {
      kind = 'direct';
      factor = CREDIT_DIRECT;
    } else if (derived.has(info.lemma)) {
      kind = 'derived';
      factor = CREDIT_DERIVED;
      via = derivationSource(info.lemma, referenceLemmas) ?? undefined;
    } else if ((via = isSpecificOfReference(info, referenceLemmas) ?? undefined)) {
      kind = 'specific';
      factor = CREDIT_SPECIFIC;
    } else if (info.main && info.sub && referenceSubPaths.has(`${info.main}/${info.sub}`)) {
      kind = 'subcategory';
      factor = CREDIT_SUBCATEGORY;
    } else if (info.main && referenceMains.has(info.main)) {
      kind = 'category';
      factor = CREDIT_CATEGORY;
    }

    const credit = info.weight * factor;
    hitMass += credit;
    matches.push({ lemma: info.lemma, weight: info.weight, kind, via, credit });
  }

  matches.sort((a, b) => b.credit - a.credit || b.weight - a.weight);

  return {
    hitMass,
    userMass,
    precision: userMass > 0 ? hitMass / userMass : 0,
    hitScore: 100 * (1 - Math.exp(-hitMass / SATURATION_TAU)),
    matches,
  };
}

/**
 * Blend the lexical hit term with token-level MaxSim precision, then discount
 * by how much of what the user wrote actually earned credit.
 *
 * `softRaw` is a mean centered cosine in roughly [-0.15, 0.55]; pass 0 to score
 * on the lexical signal alone.
 */
export function combineScore(lexical: LexicalCredit, softRaw: number, scoreable = true): FlavourScoreBreakdown {
  const softScore = Math.max(0, Math.min(100, softRaw * SOFT_SCALE));
  const blended = HIT_WEIGHT * lexical.hitScore + SOFT_WEIGHT * softScore;
  const precisionFactor = PRECISION_FLOOR + (1 - PRECISION_FLOOR) * lexical.precision;
  const score = Math.round(Math.max(0, Math.min(100, blended * precisionFactor)));
  return { ...lexical, softScore, score, scoreable };
}
