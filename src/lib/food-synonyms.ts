/**
 * Resolves free-form Norwegian food queries to the canonical terms stored in the
 * database, so retrieval stays an exact indexed array-overlap rather than a
 * fuzzy or semantic match.
 *
 * Three vocabularies, because three different columns are queried and their
 * contents do not overlap:
 *
 *   food    wines.is_good_for            protein / food category  (12 terms)
 *   theme   wine_articles.food_tags      cuisine, season, occasion (12 terms)
 *   course  wine_articles.occasion_tags  course / format           (7 terms)
 *
 * The column names mislead: the real *occasions* — Jul og nyttår, 17. mai,
 * Påske, Thanksgiving — live in `food_tags`, while `occasion_tags` holds the
 * course (Hovedrett, Forrett, Tilbehør). Route by content, not by column name.
 *
 * Terms must match exactly: it is "Svin" not "Svinekjøtt", "Storfe" not
 * "Storfekjøtt", "Lam og sau" not "Lammekjøtt", and TEXT[] overlap is
 * case-sensitive.
 *
 * Two layers feed each channel. FALLBACK is hand-curated and authoritative;
 * the generated map (food-synonyms.generated.json) adds breadth from an LLM
 * sweep. Refresh it with `scripts/build-food-lemmas.ts --execute`.
 */

import generated from './food-synonyms.generated.json' with { type: 'json' };

type LemmaMap = Record<string, string[]>;

/** Canonical values in `wines.is_good_for`. */
const FOOD_VOCAB = new Set([
  'Aperitiff',
  'Dessert',
  'Fisk',
  'Grønnsaker',
  'Lam og sau',
  'Lyst kjøtt',
  'Ost',
  'Skalldyr',
  'Småvilt',
  'Storfe',
  'Storvilt',
  'Svin',
]);

/** Canonical values in `wine_articles.food_tags` — cuisine, season, occasion. */
const THEME_VOCAB = new Set([
  '17. mai',
  'Asiatisk',
  'Fugl',
  'Grillmat',
  'Jul og nyttår',
  'Kjøtt',
  'Norsk',
  'Pizza og pasta',
  'Påske',
  'Sjømat',
  'Thanksgiving',
  'Vegetar',
]);

/** Canonical values in `wine_articles.occasion_tags` — where in the meal. */
const COURSE_VOCAB = new Set([
  'Forrett',
  'Gryter',
  'Hovedrett',
  'Kaker og desserter',
  'Meny',
  'Smårett',
  'Tilbehør',
]);

const FALLBACK: LemmaMap = {
  // ── Svin ─────────────────────────────────────────────────────────────
  ribbe: ['Svin', 'Lyst kjøtt'],
  svin: ['Svin', 'Lyst kjøtt'],
  svinekjøtt: ['Svin', 'Lyst kjøtt'],
  svinekam: ['Svin', 'Lyst kjøtt'],
  svinekoteletter: ['Svin', 'Lyst kjøtt'],
  bacon: ['Svin'],
  skinke: ['Svin', 'Lyst kjøtt'],
  pulled: ['Svin'],
  pinnekjøtt: ['Lam og sau'],

  // ── Lam og sau ───────────────────────────────────────────────────────
  lam: ['Lam og sau'],
  lammekjøtt: ['Lam og sau'],
  lammelår: ['Lam og sau'],
  fårikål: ['Lam og sau'],
  sau: ['Lam og sau'],

  // ── Storfe ───────────────────────────────────────────────────────────
  biff: ['Storfe'],
  entrecôte: ['Storfe'],
  entrecote: ['Storfe'],
  ribeye: ['Storfe'],
  okse: ['Storfe'],
  oksekjøtt: ['Storfe'],
  storfekjøtt: ['Storfe'],
  storfe: ['Storfe'],
  burger: ['Storfe'],
  hamburger: ['Storfe'],
  kjøttkaker: ['Storfe'],
  karbonade: ['Storfe'],

  // ── Lyst kjøtt (kylling og lignende) ─────────────────────────────────
  kylling: ['Lyst kjøtt'],
  kalkun: ['Lyst kjøtt'],
  fjærkre: ['Lyst kjøtt'],
  kalv: ['Lyst kjøtt'],

  // ── Vilt (Storvilt / Småvilt) ────────────────────────────────────────
  vilt: ['Storvilt', 'Småvilt'],
  elg: ['Storvilt'],
  hjort: ['Storvilt'],
  reinsdyr: ['Storvilt'],
  rådyr: ['Storvilt'],
  and: ['Småvilt'],
  rype: ['Småvilt'],
  fasan: ['Småvilt'],
  due: ['Småvilt'],

  // ── Fisk ─────────────────────────────────────────────────────────────
  fisk: ['Fisk'],
  laks: ['Fisk'],
  ørret: ['Fisk'],
  makrell: ['Fisk'],
  tunfisk: ['Fisk'],
  torsk: ['Fisk'],
  sei: ['Fisk'],
  hyse: ['Fisk'],
  kveite: ['Fisk'],
  steinbit: ['Fisk'],
  sushi: ['Fisk', 'Skalldyr'],
  sashimi: ['Fisk'],
  lutefisk: ['Fisk'],

  // ── Skalldyr ─────────────────────────────────────────────────────────
  skalldyr: ['Skalldyr'],
  hummer: ['Skalldyr'],
  krabbe: ['Skalldyr'],
  reker: ['Skalldyr'],
  scampi: ['Skalldyr'],
  østers: ['Skalldyr'],
  blåskjell: ['Skalldyr'],
  kamskjell: ['Skalldyr'],
  sjøkreps: ['Skalldyr'],

  // ── Grønnsaker / vegetar ─────────────────────────────────────────────
  grønnsaker: ['Grønnsaker'],
  vegetar: ['Grønnsaker'],
  sopp: ['Grønnsaker', 'Lyst kjøtt'],
  salat: ['Grønnsaker'],

  // ── Ost ──────────────────────────────────────────────────────────────
  ost: ['Ost'],
  ostebord: ['Ost'],
  brie: ['Ost'],
  camembert: ['Ost'],
  parmesan: ['Ost'],
  blåmuggost: ['Ost'],

  // ── Dessert ──────────────────────────────────────────────────────────
  dessert: ['Dessert'],
  sjokolade: ['Dessert'],
  kake: ['Dessert'],
  is: ['Dessert'],

  // ── Aperitiff ────────────────────────────────────────────────────────
  aperitiff: ['Aperitiff'],
  cocktail: ['Aperitiff'],
  tapas: ['Aperitiff', 'Ost'],

  // ── Sammensatte retter ───────────────────────────────────────────────
  pizza: ['Storfe', 'Svin', 'Ost'],
  pasta: ['Storfe', 'Ost'],
  spaghetti: ['Storfe', 'Ost'],
  bolognese: ['Storfe'],
  lasagne: ['Storfe', 'Ost'],
  carbonara: ['Svin', 'Ost'],
  ragu: ['Storfe'],
  risotto: ['Lyst kjøtt', 'Ost'],
  taco: ['Storfe'],
  burrito: ['Storfe'],
  chili: ['Storfe'],
  curry: ['Lyst kjøtt'],
  thai: ['Lyst kjøtt'],
  wok: ['Lyst kjøtt'],
  ramen: ['Svin'],
  paella: ['Skalldyr', 'Lyst kjøtt'],
  ratatouille: ['Grønnsaker'],
  moussaka: ['Lam og sau'],
};

/**
 * Curated theme lemmas → `wine_articles.food_tags`.
 *
 * These are the queries that previously resolved to nothing: "julemat" and
 * "påskelam" name an occasion, not a protein, so they have no `is_good_for`
 * equivalent and were filtered away before reaching a query.
 *
 * Norwegian seasonal dishes deliberately map to both a theme here and a food in
 * FALLBACK. "Ribbe" is pork *and* Christmas; a taster searching it should get
 * the pork wines and the Christmas articles.
 */
const FALLBACK_THEME: LemmaMap = {
  // ── Jul og nyttår ────────────────────────────────────────────────────
  jul: ['Jul og nyttår'],
  julemat: ['Jul og nyttår'],
  julaften: ['Jul og nyttår'],
  julemiddag: ['Jul og nyttår'],
  julebord: ['Jul og nyttår'],
  romjul: ['Jul og nyttår'],
  nyttår: ['Jul og nyttår'],
  nyttårsaften: ['Jul og nyttår'],
  ribbe: ['Jul og nyttår'],
  pinnekjøtt: ['Jul og nyttår', 'Norsk'],
  lutefisk: ['Jul og nyttår', 'Norsk'],

  // ── Påske ────────────────────────────────────────────────────────────
  påske: ['Påske'],
  påskemat: ['Påske'],
  påskelam: ['Påske'],
  påskeaften: ['Påske'],

  // ── 17. mai ──────────────────────────────────────────────────────────
  '17. mai': ['17. mai'],
  '17.mai': ['17. mai'],
  nasjonaldag: ['17. mai'],
  nasjonaldagen: ['17. mai'],
  syttendemai: ['17. mai'],

  // ── Thanksgiving ─────────────────────────────────────────────────────
  thanksgiving: ['Thanksgiving'],
  kalkun: ['Thanksgiving', 'Fugl'],

  // ── Grillmat ─────────────────────────────────────────────────────────
  grill: ['Grillmat'],
  grillmat: ['Grillmat'],
  grilling: ['Grillmat'],
  grillet: ['Grillmat'],
  barbecue: ['Grillmat'],
  bbq: ['Grillmat'],
  sommer: ['Grillmat'],

  // ── Asiatisk ─────────────────────────────────────────────────────────
  asiatisk: ['Asiatisk'],
  sushi: ['Asiatisk', 'Sjømat'],
  thai: ['Asiatisk'],
  curry: ['Asiatisk'],
  ramen: ['Asiatisk'],
  wok: ['Asiatisk'],
  kinesisk: ['Asiatisk'],
  japansk: ['Asiatisk'],
  indisk: ['Asiatisk'],

  // ── Pizza og pasta ───────────────────────────────────────────────────
  pizza: ['Pizza og pasta'],
  pasta: ['Pizza og pasta'],
  spaghetti: ['Pizza og pasta'],
  lasagne: ['Pizza og pasta'],
  carbonara: ['Pizza og pasta'],
  italiensk: ['Pizza og pasta'],

  // ── Vegetar ──────────────────────────────────────────────────────────
  vegetar: ['Vegetar'],
  vegetarisk: ['Vegetar'],
  vegansk: ['Vegetar'],
  plantebasert: ['Vegetar'],

  // ── Sjømat / Kjøtt / Fugl / Norsk ────────────────────────────────────
  sjømat: ['Sjømat'],
  fisk: ['Sjømat'],
  skalldyr: ['Sjømat'],
  kjøtt: ['Kjøtt'],
  biff: ['Kjøtt'],
  lam: ['Kjøtt'],
  vilt: ['Kjøtt'],
  fugl: ['Fugl'],
  kylling: ['Fugl'],
  and: ['Fugl'],
  norsk: ['Norsk'],
  fårikål: ['Norsk'],
  raspeballer: ['Norsk'],
};

/**
 * Curated course lemmas → `wine_articles.occasion_tags`. These describe where
 * in the meal a dish sits, which is orthogonal to what it is made of.
 */
const FALLBACK_COURSE: LemmaMap = {
  forrett: ['Forrett'],
  forretter: ['Forrett'],
  starter: ['Forrett'],
  appetizer: ['Forrett'],
  hovedrett: ['Hovedrett'],
  hovedretter: ['Hovedrett'],
  middag: ['Hovedrett'],
  smårett: ['Smårett'],
  småretter: ['Smårett'],
  snacks: ['Smårett'],
  tapas: ['Smårett'],
  gryte: ['Gryter'],
  gryter: ['Gryter'],
  gryterett: ['Gryter'],
  stew: ['Gryter'],
  dessert: ['Kaker og desserter'],
  desserter: ['Kaker og desserter'],
  kake: ['Kaker og desserter'],
  kaker: ['Kaker og desserter'],
  bakst: ['Kaker og desserter'],
  tilbehør: ['Tilbehør'],
  garnityr: ['Tilbehør'],
  sideretter: ['Tilbehør'],
  meny: ['Meny'],
  flerretters: ['Meny'],
  menyer: ['Meny'],
};

/**
 * The curated layer, exposed so scripts/build-food-lemmas.ts can prune the LLM
 * sweep against it. Curated entries are authoritative about *which channel* a
 * term belongs to, not only which target — "grillmat" is a theme, so a generated
 * claim on it from the food or course channel is noise.
 */
export const CURATED_LEMMAS = {
  food: FALLBACK,
  theme: FALLBACK_THEME,
  course: FALLBACK_COURSE,
} as const satisfies Record<string, LemmaMap>;

type GeneratedFile = { maps?: { food?: LemmaMap; theme?: LemmaMap; course?: LemmaMap } };
const GENERATED = (generated as GeneratedFile).maps ?? {};
const GENERATED_FOOD: LemmaMap = GENERATED.food ?? {};
const GENERATED_THEME: LemmaMap = GENERATED.theme ?? {};
const GENERATED_COURSE: LemmaMap = GENERATED.course ?? {};

export type FoodQueryExpansion = {
  /** Canonical terms for `.overlaps('is_good_for', [...])` on wines. */
  foodTerms: string[];
  /** Canonical terms for `.overlaps('food_tags', [...])` on wine_articles. */
  themeTerms: string[];
  /** Canonical terms for `.overlaps('occasion_tags', [...])` on wine_articles. */
  courseTerms: string[];
};

/**
 * Resolve one channel. The curated map wins outright over the generated one on
 * an exact hit: the LLM sweep is broad but occasionally wrong — it files
 * "pinnekjøtt" (salted, dried lamb) under Svin — and a hand-written correction
 * has to be able to override it rather than merge with it.
 *
 * Per-word and substring passes run only when the earlier, more precise pass
 * found nothing, so "stekt ribbe" resolves through "ribbe" without also
 * dragging in whatever "stekt" happens to touch.
 */
function resolveChannel(query: string, curated: LemmaMap, llm: LemmaMap, vocab: Set<string>): string[] {
  const out = new Set<string>();
  const merge = (terms: string[] | undefined) => {
    for (const t of terms ?? []) if (vocab.has(t)) out.add(t);
  };

  // Exact match — curated is authoritative, generated fills the gap.
  if (curated[query]) merge(curated[query]);
  else merge(llm[query]);

  // Per-word lookup for compound queries like "stekt ribbe".
  if (out.size === 0) {
    for (const word of query.split(/\s+/)) {
      if (curated[word]) merge(curated[word]);
      else merge(llm[word]);
    }
  }

  // Substring fallback, longest key first so "svinekam" beats "svin".
  if (out.size === 0) {
    const keys = [...new Set([...Object.keys(curated), ...Object.keys(llm)])]
      .filter(k => k.length >= 3 && query.includes(k))
      .sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (curated[key]) merge(curated[key]);
      else merge(llm[key]);
      if (out.size > 0) break;
    }
  }

  return [...out].sort();
}

/**
 * Resolve a free-form food query into all three canonical channels.
 *
 * A query can legitimately hit more than one: "julemat" is a theme with no
 * `is_good_for` equivalent, "ribbe" is a food that is also a Christmas theme,
 * and "forrett" is only a course. Returning them separately lets the caller
 * query the right column for each instead of discarding what does not fit one.
 */
export function expandFoodQuery(query: string): FoodQueryExpansion {
  const q = query.trim().toLowerCase();
  if (!q) return { foodTerms: [], themeTerms: [], courseTerms: [] };

  return {
    foodTerms: resolveChannel(q, FALLBACK, GENERATED_FOOD, FOOD_VOCAB),
    themeTerms: resolveChannel(q, FALLBACK_THEME, GENERATED_THEME, THEME_VOCAB),
    courseTerms: resolveChannel(q, FALLBACK_COURSE, GENERATED_COURSE, COURSE_VOCAB),
  };
}
