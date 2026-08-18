'use server';

import { sanitizeText } from '@/lib/lemmatizeAndWeight';
import { rawSemanticSimilarity, tokenPrecisionSimilarity } from '@/lib/semanticSimilarity';
import { normalizeWineSynonyms } from '@/lib/synonymNormalization';
import { combineScore, hasScoreableFlavour, lexicalCredit, type FlavourScoreBreakdown } from '@/lib/flavourScoring';

export type { FlavourScoreBreakdown, MatchKind, TermMatch } from '@/lib/flavourScoring';

const EMPTY: FlavourScoreBreakdown = {
  score: 0, hitMass: 0, userMass: 0, precision: 0, hitScore: 0, softScore: 0, matches: [], scoreable: false,
};

/**
 * Full breakdown of a smell/taste score. The scoring itself lives in
 * src/lib/flavourScoring.ts as a pure function; this wrapper supplies the one
 * input that needs I/O — token embeddings for the MaxSim term.
 */
export async function scoreFlavourNote(
  userNote: string,
  referenceNote: string
): Promise<FlavourScoreBreakdown> {
  if (!userNote?.trim() || !referenceNote?.trim()) return EMPTY;

  try {
    const userNorm = normalizeWineSynonyms(sanitizeText(userNote));
    const referenceNorm = normalizeWineSynonyms(sanitizeText(referenceNote));

    if (!hasScoreableFlavour(referenceNorm)) return { ...EMPTY, scoreable: false };

    const lexical = lexicalCredit(userNorm, referenceNorm);
    const softRaw = await tokenPrecisionSimilarity(userNorm, referenceNorm);

    return combineScore(lexical, softRaw, true);
  } catch (error) {
    console.error('Flavour scoring error:', error);
    return EMPTY;
  }
}

/**
 * Colour comparison: embed text directly without any term stripping.
 * Colour descriptors ("lys rubinrød", "dyp gylden") would be corrupted by the
 * generic-term filter used for smell and taste, and the vocabulary is too small
 * for token-level matching to add anything.
 */
export async function semanticOnlySimilarity(text1: string, text2: string): Promise<number> {
  if (!text1?.trim() || !text2?.trim()) return 0;
  return rawSemanticSimilarity(text1, text2);
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
