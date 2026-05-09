'use server';

import { sanitizeText, norwegianLemmas } from '@/lib/lemmatizeAndWeight';
import { semanticSimilarity } from '@/lib/semanticSimilarity';
import { getCategoryWeight } from '@/lib/profiles';
import { PorterStemmerNo } from 'natural';
import idfRaw from '@/lib/idf-weights.generated.json';

const idfWeights = idfRaw as Record<string, number>;

const PRECISION_GAIN = 0.35;

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
  // Current algorithm: semantic + weighted lemma/category with IDF + Porter
  semanticScore: number;
  lemmaScore: number;
  categoryScore: number;
  precision: number;
  precisionBonus: number;
  currentScore: number;
  // Previous algorithm: same formula but no IDF multipliers, no Porter Stemmer
  legacyLemmaScore: number;
  legacyCategoryScore: number;
  legacyPrecision: number;
  legacyPrecisionBonus: number;
  legacyScore: number;
  // Term details
  userTerms: TermDetail[];
  wineTerms: TermDetail[];
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

// ── Current algorithm: IDF-boosted weighted terms + Porter Stemmer fallback ──

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

// ── Previous algorithm: same weighted formula, but no IDF, no Porter ─────────

function extractTermsNoIdfNoPorter(text: string): Map<string, InternalTerm> {
  const tokens = sanitizeText(text).split(' ').filter(Boolean);
  const out = new Map<string, InternalTerm>();

  for (const token of tokens) {
    const entry = norwegianLemmas[token];
    if (!entry) continue;

    const main = entry.categoryPath?.main ?? 'GENERIC';
    const sub = entry.categoryPath?.sub ?? '';
    // Hardcoded to pre-change GENERIC weight (1.0 → 1.3 was part of the new algorithm)
    const baseWeight = main === 'GENERIC'
      ? 1.0
      : getCategoryWeight(main as Parameters<typeof getCategoryWeight>[0]);

    if (!out.has(entry.lemma)) {
      out.set(entry.lemma, {
        lemma: entry.lemma, baseWeight, idfMultiplier: 1.0, finalWeight: baseWeight,
        main, sub, original: token, category: entry.category, foundViaPorter: false,
      });
    }
  }
  return out;
}

// ── Shared scoring functions ──────────────────────────────────────────────────

function sumWeightsI(m: Map<string, InternalTerm>) {
  return [...m.values()].reduce((s, v) => s + v.finalWeight, 0);
}

function computeWeightedLemmaScore(a: Map<string, InternalTerm>, b: Map<string, InternalTerm>): number {
  let inter = 0;
  for (const [lemma, info] of a) {
    if (b.has(lemma)) inter += info.finalWeight;
  }
  const smaller = Math.min(sumWeightsI(a), sumWeightsI(b));
  return smaller === 0 ? 0 : Math.round((inter / smaller) * 100);
}

function computeWeightedCategoryScore(a: Map<string, InternalTerm>, b: Map<string, InternalTerm>): number {
  const mainsB = new Set([...b.values()].map(v => v.main).filter(Boolean));
  const fullB = new Set([...b.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`));

  let credit = 0;
  for (const info of a.values()) {
    if (!info.main) continue;
    const key = info.sub ? `${info.main}/${info.sub}` : null;
    if (key && fullB.has(key)) credit += info.finalWeight;
    else if (mainsB.has(info.main)) credit += info.finalWeight * 0.5;
  }
  const smaller = Math.min(sumWeightsI(a), sumWeightsI(b));
  return smaller === 0 ? 0 : Math.round((credit / smaller) * 100);
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getScoringBreakdown(
  userNote: string,
  wineNote: string
): Promise<ScoringBreakdown> {
  const [semanticScore, userMap, wineMap, userLegacyMap, wineLegacyMap] = await Promise.all([
    semanticSimilarity(userNote, wineNote),
    Promise.resolve(extractTerms(userNote)),
    Promise.resolve(extractTerms(wineNote)),
    Promise.resolve(extractTermsNoIdfNoPorter(userNote)),
    Promise.resolve(extractTermsNoIdfNoPorter(wineNote)),
  ]);

  // Current algorithm
  const lemmaScore = computeWeightedLemmaScore(userMap, wineMap);
  const categoryScore = computeWeightedCategoryScore(userMap, wineMap);
  const precision = (lemmaScore + categoryScore) / 2;
  const precisionBonus = precision * PRECISION_GAIN;
  const currentScore = Math.round(Math.min(100, semanticScore + precisionBonus));

  // Previous algorithm (no IDF, no Porter — same semantic + weighted formula)
  const legacyLemmaScore = computeWeightedLemmaScore(userLegacyMap, wineLegacyMap);
  const legacyCategoryScore = computeWeightedCategoryScore(userLegacyMap, wineLegacyMap);
  const legacyPrecision = (legacyLemmaScore + legacyCategoryScore) / 2;
  const legacyPrecisionBonus = legacyPrecision * PRECISION_GAIN;
  const legacyScore = Math.round(Math.min(100, semanticScore + legacyPrecisionBonus));

  const matchedLemmas = new Set([...userMap.keys()].filter(k => wineMap.has(k)));

  const toDetail = (map: Map<string, InternalTerm>, matched: Set<string>): TermDetail[] =>
    [...map.values()].map(t => ({
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

  return {
    semanticScore,
    lemmaScore,
    categoryScore,
    precision: parseFloat(precision.toFixed(1)),
    precisionBonus: parseFloat(precisionBonus.toFixed(1)),
    currentScore,
    legacyLemmaScore,
    legacyCategoryScore,
    legacyPrecision: parseFloat(legacyPrecision.toFixed(1)),
    legacyPrecisionBonus: parseFloat(legacyPrecisionBonus.toFixed(1)),
    legacyScore,
    userTerms: toDetail(userMap, matchedLemmas),
    wineTerms: toDetail(wineMap, matchedLemmas),
  };
}
