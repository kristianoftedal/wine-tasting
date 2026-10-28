import { lemmatizeAndWeight, norwegianLemmas } from './lemmatizeAndWeight';
import { cosineSimilarity } from './math';
import { embedTokens } from './tokenEmbeddings';
import thresholdRaw from './oov-threshold.generated.json';

/**
 * Unknown-word mapping: "du skrev X, lest som Y".
 *
 * A word the dictionary does not know resolves to `ukjent` and is skipped by
 * the ladder on both sides, so "toasty" earns nothing on a wine the reference
 * calls "ristet" and "brioch" nothing on "bakverk". This maps such a word to
 * the nearest aroma lemma by centred OpenAI token cosine — the vectors the
 * production soft engine already uses — and accepts the mapping only above a
 * threshold tuned on labelled pairs (scripts/tune-oov-threshold.ts: the
 * synonym map's out-of-dictionary keys plus unknown words from real notes,
 * hand-labelled as descriptor or not). Measured on the live notes, 28 Oct
 * 2026: the most frequent unknown words are "gult" (9), "mindre", "sur",
 * "vet" — things that must *not* become an aroma — so the threshold is set
 * for precision, and every accepted mapping is shown to the taster.
 *
 * Only aroma lemmas (category main ≠ GENERIC) are candidates: mapping "sur"
 * to "syre" would be correct and useless, since structure is scored from the
 * numeric sliders, not the text.
 *
 * Behind OOV_MAPPING_ENABLED. Off, this module is never called.
 */
export const OOV_MAPPING_ENABLED = process.env.OOV_MAPPING_ENABLED === 'true';

export type OovMapping = { from: string; to: string; sim: number };

type ThresholdFile = { threshold?: number; tunedAt?: string };
export const OOV_THRESHOLD: number = (thresholdRaw as ThresholdFile).threshold ?? 0.5;

/** Distinct aroma lemmas, each with the surface key that spells the lemma itself. */
export const AROMA_CANDIDATES: ReadonlyArray<{ lemma: string; key: string }> = (() => {
  const byLemma = new Map<string, string>();
  for (const [key, entry] of Object.entries(norwegianLemmas)) {
    if (!entry.categoryPath?.main || entry.categoryPath.main === 'GENERIC') continue;
    const current = byLemma.get(entry.lemma);
    if (!current || key === entry.lemma) byLemma.set(entry.lemma, key);
  }
  return [...byLemma.entries()].map(([lemma, key]) => ({ lemma, key }));
})();

export function isUnknownWord(token: string): boolean {
  if (token.length < 4 || /^\d+$/.test(token)) return false;
  const item = lemmatizeAndWeight(token).lemmatized[0];
  return !!item && item.category === 'ukjent';
}

/**
 * Nearest aroma lemma per unknown word, with its cosine, regardless of the
 * threshold; the tuning script and the demo use this directly.
 */
export async function nearestAromaLemmas(words: string[]): Promise<Map<string, { lemma: string; key: string; sim: number }>> {
  const out = new Map<string, { lemma: string; key: string; sim: number }>();
  const wanted = [...new Set(words)];
  if (!wanted.length) return out;
  const vectors = await embedTokens([...wanted, ...AROMA_CANDIDATES.map(c => c.key)]);
  const candidates = AROMA_CANDIDATES.flatMap(c => { const vec = vectors.get(c.key); return vec ? [{ ...c, vec }] : []; });
  for (const word of wanted) {
    const vec = vectors.get(word);
    if (!vec) continue;
    let best: { lemma: string; key: string; sim: number } | null = null;
    for (const c of candidates) {
      const sim = cosineSimilarity(vec, c.vec);
      if (!best || sim > best.sim) best = { lemma: c.lemma, key: c.key, sim };
    }
    if (best) out.set(word, best);
  }
  return out;
}

/**
 * Replace unknown words in a sanitised, synonym-normalised note by the
 * dictionary surface form they map to, when the mapping clears the threshold.
 */
export async function mapUnknownWords(norm: string, threshold = OOV_THRESHOLD): Promise<{ text: string; mapped: OovMapping[] }> {
  const tokens = norm.split(' ').filter(Boolean);
  const unknown = tokens.filter(isUnknownWord);
  if (!unknown.length) return { text: norm, mapped: [] };
  const nearest = await nearestAromaLemmas(unknown);
  const mapped: OovMapping[] = [];
  const replaced = tokens.map(tok => {
    const n = nearest.get(tok);
    if (!n || n.sim < threshold) return tok;
    if (!mapped.some(m => m.from === tok)) mapped.push({ from: tok, to: n.lemma, sim: n.sim });
    return n.key;
  });
  return { text: replaced.join(' '), mapped };
}
