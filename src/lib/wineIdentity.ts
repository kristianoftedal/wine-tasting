/**
 * Is the source describing the same wine as the catalogue row?
 *
 * The enrichment pipeline asked the model this question directly and the model
 * answered wrong. Kirnbauer K+K Konquest 2018 was researched from a page about
 * "Das Phantom" and Santa Carolina Merlot 2015 from a note on "Reserva Merlot",
 * and in both cases the model marked the source as the same wine. Both produced
 * fluent, well-gated notes about a bottle nobody would be pouring.
 *
 * So the check moved into code, on the same reasoning as the domain policy in
 * webSearch.ts: a rule the model can be talked out of is not a rule. The model
 * still does the part only it can do — reading the page and reporting the wine
 * name as that page states it — and the comparison is deterministic.
 *
 * Two failure modes, both measured:
 *   - different cuvée entirely: "Das Phantom" against "K+K Konquest" shares no
 *     distinctive word.
 *   - different quality tier: "Reserva Merlot" against "Merlot" shares every
 *     word the naive check looks at, and is still a different bottling.
 */

/**
 * Tier markers that distinguish bottlings *within* a producer's range.
 *
 * Deliberately excludes appellation terms — "Bordeaux Supérieur" and "Chianti
 * Classico" name a place, not a tier, and the Vinmonopolet row routinely omits
 * the appellation ("Ch. Timberlay 2018") while the producer's page states it.
 * Treating those as a mismatch would reject correct sources.
 */
const TIER_MARKERS = [
  'reserva',
  'reserve',
  'riserva',
  'reserv',
  'vieilles vignes',
  'old vine',
  'old vines',
  'grand cru',
  'premier cru',
  '1er cru',
  'gran seleccion',
  'single vineyard'
];

/**
 * Words that appear in so many wine names they prove nothing about identity.
 * A shared "chateau" is not evidence that two Bordeaux are the same wine.
 */
const UNDISTINCTIVE = new Set([
  'chateau',
  'ch',
  'domaine',
  'dom',
  'weingut',
  'bodega',
  'bodegas',
  'cantina',
  'tenuta',
  'castello',
  'quinta',
  'maison',
  'winery',
  'estate',
  'cellars',
  'vineyards',
  'vineyard',
  'wines',
  'wine',
  'vin',
  'vino',
  'the',
  'and',
  'och',
  'og',
  'di',
  'de',
  'del',
  'della',
  'du',
  'des',
  'la',
  'le',
  'les',
  'el',
  'il',
  'da',
  'von',
  'van',
  'red',
  'white',
  'rouge',
  'blanc',
  'rosso',
  'bianco',
  'tinto',
  'blend',
  'cuvee'
]);

export function normalizeWineName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctiveTokens(name: string): Set<string> {
  return new Set(
    normalizeWineName(name)
      .split(' ')
      .filter(token => token.length >= 3 && !UNDISTINCTIVE.has(token))
  );
}

function tierMarkersIn(name: string): Set<string> {
  const normalized = ` ${normalizeWineName(name)} `;
  return new Set(TIER_MARKERS.filter(marker => normalized.includes(` ${marker} `)));
}

export type IdentityVerdict = { sameWine: boolean; reason: string };

/**
 * Remove the producer's own words from a wine name, leaving the cuvée.
 *
 * Without this the check passes on the producer alone: "Kirnbauer K+K Konquest"
 * and "K+K Kirnbauer Das Phantom" share "kirnbauer", and that was exactly the
 * wine the first batch got wrong. Identity lives in what distinguishes one
 * bottling from another in the same cellar, not in the cellar.
 */
function cuveeTokens(name: string, producer: string | null | undefined): Set<string> {
  const tokens = distinctiveTokens(name);
  if (!producer) return tokens;

  const producerTokens = distinctiveTokens(producer);
  const remaining = new Set([...tokens].filter(token => !producerTokens.has(token)));

  // Some catalogue rows are named after the producer and nothing else
  // ("Baron de L"). Stripping would leave nothing to compare on.
  return remaining.size > 0 ? remaining : tokens;
}

/**
 * Compare the catalogue name against the wine name the source itself states.
 *
 * `sourceName` must be what the page says, not what the search query asked for
 * — the whole point is to catch the case where they differ. Pass `producer` so
 * the comparison runs on the cuvée rather than on the shared producer name.
 */
export function verifyWineIdentity(
  catalogueName: string,
  sourceName: string,
  producer?: string | null
): IdentityVerdict {
  if (!sourceName?.trim()) {
    return { sameWine: false, reason: 'kilden oppgir ikke noe vinnavn' };
  }

  const ours = cuveeTokens(catalogueName, producer);
  const theirs = distinctiveTokens(sourceName);

  if (ours.size === 0) {
    // Nothing to compare against; do not invent confidence we do not have.
    return { sameWine: false, reason: 'katalognavnet har ingen særegne ord å sammenligne på' };
  }

  const shared = [...ours].filter(token => theirs.has(token));
  if (shared.length === 0) {
    return {
      sameWine: false,
      reason: `"${sourceName}" deler ingen særegne ord med "${catalogueName}"`
    };
  }

  const ourTiers = tierMarkersIn(catalogueName);
  const theirTiers = tierMarkersIn(sourceName);
  const extra = [...theirTiers].filter(tier => !ourTiers.has(tier));
  const missing = [...ourTiers].filter(tier => !theirTiers.has(tier));

  if (extra.length > 0 || missing.length > 0) {
    return {
      sameWine: false,
      reason: `ulikt kvalitetsnivå: "${sourceName}" mot "${catalogueName}" (${[...extra, ...missing].join(', ')})`
    };
  }

  return { sameWine: true, reason: `deler ${shared.join(', ')}` };
}

/**
 * Does the retrieved page mention this wine's cuvée anywhere at all?
 *
 * `verifyWineIdentity` compares a name the *model* reported, which means the
 * model can launder a mismatch by quoting the name it was given instead of the
 * one on the page — observed once on a producer homepage. This check reads the
 * retrieved bytes directly, so there is nothing to launder. Weaker on its own
 * (a producer's index page lists every cuvée) but independent, and the two
 * together are much harder to pass by accident.
 */
export function sourceMentionsCuvee(haystack: string, catalogueName: string, producer?: string | null): boolean {
  const tokens = cuveeTokens(catalogueName, producer);
  if (tokens.size === 0) return true;

  const normalized = ` ${normalizeWineName(haystack)} `;
  return [...tokens].some(token => normalized.includes(` ${token} `));
}

/** Does the source describe this wine's vintage, a neighbour, or neither? */
export function classifyVintage(wineYear: string | null, sourceVintage: string): 'exact' | 'neighbour' | 'unknown' {
  const ours = Number(wineYear);
  const theirs = Number(sourceVintage);
  if (!Number.isFinite(ours) || !Number.isFinite(theirs)) return 'unknown';
  if (ours === theirs) return 'exact';
  return Math.abs(ours - theirs) <= 2 ? 'neighbour' : 'unknown';
}
