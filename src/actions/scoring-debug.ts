'use server';

import { sanitizeText, norwegianLemmas, stripGenericTerms, flavorOnlyText } from '@/lib/lemmatizeAndWeight';
import { scoreFlavourNote } from '@/actions/similarity';
import type { TermMatch } from '@/lib/flavourScoring';
import { getCategoryWeight } from '@/lib/profiles';
import { PorterStemmerNo } from 'natural';
import idfRaw from '@/lib/idf-weights.generated.json';
import { normalizeWineSynonyms } from '@/lib/synonymNormalization';

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
};

export async function getTermBreakdown(
  userNote: string,
  wineNote: string
): Promise<NoteTermBreakdown> {
  if (!userNote.trim()) return { rawTokens: [], terms: [], flavorTokens: [] };
  const userMap = extractTerms(userNote);
  const wineMap = extractTerms(wineNote);
  const matchedLemmas = new Set([...userMap.keys()].filter(k => wineMap.has(k)));
  return {
    rawTokens: sanitizeText(userNote).split(' ').filter(Boolean),
    terms: toDetailFn(userMap, matchedLemmas),
    flavorTokens: flavorOnlyText(userNote).split(' ').filter(Boolean),
  };
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getScoringBreakdown(userNote: string, wineNote: string): Promise<ScoringBreakdown> {
  const userProcessed = normalizeWineSynonyms(sanitizeText(userNote));
  const wineProcessed = normalizeWineSynonyms(sanitizeText(wineNote));

  const [flavour, userMap, wineMap] = await Promise.all([
    scoreFlavourNote(userNote, wineNote),
    Promise.resolve(extractTerms(userProcessed)),
    Promise.resolve(extractTerms(wineProcessed)),
  ]);

  const matchedLemmas = new Set([...userMap.keys()].filter(k => wineMap.has(k)));

  return {
    hitMass: parseFloat(flavour.hitMass.toFixed(2)),
    userMass: parseFloat(flavour.userMass.toFixed(2)),
    hitScore: parseFloat(flavour.hitScore.toFixed(1)),
    softScore: parseFloat(flavour.softScore.toFixed(1)),
    precision: parseFloat(flavour.precision.toFixed(3)),
    currentScore: flavour.score,
    scoreable: flavour.scoreable,
    matches: flavour.matches,
    userTerms: toDetailFn(userMap, matchedLemmas),
    wineTerms: toDetailFn(wineMap, matchedLemmas),
    userRawTokens: sanitizeText(userNote).split(' ').filter(Boolean),
    wineRawTokens: sanitizeText(wineNote).split(' ').filter(Boolean),
    userFlavorTokens: stripGenericTerms(userProcessed).split(' ').filter(Boolean),
    wineFlavorTokens: stripGenericTerms(wineProcessed).split(' ').filter(Boolean),
  };
}
