'use server';

import { sanitizeText, stripPunctuation } from '@/lib/lemmatizeAndWeight';
import { applyNegation } from '@/lib/negation';
import { rawSemanticSimilarity } from '@/lib/semanticSimilarity';
import { getSoftEngine, getSoftEngineById, isSoftEngineId } from '@/lib/softEngines';
import { OOV_MAPPING_ENABLED, mapUnknownWords } from '@/lib/oovMapping';
import { normalizeWineSynonyms } from '@/lib/synonymNormalization';
import { combineScoreScaled, hasScoreableFlavour, lemmasWithWeight, lexicalCredit, type FlavourScoreBreakdown, type ScoringOptions } from '@/lib/flavourScoring';
import { normalizeCategory } from '@/lib/styleWeights';
import { SOFT_HYBRID_ENABLED, hybridSoftScore } from '@/lib/softEngines/hybrid';

export type { FlavourScoreBreakdown, MatchKind, TermMatch } from '@/lib/flavourScoring';

const EMPTY: FlavourScoreBreakdown = {
  score: 0, hitMass: 0, userMass: 0, precision: 0, hitScore: 0, softScore: 0, matches: [], scoreable: false,
};

/**
 * Full breakdown of a smell/taste score. The scoring itself lives in
 * src/lib/flavourScoring.ts as a pure function; this wrapper supplies the one
 * input that needs I/O — the soft term, from whichever engine `SOFT_ENGINE`
 * selects (src/lib/softEngines, default: OpenAI token embeddings).
 */
export async function scoreFlavourNote(
  userNote: string,
  referenceNote: string,
  options: ScoringOptions = {}
): Promise<FlavourScoreBreakdown> {
  if (!userNote?.trim() || !referenceNote?.trim()) return EMPTY;
  const scoring: ScoringOptions = { ...options, category: normalizeCategory(options.category) };

  try {
    // Negation first: "ikke noe fat" must not reach the ladder as "fat".
    const user = applyNegation(userNote);
    const reference = applyNegation(referenceNote);
    const referenceNorm = normalizeWineSynonyms(sanitizeText(reference.text));
    let userNorm = normalizeWineSynonyms(sanitizeText(user.text));

    if (!hasScoreableFlavour(referenceNorm)) return { ...EMPTY, scoreable: false, negated: user.negated };

    // Unknown-word mapping (phase 12): only the user's side, only above the
    // tuned threshold, and every mapping is reported so the taster sees it.
    const mapped = OOV_MAPPING_ENABLED ? await mapUnknownWords(userNorm) : null;
    if (mapped) userNorm = mapped.text;

    const lexical = lexicalCredit(userNorm, referenceNorm, scoring);
    const engine = getSoftEngine();
    const soft = await engine.score(
      { raw: user.text, norm: userNorm },
      { raw: reference.text, norm: referenceNorm }
    );
    const softScore = (scoring.hybridSoft ?? SOFT_HYBRID_ENABLED) ? hybridSoftScore(soft, lexical) : soft.softScore;
    await shadowScore(engine.id, lexical, softScore, { raw: user.text, norm: userNorm }, { raw: reference.text, norm: referenceNorm });

    const breakdown = {
      ...combineScoreScaled(lexical, softScore, true),
      engine: soft.engine,
      alignments: soft.alignments,
      ...(mapped && mapped.mapped.length ? { mapped: mapped.mapped } : {}),
    };
    if (user.negated.length === 0) return breakdown;

    // A negated descriptor the wine does show is a wrong call in the other
    // direction. Surfaced for the UI; the score ignores it for now.
    const referenceLemmas = new Set(lemmasWithWeight(referenceNorm).keys());
    const negatedLemmas = lemmasWithWeight(normalizeWineSynonyms(sanitizeText(user.negated.join(' '))));
    const contradicted = [...negatedLemmas.keys()].filter(l => referenceLemmas.has(l));
    return { ...breakdown, negated: user.negated, contradicted };
  } catch (error) {
    console.error('Flavour scoring error:', error);
    return EMPTY;
  }
}

/**
 * Shadow mode (phase 11): with SOFT_ENGINE_SHADOW set to another engine, every
 * production score is also computed with that engine and the pair is logged.
 * Nothing is written and the response is unchanged; it costs one extra score
 * per field while it is on. Reading the log over two events is the agreed
 * precondition for switching SOFT_ENGINE.
 */
async function shadowScore(
  active: string,
  lexical: ReturnType<typeof lexicalCredit>,
  activeSoft: number,
  user: { raw: string; norm: string },
  reference: { raw: string; norm: string }
): Promise<void> {
  const wanted = process.env.SOFT_ENGINE_SHADOW;
  if (!wanted || wanted === active || !isSoftEngineId(wanted)) return;
  try {
    const shadow = getSoftEngineById(wanted);
    if (!(await shadow.available()).ok) return;
    const result = await shadow.score(user, reference);
    const a = combineScoreScaled(lexical, activeSoft, true).score;
    const b = combineScoreScaled(lexical, result.softScore, true).score;
    console.info('[soft-shadow]', JSON.stringify({ active, score: a, shadow: wanted, shadowScore: b, delta: b - a, ms: Math.round(result.ms) }));
  } catch (error) {
    console.warn('[soft-shadow] failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Colour comparison: embed text whole without any term stripping.
 * Colour descriptors ("lys rubinrød", "dyp gylden") would be corrupted by the
 * generic-term filter used for smell and taste, and the vocabulary is too small
 * for token-level matching to add anything.
 *
 * Punctuation is still removed on both sides. The catalogue's colour notes are
 * sentences ("Dyp rubinrød.", "Lys gul, grønnlig skjær.") while the taster
 * types a bare phrase, and that formatting difference is not something the
 * taster should be graded on.
 */
export async function semanticOnlySimilarity(text1: string, text2: string): Promise<number> {
  const a = stripPunctuation(text1 ?? '');
  const b = stripPunctuation(text2 ?? '');
  if (!a || !b) return 0;
  return rawSemanticSimilarity(a, b);
}

/**
 * Numeric-only wrapper. Returns null when the reference note names no aroma, so
 * callers can drop the component from the overall average instead of averaging
 * in a zero the taster did not earn.
 */
export async function serverSideSimilarity(text1: string, text2: string, category?: string | null): Promise<number | null> {
  const { score, scoreable } = await scoreFlavourNote(text1, text2, { category });
  return scoreable ? score : null;
}

/**
 * Calculate all server-side similarity scores for a tasting in one server call.
 * - Colour uses sentence-level semantic similarity
 * - Smell and taste use directional flavour scoring
 */
export async function calculateServerSideScores(
  userFarge: string,
  userLukt: string,
  userSmak: string,
  wineColor: string,
  wineSmell: string,
  wineTaste: string,
  wineCategory?: string | null
): Promise<{ colorScore: number; smellScore: number | null; tasteScore: number | null }> {
  const [colorScore, smellScore, tasteScore] = await Promise.all([
    userFarge && wineColor ? semanticOnlySimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? serverSideSimilarity(userLukt, wineSmell, wineCategory) : Promise.resolve(null),
    userSmak && wineTaste ? serverSideSimilarity(userSmak, wineTaste, wineCategory) : Promise.resolve(null),
  ]);

  return { colorScore, smellScore, tasteScore };
}
