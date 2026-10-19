/**
 * Prompt construction for wine-note enrichment.
 *
 * Two things have to be true of a generated note, and the prompt is where both
 * are enforced:
 *
 *   1. It must read as a Vinmonopolet note. Their editorial rule is "nøktern
 *      informasjon" — objective fact about smell, taste, grape composition,
 *      production method and food pairing, with no slogans, no praise, no
 *      emotive adjectives and no call to buy. A sweep of all 100 114 notes in
 *      the catalogue found 9 words from the marketing blocklist, so the corpus
 *      itself is the strictest statement of that rule.
 *
 *   2. It must be scoreable. The app grades a taster by matching their lemmas
 *      against the reference note's lemmas (src/lib/flavourScoring.ts). A note
 *      full of vocabulary the dictionary does not know is unfair in a new way:
 *      the taster names the right aroma and earns nothing. So the prompt hands
 *      the model the category's *actual* vocabulary, harvested from notes that
 *      already score well (scripts/build-note-style.ts), and the style gate in
 *      noteQuality.ts rejects output that drifts off it.
 *
 * Everything here that could be measured was measured. The style rules are
 * derived from note-style.generated.json rather than described from memory,
 * so regenerating the corpus statistics regenerates the prompt.
 */
import styleData from './note-style.generated.json';
import { assessNote, BANNED_EVALUATIVE_TERMS, BANNED_MARKETING_TERMS, MAX_NOTE_CHARS } from './noteQuality';

type CategoryStyle = {
  vocabulary: string[];
  exemplars: Array<{ name: string; smell: string; taste: string }>;
};

type StyleData = {
  generatedAt: string;
  corpusSize: number;
  strongNoteCount: number;
  limits: Record<'smell' | 'taste', { maxChars: number; medianChars: number; maxSentences: number }>;
  openers: Record<'smell' | 'taste', string[]>;
  categories: Record<string, CategoryStyle>;
};

const style = styleData as StyleData;

/** Fall back to red wine vocabulary — the largest category — for unknown types. */
const FALLBACK_CATEGORY = 'Rødvin';

export function styleForCategory(category: string | null | undefined): CategoryStyle {
  const exact = category ? style.categories[category.trim()] : undefined;
  return exact ?? style.categories[FALLBACK_CATEGORY];
}

export const noteStyleMetadata = {
  generatedAt: style.generatedAt,
  corpusSize: style.corpusSize,
  strongNoteCount: style.strongNoteCount
};

/**
 * The editorial principles, stated once. Norwegian, because the notes are
 * Norwegian and a Norwegian instruction keeps the model from translating its
 * way into English tasting-note idiom ("notes of", "hints of").
 */
const PRINCIPLES = `Du skriver produktbeskrivelser for et vinkatalogsystem etter Vinmonopolets redaksjonelle regler.

HOVEDPRINSIPPER
1. Nøktern informasjon. Beskrivelsen skal bare inneholde objektiv fakta om produktet: lukt, smak, druesammensetning, produksjonsmetode og matfølge. Ikke noe annet.
2. Ingen markedsføring. Ingen slagord, ingen rosende omtale, ingen følelsesladde adjektiver, ingen oppfordring til kjøp eller mersalg.
3. Ingen vurdering. Notatet sier hva som er der, ikke hvor bra det er. "Kompleks", "elegant" og "flott balanse" er vurderinger — dropp dem.
4. Ingen påstander du ikke har dekning for i kildene. Finn ikke på druer, lagring, fatbruk eller årgangspreg.
5. Upersonlig. Ingen "jeg", "vi" eller "du". Ingen tiltale til leseren.

DETTE UTLEDET AV KATALOGEN SELV
Reglene under er målt på ${style.corpusSize.toLocaleString('nb-NO')} viner, hvorav ${style.strongNoteCount.toLocaleString('nb-NO')} har fyldige notater som definerer stilen.
- Ingen note i katalogen er over ${MAX_NOTE_CHARS} tegn. Det er en hard grense.
- Luktnotatet er typisk ${style.limits.smell.medianChars} tegn, smaksnotatet ${style.limits.taste.medianChars} tegn. Én setning. Maks to.
- Luktnotatet åpner med aromaen: ${style.openers.smell
  .slice(0, 6)
  .map(o => `"${o}"`)
  .join(', ')}.
- Smaksnotatet åpner med struktur og munnfølelse, så aromaen: ${style.openers.taste
  .slice(0, 6)
  .map(o => `"${o}"`)
  .join(', ')}.
- Mengde uttrykkes med dempere, ikke superlativer: "litt", "innslag av", "hint av", "preg av", "tydelig". "litt" står i 64 % av de fyldige notatene.
- Modenhet og utvikling er fakta og hører hjemme: "ung", "ungdommelig", "moden", "modne", "litt utviklet", "tørket".
- Deskriptorene listes som en enkel oppramsing med komma og "og" til slutt. Ingen metaforer, ingen sammenligninger, ingen historier.
- Forbudte markedsføringsord: ${BANNED_MARKETING_TERMS.join(', ')}.
- Forbudte vurderingsord, i alle bøyninger: ${BANNED_EVALUATIVE_TERMS.join(', ')}. Disse sier hvor bra vinen er, ikke hva som er i den, og en smaker kan ikke få poeng for dem. Skriv hva du faktisk mener: ikke "fin struktur", men "fast" eller "stram"; ikke "kompleks", men navngi deskriptorene som gjør den det.`;

function exemplarBlock(category: string): string {
  const { exemplars } = styleForCategory(category);
  return exemplars.map((ex, i) => `${i + 1}. Lukt: ${ex.smell}\n   Smak: ${ex.taste}`).join('\n');
}

export type WineFacts = {
  name: string;
  productId: string;
  category: string | null;
  country: string | null;
  district: string | null;
  subDistrict: string | null;
  producer: string | null;
  year: string | null;
  grapes: string[] | null;
  /** 0-12 structural measurements from Vinmonopolet — facts, not opinions. */
  fylde: number | null;
  friskhet: number | null;
  garvestoff: number | null;
  sodme: number | null;
  alcohol: string | null;
  sugar: string | null;
  acidity: string | null;
  color: string | null;
  currentSmell: string | null;
  currentTaste: string | null;
};

function factsBlock(wine: WineFacts): string {
  const lines: Array<[string, unknown]> = [
    ['Navn', wine.name],
    ['Varenummer', wine.productId],
    ['Kategori', wine.category],
    ['Land', wine.country],
    ['Distrikt', [wine.district, wine.subDistrict].filter(Boolean).join(' / ')],
    ['Produsent', wine.producer],
    ['Årgang', wine.year],
    ['Druer', wine.grapes?.join(', ')],
    ['Alkohol', wine.alcohol],
    ['Sukker', wine.sugar],
    ['Syre', wine.acidity],
    ['Farge (Vinmonopolet)', wine.color],
    ['Fylde (0-12)', wine.fylde],
    ['Friskhet (0-12)', wine.friskhet],
    ['Garvestoff (0-12)', wine.garvestoff],
    ['Sødme (0-12)', wine.sodme]
  ];

  return lines
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n');
}

/** The query the search provider is asked, per wine. */
export function buildSearchQuery(wine: WineFacts): string {
  // Producer plus name plus vintage. "tasting note" in English pulls the critic
  // sites; the Norwegian and Swedish terms pull the Nordic monopolies, whose
  // register is the one we are writing in.
  const identity = [wine.producer, wine.name, wine.year].filter(Boolean).join(' ');
  return `${identity} tasting note aroma palate smaksnotat doft smak`;
}

/**
 * Step one: distil what the fetched sources say about this wine.
 *
 * The model no longer searches. src/lib/webSearch.ts queries the provider,
 * drops blocked hosts, fetches the pages and keeps only the sentences that
 * discuss taste; this prompt sees that text and nothing else. The model cannot
 * reach a source the domain policy excluded, which is the point — the previous
 * built-in-search version once cited a different producer's page despite being
 * told not to.
 *
 * Kept separate from generation so importer sales copy cannot leak its register
 * into the note.
 */
export function buildResearchPrompt(
  wine: WineFacts,
  documents: Array<{ title: string; url: string; snippet: string; text: string }>
): string {
  const identity = [wine.producer, wine.name, wine.year].filter(Boolean).join(' ');

  const corpus = documents
    .map(
      (doc, i) =>
        `[${i + 1}] ${doc.title}\n    ${doc.url}\n    ${doc.text || doc.snippet || '(ingen brukbar tekst hentet)'}`
    )
    .join('\n\n');

  return `Les kildene under og hent ut hva de sier om lukt og smak i "${identity}".

${factsBlock(wine)}

KILDER
${corpus || '(ingen kilder)'}

Regler:
- Bruk bare det som står i kildene. Ingenting utenfra, ingen utfylling fra hva du vet om druen.
- Kontroller produsent og vinnavn i hver kilde. Handler teksten om en annen vin — også en annen vin fra samme produsent — så hopp over den kilden og si hvilken du droppet.
- Gjelder en kilde en annen årgang, ta den med, men skriv hvilken årgang.
- Oversett deskriptorene til norsk (blackcurrant → solbær, oak → fat, leather → lær, körsbär → kirsebær).

Svar strukturert. Hold deg under 250 ord totalt.
- aroma / smak: deskriptorer kildene nevner, med kildenummer i parentes per deskriptor
- produksjon: fat, lagring, druesammensetning — bare hvis kildene sier det, ellers tom
- usedSources: én oppføring per kilde du hentet noe fra. For hver: kildenummeret, hvilken årgang kilden beskriver ("ukjent" hvis den ikke sier det), og wineName
- wineName er vinnavnet **slik kilden selv skriver det**, ordrett. Ikke navnet jeg oppga, ikke navnet du søkte på. Skriver kilden "Das Phantom", skriver du "Das Phantom" — også når du tror det er samme vin. Navnet sammenlignes automatisk, så et navn du har pyntet på blir en feil ingen oppdager.
- hasCoverage: sett false bare hvis INGEN av kildene beskriver akkurat denne vinen eller en nabo-årgang av den. Fant du deskriptorer, er hasCoverage true — også når du er usikker på detaljer. Usikkerhet hører hjemme i feltet uncertainty, ikke her.`;
}

/**
 * Step two: turn the findings into two notes in the catalogue's own voice.
 *
 * The vocabulary list is the load-bearing part. It is not a suggestion — it is
 * the set of words this app can score, so a note written outside it reads fine
 * and grades nobody.
 */
export function buildGenerationPrompt(
  wine: WineFacts,
  research: { findings: string; sources: Array<{ url: string }>; noCoverage: boolean }
): string {
  const category = wine.category ?? FALLBACK_CATEGORY;
  const { vocabulary } = styleForCategory(category);

  return `${PRINCIPLES}

EKSEMPLER PÅ GODKJENT STIL (${category}, hentet fra katalogen)
${exemplarBlock(category)}

ORDFORRÅD FOR ${category.toUpperCase()}
Dette er deskriptorene katalogen faktisk bruker for denne kategorien, sortert etter hvor vanlige de er:
${vocabulary.join(', ')}

Dette er ikke et forslag. Appen scorer smakeren ved å matche ordene deres mot ordene i notatet, så en deskriptor utenfor dette registeret gir null poeng uansett hvor treffende den er. Kildene er stort sett engelske og bruker ord norsk vinspråk ikke har — oversett dem til nærmeste ord i lista i stedet for å oversette dem bokstavelig:
- amarena cherry, morello, sour cherry → kirsebær eller morell
- cotton candy, bubblegum → drops
- pecan, hazelnut, walnut → nøtt
- graphite, slate, wet stone → mineral eller stein
- cassis → solbær
- forest floor, undergrowth → skogbunn
- dried herbs, garrigue → urt
Har en deskriptor ingen rimelig norsk motpart i lista, la den gå. Et notat med fem ord appen kan score er verdt mer enn ett med åtte den ikke kjenner.

VINEN
${factsBlock(wine)}

NÅVÆRENDE NOTAT (for tynt — det er derfor du er her)
- Lukt: ${wine.currentSmell?.trim() || '(mangler)'}
- Smak: ${wine.currentTaste?.trim() || '(mangler)'}

DESKRIPTORER SOM MÅ STÅ IGJEN
Vinmonopolet har smakt vinen. Deres deskriptorer er førstehåndsobservasjoner og skal med i det nye notatet, ord for ord. Du utvider notatet — du bytter ikke ut.
- Lukt: ${assessNote(wine.currentSmell).lemmas.join(', ') || '(ingen)'}
- Smak: ${assessNote(wine.currentTaste).lemmas.join(', ') || '(ingen)'}

RESEARCH FRA ${research.sources.length} KILDE${research.sources.length === 1 ? '' : 'R'}
${research.findings}

OPPGAVEN
Skriv ett nytt luktnotat og ett nytt smaksnotat.
- Hver eneste deskriptor i lista over skal være med. Kildene supplerer dem, de erstatter dem ikke.
- Navngi minst fire ulike aromadeskriptorer i hvert notat, fra minst to ulike kategorier (frukt, krydder, urter, blomst, treverk, nøtter, jordaktig).
- Luktnotatet: én setning, maks ${MAX_NOTE_CHARS} tegn, åpner med aromaen.
- Smaksnotatet: én setning, maks ${MAX_NOTE_CHARS} tegn, åpner med struktur og munnfølelse, så aromaen. Bruk de målte verdiene for fylde, friskhet, garvestoff og sødme til å beskrive strukturen riktig.
- Begge avsluttes med punktum.
- Confidence: "high" når flere av kildene beskriver akkurat denne vinen og er enige, "medium" når én kilde dekker den, "low" når researchen sier "INGEN DEKNING" eller bare dekker nabo-årganger. Denne researchen bygger på ${research.sources.length} kilde${research.sources.length === 1 ? '' : 'r'}${research.noCoverage ? ' og fant ingen dekning for akkurat denne vinen' : ''}.
- Basis: én setning som navngir hva notatene faktisk bygger på — hvilke kilder eller hvilket drue-/distriktsgrunnlag. Ikke "tilgjengelige kilder".
- Står det "INGEN DEKNING" i researchen, hold deg til det druen og distriktet gir dekning for.`;
}
