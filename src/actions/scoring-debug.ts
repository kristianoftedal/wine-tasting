'use server';

import { sanitizeText, norwegianLemmas, stripGenericTerms, flavorOnlyText } from '@/lib/lemmatizeAndWeight';
import { scoreFlavourNote } from '@/actions/similarity';
import type { TermMatch } from '@/lib/flavourScoring';
import { getCategoryWeight } from '@/lib/profiles';
import { PorterStemmerNo } from 'natural';
import idfRaw from '@/lib/idf-weights.generated.json';
import { normalizeWineSynonyms } from '@/lib/synonymNormalization';
import { applyNegation } from '@/lib/negation';
import { combineScoreScaled, lexicalCredit } from '@/lib/flavourScoring';
import { getSoftEngineById, listSoftEngines as listEngines, type SoftEngineId, type SoftResult, type SoftEngineUnavailable, type TokenAlignment } from '@/lib/softEngines';
import { OOV_MAPPING_ENABLED, OOV_THRESHOLD, isUnknownWord, nearestAromaLemmas, type OovMapping } from '@/lib/oovMapping';

const idfWeights = idfRaw as Record<string, number>;

/**
 * Explanation surface for the smell/taste score, used by /scoring-demo and the
 * tasting summary. It decomposes the *current* scorer only: the score itself
 * comes from `scoreFlavourNote`, so nothing here can drift from production.
 *
 * The previous algorithm (max-denominator overlap plus sentence cosine) used
 * to be computed alongside for comparison. It is gone from here; the
 * regression benchmark in scripts/benchmark-scoring.ts still carries it as the
 * "previous" row, which is the one place that comparison is still needed.
 */

export type TermDetail = {
  original: string;
  lemma: string;
  category: string;
  main: string;
  sub: string;
  baseWeight: number;
  idfMultiplier: number;
  finalWeight: number;
  foundViaPorter: boolean;
  matched: boolean;
};

export type ScoringBreakdown = {
  // Directional flavour scoring (see src/lib/scoringConfig.ts)
  hitMass: number;
  userMass: number;
  hitScore: number;
  softScore: number;
  precision: number;
  currentScore: number;
  scoreable: boolean;
  matches: TermMatch[];
  negated: string[];
  contradicted: string[];
  /**
   * Unknown words and the aroma lemma they are nearest to. `applied` is true
   * when OOV_MAPPING_ENABLED is on and the cosine cleared the threshold, i.e.
   * the score above used the mapping; otherwise it is shown as a suggestion.
   */
  unknownWords: Array<OovMapping & { applied: boolean }>;
  oovThreshold: number;
  /** Which engine produced softScore / currentScore, and its per-word alignments. */
  engine: SoftEngineId | null;
  alignments: TokenAlignment[];
  /**
   * The same note pair scored by other soft engines, for the side-by-side on
   * /scoring-demo. `combinedScore` is what the total would be with that engine;
   * `delta` is against `currentScore`. Never used for production scoring.
   */
  softEngines: SoftEngineComparison[];
  // Term details
  userTerms: TermDetail[];
  wineTerms: TermDetail[];
  // All tokens after sanitization — includes unrecognized/filtered tokens
  userRawTokens: string[];
  wineRawTokens: string[];
  // Tokens the soft term actually sees: generic/structural terms stripped
  userFlavorTokens: string[];
  wineFlavorTokens: string[];
};

export type SoftEngineComparison =
  | (SoftResult & { available: true; combinedScore: number; delta: number })
  | SoftEngineUnavailable;

type InternalTerm = {
  lemma: string;
  baseWeight: number;
  idfMultiplier: number;
  finalWeight: number;
  main: string;
  sub: string;
  original: string;
  category: string;
  foundViaPorter: boolean;
};

function extractTerms(text: string): Map<string, InternalTerm> {
  const tokens = sanitizeText(text).split(' ').filter(Boolean);
  const out = new Map<string, InternalTerm>();

  for (const token of tokens) {
    let entry = norwegianLemmas[token];
    let foundViaPorter = false;

    if (!entry) {
      const stem = PorterStemmerNo.stem(token);
      if (stem !== token) {
        entry = norwegianLemmas[stem];
        if (entry) foundViaPorter = true;
      }
    }

    if (!entry) {
      const normalized = token.replace(/ae/g, 'æ').replace(/oe/g, 'ø').replace(/aa/g, 'å');
      if (normalized !== token) entry = norwegianLemmas[normalized];
    }

    if (!entry) continue;

    const main = entry.categoryPath?.main ?? 'GENERIC';
    const sub = entry.categoryPath?.sub ?? '';
    const baseWeight = getCategoryWeight(main as Parameters<typeof getCategoryWeight>[0]);
    const idfMultiplier = idfWeights[entry.lemma] ?? 1.0;
    const finalWeight = baseWeight * idfMultiplier;

    const existing = out.get(entry.lemma);
    if (!existing || finalWeight > existing.finalWeight) {
      out.set(entry.lemma, {
        lemma: entry.lemma, baseWeight, idfMultiplier, finalWeight,
        main, sub, original: token, category: entry.category, foundViaPorter,
      });
    }
  }
  return out;
}

function toDetailFn(map: Map<string, InternalTerm>, matched: Set<string>): TermDetail[] {
  return [...map.values()].map(t => ({
    original: t.original,
    lemma: t.lemma,
    category: t.category,
    main: t.main,
    sub: t.sub,
    baseWeight: parseFloat(t.baseWeight.toFixed(2)),
    idfMultiplier: parseFloat(t.idfMultiplier.toFixed(3)),
    finalWeight: parseFloat(t.finalWeight.toFixed(3)),
    foundViaPorter: t.foundViaPorter,
    matched: matched.has(t.lemma),
  }));
}

// ── Lightweight term breakdown (no embedding call) ───────────────────────────

export type NoteTermBreakdown = {
  rawTokens: string[];
  terms: TermDetail[];
  flavorTokens: string[];
  /** Words the taster negated; they are absent from the lists above. */
  negated: string[];
};

export async function getTermBreakdown(
  userNote: string,
  wineNote: string
): Promise<NoteTermBreakdown> {
  if (!userNote.trim()) return { rawTokens: [], terms: [], flavorTokens: [], negated: [] };
  const user = applyNegation(userNote);
  const wine = applyNegation(wineNote);
  const userMap = extractTerms(user.text);
  const wineMap = extractTerms(wine.text);
  const matchedLemmas = new Set([...userMap.keys()].filter(k => wineMap.has(k)));
  return {
    rawTokens: sanitizeText(user.text).split(' ').filter(Boolean),
    terms: toDetailFn(userMap, matchedLemmas),
    flavorTokens: flavorOnlyText(user.text).split(' ').filter(Boolean),
    negated: user.negated,
  };
}

// ── Main export ────────────────────────────────────────────────────────────

export async function listSoftEngines() {
  return listEngines();
}

export async function getScoringBreakdown(
  userNote: string,
  wineNote: string,
  options: { engines?: SoftEngineId[] } = {}
): Promise<ScoringBreakdown> {
  const user = applyNegation(userNote);
  const wine = applyNegation(wineNote);
  const userProcessed = normalizeWineSynonyms(sanitizeText(user.text));
  const wineProcessed = normalizeWineSynonyms(sanitizeText(wine.text));

  const [flavour, userMap, wineMap] = await Promise.all([
    scoreFlavourNote(userNote, wineNote),
    Promise.resolve(extractTerms(userProcessed)),
    Promise.resolve(extractTerms(wineProcessed)),
  ]);

  // Other engines on the same pair. Each runs independently so one missing
  // model cannot hide the others; the lexical half is shared.
  const lexical = flavour.scoreable ? lexicalCredit(userProcessed, wineProcessed) : null;
  const softEngines: SoftEngineComparison[] = await Promise.all(
    (options.engines ?? []).map(async (id): Promise<SoftEngineComparison> => {
      const engine = getSoftEngineById(id);
      const a = await engine.available();
      if (!a.ok) return { engine: id, model: engine.model, available: false, reason: a.reason ?? 'ukjent årsak' };
      try {
        const result = await engine.score({ raw: user.text, norm: userProcessed }, { raw: wine.text, norm: wineProcessed });
        const combinedScore = lexical ? combineScoreScaled(lexical, result.softScore, true).score : 0;
        return { ...result, available: true, combinedScore, delta: combinedScore - flavour.score };
      } catch (e) {
        return { engine: id, model: engine.model, available: false, reason: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  const matchedLemmas = new Set([...userMap.keys()].filter(k => wineMap.has(k)));

  // What the taster wrote that the dictionary does not know, and where it
  // would land. Shown whether or not mapping is on, so the demo can judge it.
  const unknown = userProcessed.split(' ').filter(isUnknownWord);
  const nearest = unknown.length ? await nearestAromaLemmas(unknown) : new Map();
  const applied = new Set((flavour.mapped ?? []).map(m => m.from));
  const unknownWords = unknown.flatMap(w => {
    const n = nearest.get(w);
    return n ? [{ from: w, to: n.lemma, sim: n.sim, applied: OOV_MAPPING_ENABLED && applied.has(w) }] : [];
  });

  return {
    hitMass: parseFloat(flavour.hitMass.toFixed(2)),
    userMass: parseFloat(flavour.userMass.toFixed(2)),
    hitScore: parseFloat(flavour.hitScore.toFixed(1)),
    softScore: parseFloat(flavour.softScore.toFixed(1)),
    precision: parseFloat(flavour.precision.toFixed(3)),
    currentScore: flavour.score,
    scoreable: flavour.scoreable,
    matches: flavour.matches,
    negated: flavour.negated ?? [],
    contradicted: flavour.contradicted ?? [],
    unknownWords,
    oovThreshold: OOV_THRESHOLD,
    engine: flavour.engine ?? null,
    alignments: flavour.alignments ?? [],
    softEngines,
    userTerms: toDetailFn(userMap, matchedLemmas),
    wineTerms: toDetailFn(wineMap, matchedLemmas),
    userRawTokens: sanitizeText(user.text).split(' ').filter(Boolean),
    wineRawTokens: sanitizeText(wine.text).split(' ').filter(Boolean),
    userFlavorTokens: stripGenericTerms(userProcessed).split(' ').filter(Boolean),
    wineFlavorTokens: stripGenericTerms(wineProcessed).split(' ').filter(Boolean),
  };
}
