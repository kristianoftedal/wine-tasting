/**
 * Plain-language taste profile, one paragraph per wine type.
 *
 * Everything here is derived from data the app already has — the user's own
 * karakter per tasting plus the catalogue row for each wine — so the text is
 * deterministic, instant and free. No model call.
 *
 * Runs on the server: lemmatizeAndWeight pulls in `natural`, which has no
 * business in a client bundle. src/app/profil/page.tsx builds the summaries and
 * passes them down as props.
 */
import { lemmatizeAndWeight, type WineCategory } from './lemmatizeAndWeight';
import type { Tasting, Wine } from './types';

/** Karakter at or above which a wine counts as a favourite. */
const FAVOURITE_KARAKTER = 8;

/** Karakter at or below which a wine counts as a miss, for the contrast sentence. */
const DISLIKED_KARAKTER = 6;

/** When too few wines clear FAVOURITE_KARAKTER, fall back to this many top-rated ones. */
const FALLBACK_TOP_N = 3;

/** Aroma-bearing lemma categories. The rest ('struktur', 'fylde', …) are covered by the numbers. */
const AROMA_CATEGORIES = new Set<WineCategory>([
  'bær',
  'sitrus',
  'steinfrukt',
  'frukt',
  'moden-frukt',
  'krydder',
  'eik',
  'mineral',
  'blomst',
  'urt'
]);

const MAX_AROMAS = 4;

/** Cap on aroma words contributed by a single wine's note. */
const MAX_PER_WINE = 2;

export type TasteSummary = {
  /** main_category as stored on the wine row, e.g. 'Rødvin'. */
  category: string;
  /** Tastings with a karakter in this category. */
  ratedCount: number;
  /** Wines the summary is actually built from. */
  favouriteCount: number;
  /** Average karakter across the favourites, or null when nothing is rated. */
  avgKarakter: number | null;
  /** Short chips for the UI: 'Fyldig', 'Frisk', 'Tørr', … */
  traits: string[];
  /** Recurring aroma lemmas across the favourites. */
  aromas: string[];
  /** The paragraph. */
  text: string;
};

type Scored = { tasting: Tasting; wine: Wine; karakter: number };

const nb = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });

const oneDecimal = (value: number) => nb.format(Math.round(value * 10) / 10);

/** "a", "a og b", "a, b og c" */
function joinNo(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;
}

const capitalize = (sentence: string) => sentence.charAt(0).toUpperCase() + sentence.slice(1);

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Vinmonopolet grades fylde/friskhet/garvestoff/sødme on a 1–12 scale.
 * These bands turn that back into the words a person would use.
 */
type Band = { max: number; one: string; many: string; trait: string };

const FYLDE_BANDS: Band[] = [
  { max: 4, one: 'lett', many: 'lette', trait: 'Lett' },
  { max: 6, one: 'middels fyldig', many: 'middels fyldige', trait: 'Middels fylde' },
  { max: 8, one: 'fyldig', many: 'fyldige', trait: 'Fyldig' },
  { max: 12, one: 'svært fyldig', many: 'svært fyldige', trait: 'Svært fyldig' }
];

const FRISKHET_BANDS: Band[] = [
  { max: 4, one: 'rund i syren', many: 'runde i syren', trait: 'Lav syre' },
  { max: 6, one: 'middels frisk', many: 'middels friske', trait: 'Middels friskhet' },
  { max: 8, one: 'frisk', many: 'friske', trait: 'Frisk' },
  { max: 12, one: 'sylskarp i syren', many: 'sylskarpe i syren', trait: 'Høy syre' }
];

const SODME_BANDS: Band[] = [
  { max: 2, one: 'tørr', many: 'tørre', trait: 'Tørr' },
  { max: 4, one: 'nesten tørr', many: 'nesten tørre', trait: 'Nesten tørr' },
  { max: 7, one: 'halvtørr', many: 'halvtørre', trait: 'Halvtørr' },
  { max: 12, one: 'søt', many: 'søte', trait: 'Søt' }
];

/** Tannin bands are noun phrases, so singular and plural read the same. */
const GARVESTOFF_BANDS: Band[] = [
  { max: 3, one: 'silkemyke tanniner', many: 'silkemyke tanniner', trait: 'Myke tanniner' },
  { max: 6, one: 'moderate tanniner', many: 'moderate tanniner', trait: 'Moderate tanniner' },
  { max: 8, one: 'tydelig tanninstruktur', many: 'tydelig tanninstruktur', trait: 'Tydelige tanniner' },
  { max: 12, one: 'kraftige, stramme tanniner', many: 'kraftige, stramme tanniner', trait: 'Stramme tanniner' }
];

const bandFor = (bands: Band[], value: number): Band => bands.find(b => value <= b.max) ?? bands[bands.length - 1];

/** "Nebbiolo 95%" and "Sémillon 60 prosent" both name the same grape. */
export function grapeName(raw: string): string {
  return raw.replace(/\s*\d+([.,]\d+)?\s*(%|prosent)\s*$/i, '').trim();
}

/** Vinmonopolet stores price as display text: "Kr 5 950,00" (with a non-breaking space). */
export function parsePrice(wine: Wine): number | null {
  const numeric = (wine as Wine & { price_nok?: number | null }).price_nok;
  if (typeof numeric === 'number' && Number.isFinite(numeric)) return numeric;

  if (!wine.price) return null;
  const cleaned = wine.price.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Counts occurrences and returns the most frequent entries, ties broken alphabetically. */
function topBy<T>(items: T[], key: (item: T) => string | null | undefined, take: number): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'))
    .slice(0, take)
    .map(([value, count]) => ({ value, count }));
}

/**
 * Umbrella terms. They are real aroma lemmas, but "frukt" says nothing a reader
 * did not already assume about wine, so anything concrete outranks them.
 */
const GENERIC_AROMAS = new Set(['frukt', 'bær', 'moden', 'tørket', 'aroma', 'smak']);

/**
 * Aroma words that recur across the favourites, taken from the producers' own
 * notes. Counted once per wine rather than per mention, so a single flowery
 * note cannot decide the profile, and deduped by lemma so "kirsebær" and
 * "kirsebærpreg" do not both make the list.
 */
function recurringAromas(favourites: Scored[]): string[] {
  type Entry = { word: string; lemma: string; wines: Set<number>; generic: boolean };
  const entries = new Map<string, Entry>();

  favourites.forEach(({ wine }, wineIndex) => {
    const text = [wine.smell, wine.taste].filter(Boolean).join(' ');
    if (!text) return;

    for (const word of lemmatizeAndWeight(text).lemmatized) {
      if (!AROMA_CATEGORIES.has(word.category)) continue;

      const entry = entries.get(word.original) ?? {
        word: word.original,
        lemma: word.lemma,
        wines: new Set<number>(),
        generic: GENERIC_AROMAS.has(word.lemma) || GENERIC_AROMAS.has(word.original)
      };
      entry.wines.add(wineIndex);
      entries.set(word.original, entry);
    }
  });

  // Concrete before umbrella, then by how many wines mention it.
  const ranked = [...entries.values()].sort(
    (a, b) =>
      Number(a.generic) - Number(b.generic) ||
      b.wines.size - a.wines.size ||
      a.word.localeCompare(b.word, 'nb')
  );

  const picked: string[] = [];
  const usedLemmas = new Set<string>();
  const takenFromWine = new Map<number, number>();

  for (const entry of ranked) {
    if (picked.length === MAX_AROMAS) break;
    if (usedLemmas.has(entry.lemma)) continue;

    // Spread the words across wines: without this cap one lavishly written
    // note could supply the entire list and pass itself off as a pattern.
    const sources = [...entry.wines];
    if (favourites.length > 1 && sources.every(i => (takenFromWine.get(i) ?? 0) >= MAX_PER_WINE)) continue;

    usedLemmas.add(entry.lemma);
    picked.push(entry.word);
    for (const i of sources) takenFromWine.set(i, (takenFromWine.get(i) ?? 0) + 1);
  }

  return picked;
}

type Dimension = { key: 'fylde' | 'friskhet' | 'garvestoff' | 'sodme'; bands: Band[]; more: string; less: string };

const DIMENSIONS: Dimension[] = [
  { key: 'fylde', bands: FYLDE_BANDS, more: 'fyldigere', less: 'lettere' },
  { key: 'friskhet', bands: FRISKHET_BANDS, more: 'friskere', less: 'rundere' },
  { key: 'garvestoff', bands: GARVESTOFF_BANDS, more: 'mer tanninrike', less: 'mykere' },
  { key: 'sodme', bands: SODME_BANDS, more: 'søtere', less: 'tørrere' }
];

/** A dimension is only worth describing when most of the wines actually carry the value. */
const MIN_COVERAGE = 0.5;

function dimensionAverage(wines: Wine[], key: Dimension['key']): number | null {
  const values = wines.map(w => w[key]).filter((v): v is number => typeof v === 'number');
  if (values.length < Math.ceil(wines.length * MIN_COVERAGE)) return null;
  return average(values);
}

/** Smallest gap between favourites and misses worth calling out, in scale points. */
const CONTRAST_THRESHOLD = 1.5;

function buildSummary(category: string, scored: Scored[]): TasteSummary {
  const sorted = [...scored].sort((a, b) => b.karakter - a.karakter);
  const highRated = sorted.filter(s => s.karakter >= FAVOURITE_KARAKTER);
  const favourites = highRated.length >= 2 ? highRated : sorted.slice(0, FALLBACK_TOP_N);
  const favouriteWines = favourites.map(f => f.wine);

  const avgKarakter = average(favourites.map(f => f.karakter));
  const label = category.toLowerCase();
  const plural = category === 'Musserende vin' ? 'musserende viner' : `${label}er`;

  const sentences: string[] = [];
  const traits: string[] = [];

  // 1. Scope.
  if (highRated.length >= 2) {
    sentences.push(
      `Du har vurdert ${scored.length} ${scored.length === 1 ? label : plural}, og ${highRated.length} av dem fikk ${FAVOURITE_KARAKTER} eller mer (snitt ${oneDecimal(avgKarakter ?? 0)}).`
    );
  } else if (scored.length === 1) {
    sentences.push(`Du har vurdert én ${label} så langt, og ga den ${oneDecimal(sorted[0].karakter)}.`);
  } else {
    sentences.push(
      `Ingen ${plural} har fått ${FAVOURITE_KARAKTER} ennå, så dette bygger på de ${favourites.length} du likte best (snitt ${oneDecimal(avgKarakter ?? 0)}).`
    );
  }

  // 2. Structure, straight from the catalogue values of those wines.
  const adjectives: string[] = [];
  let tanninClause: string | null = null;

  const single = favourites.length === 1;

  for (const dimension of DIMENSIONS) {
    const avg = dimensionAverage(favouriteWines, dimension.key);
    if (avg === null) continue;
    const band = bandFor(dimension.bands, avg);
    traits.push(band.trait);
    const adjective = single ? band.one : band.many;
    if (dimension.key === 'garvestoff') tanninClause = adjective;
    else adjectives.push(adjective);
  }

  if (adjectives.length > 0) {
    const opener = single ? 'Den er' : 'Favorittene dine er';
    sentences.push(`${opener} ${joinNo(adjectives)}${tanninClause ? `, med ${tanninClause}` : ''}.`);
  } else if (tanninClause) {
    sentences.push(`${single ? 'Den har' : 'Favorittene dine har'} ${tanninClause}.`);
  }

  // 3. Aromas from the producers' own notes.
  const aromas = recurringAromas(favourites);
  if (aromas.length > 0) {
    sentences.push(
      single ? `Smaksbildet er preget av ${joinNo(aromas)}.` : `Ordene som går igjen er ${joinNo(aromas)}.`
    );
  }

  // 4. Origin and grapes.
  const originBits: string[] = [];
  const [topCountry] = topBy(favouriteWines, w => w.main_country, 1);
  if (topCountry && topCountry.count > 1) {
    const [topDistrict] = topBy(
      favouriteWines.filter(w => w.main_country === topCountry.value),
      w => w.district,
      1
    );
    originBits.push(
      `Geografisk trekker du mot ${topCountry.value} (${topCountry.count} av ${favouriteWines.length})` +
        (topDistrict && topDistrict.count > 1 ? `, særlig ${topDistrict.value}` : '')
    );
  }

  const grapes = topBy(
    favouriteWines.flatMap(w => (w.grapes ?? []).map(grapeName)),
    g => g || null,
    3
  ).filter(g => g.count > 1);
  if (grapes.length > 0) {
    originBits.push(`druene som går igjen er ${joinNo(grapes.map(g => g.value))}`);
  }
  if (originBits.length > 0) {
    sentences.push(capitalize(`${joinNo(originBits)}.`));
  }

  // 5. Price level.
  const prices = favouriteWines.map(parsePrice).filter((p): p is number => p !== null);
  if (prices.length >= 2) {
    sentences.push(`Prisnivået du lander på er rundt ${nb.format(Math.round(average(prices) ?? 0))} kroner.`);
  }

  // 6. What separates the favourites from the misses.
  const disliked = sorted.filter(s => s.karakter <= DISLIKED_KARAKTER).map(s => s.wine);
  if (disliked.length >= 2) {
    let biggest: { dimension: Dimension; diff: number; hi: number; lo: number } | null = null;
    for (const dimension of DIMENSIONS) {
      const good = dimensionAverage(favouriteWines, dimension.key);
      const bad = dimensionAverage(disliked, dimension.key);
      if (good === null || bad === null) continue;
      const diff = good - bad;
      if (Math.abs(diff) >= CONTRAST_THRESHOLD && (!biggest || Math.abs(diff) > Math.abs(biggest.diff))) {
        biggest = { dimension, diff, hi: good, lo: bad };
      }
    }
    if (biggest) {
      const direction = biggest.diff > 0 ? biggest.dimension.more : biggest.dimension.less;
      sentences.push(
        `Sammenlignet med de du ga ${DISLIKED_KARAKTER} eller lavere, velger du tydelig ${direction} viner (${biggest.dimension.key} ${oneDecimal(biggest.hi)} mot ${oneDecimal(biggest.lo)}).`
      );
    }
  }

  if (scored.length < 3) {
    sentences.push('Vurder noen flere, så blir profilen sikrere.');
  }

  return {
    category,
    ratedCount: scored.length,
    favouriteCount: favourites.length,
    avgKarakter,
    traits,
    aromas,
    text: sentences.map(capitalize).join(' ')
  };
}

/**
 * One summary per wine type the user has rated, most-tasted type first.
 *
 * Tastings join wines on wine_id → wines.id.
 */
export function buildTasteSummaries(tastings: Tasting[], wines: Wine[]): TasteSummary[] {
  const byId = new Map(wines.map(w => [w.id, w]));
  const byCategory = new Map<string, Scored[]>();

  for (const tasting of tastings) {
    const wineId = (tasting as Tasting & { wine_id?: string }).wine_id;
    const wine = wineId ? byId.get(wineId) : undefined;
    const karakter = tasting.karakter;
    if (!wine || typeof karakter !== 'number') continue;

    const category = wine.main_category;
    if (!category || category === ('Ukjent' as string)) continue;

    const bucket = byCategory.get(category) ?? [];
    bucket.push({ tasting, wine, karakter });
    byCategory.set(category, bucket);
  }

  return [...byCategory.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'nb'))
    .map(([category, scored]) => buildSummary(category, scored));
}
