/**
 * Oenological derivation map — descriptors a taster may legitimately report
 * when the reference note names the *cause* rather than the aroma.
 *
 * Why this exists
 * ---------------
 * Vinmonopolet notes describe winemaking ("litt fat") where a taster describes
 * perception ("vanilje"). Oak releases vanillin, oak lactones and furfural, so
 * "vanilje", "kokos" and "karamell" are correct calls on a barrel-aged wine —
 * but the category hierarchy files them under Krydder, Nøtter and Karamellisert
 * while `fat` sits under Treverk, so a hierarchical match scores them 0.
 *
 * Token embeddings do not close the gap either: measured on this corpus,
 * cos(fat, vanilje) = 0.09 after centering, *below* the 0.14 baseline for
 * genuinely unrelated descriptor pairs. The causal link is wine chemistry, not
 * distributional semantics, so no general-purpose embedding recovers it.
 *
 * Measured impact: 9.3% of wines mention oak, and 81% of those never spell out
 * a derived aroma. In the tasting corpus, 9 of 33 oaked-wine tastings named a
 * derived aroma the reference omits — all scored as wrong guesses before this.
 *
 * Direction
 * ---------
 * Edges read "reference note contains KEY  ⟹  user may report any of VALUES".
 * Reverse edges are listed explicitly where the inference genuinely runs both
 * ways (a taster who writes "fat" for a wine noted as "vanilje" has correctly
 * identified barrel treatment). Do not auto-symmetrise: "honning" implies
 * botrytis far more weakly than botrytis implies "honning".
 *
 * All keys and values must be surface forms present in `norwegianLemmas`,
 * which `derivations.test.ts` asserts.
 */

export const DERIVATIONS: Record<string, readonly string[]> = {
  // ── Barrel maturation ────────────────────────────────────────────────────
  // Vanillin, oak lactones, furfural and guaiacol from toasted oak.
  fat: ['vanilje', 'kokos', 'karamell', 'ristet', 'røyk', 'sedertre', 'sjokolade', 'mokka', 'toast', 'kanel', 'brent'],
  eik: ['vanilje', 'kokos', 'karamell', 'ristet', 'røyk', 'sedertre', 'sjokolade', 'mokka', 'toast', 'kanel', 'brent'],
  fatlagret: ['vanilje', 'kokos', 'karamell', 'ristet', 'røyk', 'sedertre', 'toast', 'brent'],
  fatkrydder: ['vanilje', 'kanel', 'nellik', 'krydder'],
  treverk: ['vanilje', 'sedertre', 'ristet', 'røyk'],

  // Reverse: naming the aroma correctly identifies the barrel.
  vanilje: ['fat', 'eik'],
  kokos: ['fat', 'eik'],
  sedertre: ['fat', 'eik'],
  toast: ['fat', 'eik', 'ristet'],
  mokka: ['fat', 'eik'],

  // ── Malolactic fermentation ──────────────────────────────────────────────
  // Diacetyl. Reference notes say "smør"; tasters often say "fløte"/"meieri".
  smør: ['fløte', 'meieri', 'karamell'],
  fløte: ['smør', 'meieri'],

  // ── Lees contact / autolysis ─────────────────────────────────────────────
  gjær: ['brioche', 'kjeks', 'bakverk', 'nøtt', 'mandel', 'brød'],
  gjærbakst: ['brioche', 'kjeks', 'bakverk', 'nøtt', 'mandel', 'brød', 'gjær'],
  bakverk: ['brioche', 'kjeks', 'gjær', 'brød'],
  brioche: ['gjær', 'bakverk', 'kjeks'],

  // ── Bottle age / tertiary development ────────────────────────────────────
  // Deliberately keyed on explicit age markers, never on "moden" (= ripe, not aged).
  lagret: ['lær', 'sopp', 'tobakk', 'skogbunn', 'tørket', 'fiken', 'sviske'],
  utviklet: ['lær', 'sopp', 'tobakk', 'skogbunn', 'tørket'],
  moden: [],

  // ── Noble rot ────────────────────────────────────────────────────────────
  // Keyed on the lemma only. "botrytis" is a surface form the dictionary maps
  // onto `edelråte`, so an edge keyed on it would never fire — the scorer only
  // ever sees lemmas. `derivations.test.ts` enforces this for every edge.
  edelråte: ['honning', 'aprikos', 'safran', 'marsipan', 'tørket'],

  // ── Carbonic maceration ──────────────────────────────────────────────────
  karbonsyremaserasjon: ['banan', 'drops', 'jordbær'],

  // ── Reductive handling / minerality ──────────────────────────────────────
  // Struck-match and saline notes tasters report on high-acid, low-oxygen wines.
  kalk: ['mineral', 'flint', 'stein', 'skjell', 'kritt'],
  flint: ['mineral', 'stein', 'røyk', 'krutt'],
  mineral: ['flint', 'stein', 'kalk', 'skjell'],
  skifer: ['mineral', 'stein', 'flint'],
} as const;

/**
 * Category-level terms that Vinmonopolet uses when it declines to be specific:
 * "Saftig mørk frukt og lett krydret". A taster who answers "solbær" has named
 * a blackcurrant, which *is* dark fruit — a strictly more precise correct
 * answer, not a near miss.
 *
 * The hierarchy alone scores that badly: `frukt` is filed under
 * Frukt og bær/annet and `solbær` under Frukt og bær/baer, so the subcategory
 * tiers disagree and only the weak main-category credit applies.
 *
 * Direction matters and runs one way only. Reference "frukt" + user "solbær" is
 * the taster being precise; reference "solbær" + user "frukt" is the taster
 * being vague, and keeps the ordinary taxonomic credit.
 *
 * A `sub` narrows the scope: "bær" licenses other berries, not every fruit.
 */
export const HYPERNYMS: Record<string, { main: string; sub?: string }> = {
  frukt: { main: 'Frukt og bær' },
  bær: { main: 'Frukt og bær', sub: 'baer' },
  sitrus: { main: 'Frukt og bær', sub: 'sitrus' },
  steinfrukt: { main: 'Frukt og bær', sub: 'steinfrukt' },
  kjernefrukt: { main: 'Frukt og bær' },
  krydder: { main: 'Krydder' },
  urt: { main: 'Urter' },
  blomst: { main: 'Blomst' },
  nøtt: { main: 'Nøtter' },
  treverk: { main: 'Treverk' },
  mineral: { main: 'Jordaktig' },
};

/**
 * Whether the reference generalises over the user's descriptor — i.e. the
 * reference used a category term and the taster named something inside it.
 */
export function isSpecificOfReference(
  userPath: { main?: string; sub?: string },
  referenceLemmas: Set<string>
): string | null {
  if (!userPath.main) return null;
  for (const lemma of referenceLemmas) {
    const scope = HYPERNYMS[lemma];
    if (!scope) continue;
    if (scope.main !== userPath.main) continue;
    if (scope.sub && scope.sub !== userPath.sub) continue;
    return lemma;
  }
  return null;
}

/** Reverse index: derived term → reference terms that license it. */
const REVERSE: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [source, derived] of Object.entries(DERIVATIONS)) {
    for (const d of derived) {
      if (!m.has(d)) m.set(d, new Set());
      m.get(d)!.add(source);
    }
  }
  return m;
})();

/**
 * Expand a reference note's lemma set with everything a taster could correctly
 * infer from it. Returns derived terms only — callers keep the original set
 * separately so a direct hit stays distinguishable from an inferred one.
 */
export function derivedFrom(referenceLemmas: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const lemma of referenceLemmas) {
    for (const d of DERIVATIONS[lemma] ?? []) out.add(d);
  }
  return out;
}

/**
 * Which reference lemma licensed a given user lemma, if any. Used by the
 * scoring-debug surface to explain why a term earned credit.
 */
export function derivationSource(userLemma: string, referenceLemmas: Set<string>): string | null {
  const sources = REVERSE.get(userLemma);
  if (!sources) return null;
  for (const s of sources) if (referenceLemmas.has(s)) return s;
  return null;
}
