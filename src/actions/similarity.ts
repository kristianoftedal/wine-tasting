'use server';

import { sanitizeText, stripPunctuation } from '@/lib/lemmatizeAndWeight';
import { applyNegation } from '@/lib/negation';
import { rawSemanticSimilarity } from '@/lib/semanticSimilarity';
import { getSoftEngine } from '@/lib/softEngines';
import { normalizeWineSynonyms } from '@/lib/synonymNormalization';
import { combineScoreScaled, hasScoreableFlavour, lemmasWithWeight, lexicalCredit, type FlavourScoreBreakdown } from '@/lib/flavourScoring';

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
  referenceNote: string
): Promise<FlavourScoreBreakdown> {
  if (!userNote?.trim() || !referenceNote?.trim()) return EMPTY;

  try {
    // Negation first: "ikke noe fat" must not reach the ladder as "fat".
    const user = applyNegation(userNote);
    const reference = applyNegation(referenceNote);
    const userNorm = normalizeWineSynonyms(sanitizeText(user.text));
    const referenceNorm = normalizeWineSynonyms(sanitizeText(reference.text));

    if (!hasScoreableFlavour(referenceNorm)) return { ...EMPTY, scoreable: false, negated: user.negated };

    const lexical = lexicalCredit(userNorm, referenceNorm);
    const soft = await getSoftEngine().score(
      { raw: user.text, norm: userNorm },
      { raw: reference.text, norm: referenceNorm }
    );

    const breakdown = { ...combineScoreScaled(lexical, soft.softScore, true), engine: soft.engine, alignments: soft.alignments };
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
export async function serverSideSimilarity(text1: string, text2: string): Promise<number | null> {
  const { score, scoreable } = await scoreFlavourNote(text1, text2);
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
  wineTaste: string
): Promise<{ colorScore: number; smellScore: number | null; tasteScore: number | null }> {
  const [colorScore, smellScore, tasteScore] = await Promise.all([
    userFarge && wineColor ? semanticOnlySimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? serverSideSimilarity(userLukt, wineSmell) : Promise.resolve(null),
    userSmak && wineTaste ? serverSideSimilarity(userSmak, wineTaste) : Promise.resolve(null),
  ]);

  return { colorScore, smellScore, tasteScore };
}
