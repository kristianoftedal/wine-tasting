// Norwegian wine descriptor synonym map.
// Applied on already-sanitized (lowercase, no punctuation, stopwords removed) text
// before lemma lookup and before semantic embedding.
//
// Two goals:
//   1. OOV coverage: words absent from norwegianLemmas get replaced with a known dict key
//      so they earn lemma/category credit instead of being silently dropped.
//   2. Embedding consistency: morphological variants are collapsed to the same surface form
//      so the semantic model sees consistent tokens across notes.
//
// Keys are lowercase surface tokens; values are the canonical dict surface form.
export const WINE_SYNONYMS: Record<string, string> = {
  // ── Mineral ───────────────────────────────────────────────────────────────
  // mineralsk + mineralitet are already in the lemma dict but normalizing here
  // also harmonises the semantic embedding text.
  mineralsk: 'mineral',
  mineralske: 'mineral',
  mineralitet: 'mineral',
  mineralaktig: 'mineral',       // OOV

  // ── Berry ─────────────────────────────────────────────────────────────────
  bærete: 'bær',                 // OOV — adjective "berry-like"
  bærfrukt: 'bær',
  bærrik: 'bær',
  bærpreget: 'bær',

  // ── Fruit (general) ───────────────────────────────────────────────────────
  fruktig: 'frukt',
  fruktige: 'frukt',
  fruktighet: 'frukt',
  fruktrik: 'frukt',
  fruktrike: 'frukt',
  fruktaktig: 'frukt',           // OOV

  // ── Spice ─────────────────────────────────────────────────────────────────
  krydret: 'krydder',
  krydrete: 'krydder',
  krydderaktig: 'krydder',

  // ── Tannin ────────────────────────────────────────────────────────────────
  tanniner: 'tannin',
  tanninrik: 'tannin',           // OOV
  tanninholdig: 'tannin',        // OOV

  // ── Acidity ───────────────────────────────────────────────────────────────
  syrlig: 'syre',
  syrlige: 'syre',
  syrlighet: 'syre',
  syrighet: 'syre',              // OOV

  // ── Oak / eik ─────────────────────────────────────────────────────────────
  eikepreget: 'eik',             // OOV
  eikefat: 'eik',                // OOV

  // ── Floral ────────────────────────────────────────────────────────────────
  blomstrete: 'blomst',
  blomsterpreget: 'blomst',

  // ── Herbs ─────────────────────────────────────────────────────────────────
  urteaktig: 'urt',              // OOV
  urtepreget: 'urt',             // OOV

  // ── Citrus ────────────────────────────────────────────────────────────────
  sitrusaktig: 'sitrus',         // OOV
  sitruspreget: 'sitrus',        // OOV

  // ── Specific flavours ─────────────────────────────────────────────────────
  vaniljepreget: 'vanilje',      // OOV
  vaniljearoma: 'vanilje',       // OOV
  sjokoladepreget: 'sjokolade',  // OOV
  sjokoladeaktig: 'sjokolade',   // OOV
  pepperaktig: 'pepper',         // OOV
  kirsebærpreget: 'kirsebær',    // OOV
  solbærpreget: 'solbær',        // OOV
  røykpreget: 'røyk',            // OOV
  røykaktig: 'røyk',
};

/**
 * Replace each token in an already-sanitized text with its canonical form
 * from WINE_SYNONYMS. Tokens not in the map pass through unchanged.
 *
 * Expects input produced by sanitizeText() (lowercase, no punctuation,
 * stopwords removed). Calling it on raw user text also works because the
 * keys are all lowercase and punctuation-free.
 */
export function normalizeWineSynonyms(sanitized: string): string {
  if (!sanitized) return sanitized;
  return sanitized
    .split(' ')
    .map(token => WINE_SYNONYMS[token] ?? token)
    .join(' ');
}
