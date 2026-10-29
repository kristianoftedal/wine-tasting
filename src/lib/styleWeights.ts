import styleRaw from './style-idf.generated.json';
import { STYLE_WEIGHT_CAP, STYLE_WEIGHT_FLOOR } from './scoringConfig';

/**
 * Descriptor weight relative to the wine's style (scripts/compute-style-idf.ts).
 *
 * `styleMultiplier` returns idf / median-idf of the lemma within the wine's
 * main category, clamped to [STYLE_WEIGHT_FLOOR, STYLE_WEIGHT_CAP], or null
 * when the category is unknown, too small to have been measured, or the
 * lemma was too rare in it — in which case the caller keeps the global
 * multiplier. Below 1.0 is the point: "sitrus" on a white is the default
 * descriptor for the style and a taster credits it accordingly.
 */
type StyleFile = { categories: Record<string, { wines: number; medianIdf: number; ratio: Record<string, number> }> };
const STYLE = styleRaw as StyleFile;

const CANONICAL: Record<string, string> = {
  rødvin: 'Rødvin', hvitvin: 'Hvitvin', 'musserende vin': 'Musserende vin', rosévin: 'Rosévin',
  musserende: 'Musserende vin', rosé: 'Rosévin', rose: 'Rosévin', rosevin: 'Rosévin',
};

/** The catalogue's main_category, as stored (text, occasionally JSON-encoded), to one of the measured names. */
export function normalizeCategory(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  if (s.startsWith('{')) { try { const o = JSON.parse(s); s = String(o.name ?? o.main_category ?? ''); } catch { /* keep */ } }
  const key = s.toLowerCase();
  return CANONICAL[key] ?? (STYLE.categories[s] ? s : null);
}

export function hasStyleTable(category: string | null | undefined): boolean {
  return !!category && !!STYLE.categories[category];
}

export function styleMultiplier(lemma: string, category: string | null | undefined, floor = STYLE_WEIGHT_FLOOR, cap = STYLE_WEIGHT_CAP): number | null {
  if (!category) return null;
  const ratio = STYLE.categories[category]?.ratio[lemma];
  if (ratio === undefined) return null;
  return Math.max(floor, Math.min(cap, ratio));
}

export const STYLE_CATEGORIES = Object.keys(STYLE.categories);
