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
import { HYPERNYMS, derivationSource, derivedFrom, isSpecificOfReference } from './derivations';
import type { SoftEngineId, TokenAlignment } from './softEngines/types';
import type { OovMapping } from './oovMapping';
import idfRaw from './idf-weights.generated.json';
import { styleMultiplier } from './styleWeights';
import { FAMILY_CREDIT, LINEAR_MASS_FOR_FULL, STYLE_WEIGHTS_ENABLED } from './scoringConfig';

const globalIdf = idfRaw as Record<string, number>;

/** Per-call scoring context: the wine's style, and whether to weight by it. */
export type ScoringOptions = { category?: string | null; styleWeights?: boolean; /** Override of STYLE_WEIGHT_FLOOR, for the tuning sweep only. */ styleFloor?: number; /** Ladder-credited words count as full soft matches (src/lib/softEngines/hybrid.ts). */ hybridSoft?: boolean; /** Tuning overrides for the `specific` tier: its credit, and category words that must not license it. */ specificCredit?: number; hypernymExclude?: readonly string[]; /** Tuning overrides for the combine constants (scripts/tune-combine-constants.ts). */ tau?: number; hitWeight?: number; precisionFloor?: number; /** Extra derivation edges under test (scripts/measure-options.ts). */ extraDerivations?: Record<string, readonly string[]>; /** Leave structural (GENERIC) words out of the ladder entirely; under test. */ ignoreGeneric?: boolean; /** Override of SPECIFIC_EXCEPTIONS ({} = none), for measurement. */ specificExceptions?: Record<string, readonly string[]>;
  /** Statement 1 (31 Oct 2026): a linear reward that reaches 100 at this hit mass, instead of the saturating curve. */ linearMassForFull?: number;
  /** Statement 2: family-tier credits, and whether naming the family word of a reference member counts as a family hit. */ subcategoryCredit?: number; categoryCredit?: number; familyCredit?: boolean };
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
  /** Which soft engine produced softScore (src/lib/softEngines). */
  engine?: SoftEngineId;
  /** Per user content word: the reference word it matched best. */
  alignments?: TokenAlignment[];
  /** Unknown words read as a dictionary lemma ("toasty" → "toast"), when OOV mapping is on. */
  mapped?: OovMapping[];
  /** Descriptors the taster negated ("ikke noe fat"); removed before scoring. */
  negated?: string[];
  /** Negated descriptors the reference nevertheless names. Reported, not scored. */
  contradicted?: string[];
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
export function lemmasWithWeight(text: string, options: ScoringOptions = {}): Map<string, LemmaInfo> {
  const data = lemmatizeAndWeight(text);
  const useStyle = (options.styleWeights ?? STYLE_WEIGHTS_ENABLED) && !!options.category;
  const out = new Map<string, LemmaInfo>();
  for (const item of data.lemmatized) {
    if (item.category === 'ukjent') continue;
    const path = (norwegianLemmas[item.original] ?? norwegianLemmas[item.lemma])?.categoryPath;
    if (options.ignoreGeneric && (!path?.main || path.main === 'GENERIC')) continue;
    let weight = item.weight;
    if (useStyle && path?.main && path.main !== 'GENERIC') {
      // item.weight is profile × global idf; swap the global multiplier for
      // the style one when the style table has this lemma.
      const style = styleMultiplier(item.lemma, options.category, options.styleFloor);
      if (style !== null) weight = (item.weight / (globalIdf[item.lemma] ?? 1)) * style;
    }
    const existing = out.get(item.lemma);
    if (!existing || weight > existing.weight) {
      out.set(item.lemma, { lemma: item.lemma, weight, main: path?.main, sub: path?.sub });
    }
  }
  return out;
}

/** The reference lemma inside the family the user's lemma names, if any ("bær" → "solbær"). */
function familyMember(userLemma: string, reference: Map<string, LemmaInfo>): string | null {
  const scope = HYPERNYMS[userLemma];
  if (!scope) return null;
  for (const info of reference.values()) {
    if (info.lemma === userLemma || !info.main || info.main === 'GENERIC') continue;
    if (scope.main === info.main && (!scope.sub || scope.sub === info.sub)) return info.lemma;
  }
  return null;
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
export function lexicalCredit(userText: string, referenceText: string, options: ScoringOptions = {}): LexicalCredit {
  const user = lemmasWithWeight(userText, options);
  const reference = lemmasWithWeight(referenceText, options);

  const referenceLemmas = new Set(reference.keys());
  const derived = derivedFrom(referenceLemmas);
  if (options.extraDerivations) for (const l of referenceLemmas) for (const d of options.extraDerivations[l] ?? []) derived.add(d);
  const specificCredit = options.specificCredit ?? CREDIT_SPECIFIC;
  const licensing = options.hypernymExclude?.length
    ? new Set([...referenceLemmas].filter(l => !options.hypernymExclude!.includes(l)))
    : referenceLemmas;
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
    } else if ((via = isSpecificOfReference(info, licensing, options.specificExceptions) ?? undefined)) {
      kind = 'specific';
      factor = specificCredit;
    } else if (info.main && info.sub && referenceSubPaths.has(`${info.main}/${info.sub}`)) {
      kind = 'subcategory';
      factor = options.subcategoryCredit ?? CREDIT_SUBCATEGORY;
    } else if ((options.familyCredit ?? FAMILY_CREDIT) && (via = familyMember(info.lemma, reference) ?? undefined)) {
      // The taster named the family ("bær", "krydder") and the reference
      // names a member of it ("solbær", "pepper"): the reverse of `specific`,
      // paid at the subcategory rate. Statement 2 of the 31 Oct 2026 sweep.
      kind = 'subcategory';
      factor = options.subcategoryCredit ?? CREDIT_SUBCATEGORY;
    } else if (info.main && referenceMains.has(info.main)) {
      kind = 'category';
      factor = options.categoryCredit ?? CREDIT_CATEGORY;
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
    hitScore: (options.linearMassForFull ?? LINEAR_MASS_FOR_FULL)
      ? Math.min(100, (100 * hitMass) / (options.linearMassForFull ?? LINEAR_MASS_FOR_FULL)!)
      : 100 * (1 - Math.exp(-hitMass / (options.tau ?? SATURATION_TAU))),
    matches,
  };
}

/**
 * Blend the lexical hit term with a soft score already on 0–100, then discount
 * by how much of what the user wrote actually earned credit. This is the step
 * every soft engine feeds; how an engine gets its value onto 0–100 (centring
 * and `SOFT_SCALE` for OpenAI, a measured baseline for the others) is the
 * engine's business, not this function's.
 */
export function combineScoreScaled(lexical: LexicalCredit, softScore: number, scoreable = true, options: ScoringOptions = {}): FlavourScoreBreakdown {
  const soft = Math.max(0, Math.min(100, softScore));
  const hitWeight = options.hitWeight ?? HIT_WEIGHT;
  const softWeight = options.hitWeight !== undefined ? 1 - options.hitWeight : SOFT_WEIGHT;
  const floor = options.precisionFloor ?? PRECISION_FLOOR;
  const blended = hitWeight * lexical.hitScore + softWeight * soft;
  const precisionFactor = floor + (1 - floor) * lexical.precision;
  const score = Math.round(Math.max(0, Math.min(100, blended * precisionFactor)));
  return { ...lexical, softScore: soft, score, scoreable };
}

/**
 * The OpenAI engine's path, kept for callers that have a raw centred cosine:
 * `softRaw` in roughly [-0.15, 0.55] is scaled by `SOFT_SCALE` and combined.
 * Pass 0 to score on the lexical signal alone.
 */
export function combineScore(lexical: LexicalCredit, softRaw: number, scoreable = true): FlavourScoreBreakdown {
  return combineScoreScaled(lexical, softRaw * SOFT_SCALE, scoreable);
}
