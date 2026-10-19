import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildGenerationPrompt,
  buildResearchPrompt,
  buildSearchQuery,
  noteStyleMetadata,
  type WineFacts
} from './notePrompt';
import { rankSources, retrieveDocuments, searchWeb, WebSearchError } from './webSearch';
import { classifyVintage, sourceMentionsCuvee, verifyWineIdentity } from './wineIdentity';
import {
  assessNote,
  assessWineNotes,
  droppedDescriptors,
  isImprovement,
  isNotWorse,
  validateGeneratedNote,
  type NoteAssessment,
  type WineNoteAssessment
} from './noteQuality';

/**
 * Wine-note enrichment: find reference notes too vague to grade a taster
 * against, research the wine against independent sources, and rewrite the
 * notes in the catalogue's own register.
 *
 * Why this exists: the scoring engine credits a taster only for descriptors the
 * reference note names (src/lib/scoringConfig.ts). Measured on the live
 * catalogue, 18.7% of taste notes name no aroma at all and 23.5% name exactly
 * one. A club tasting "Duft av røde bær." is capped at one direct hit no matter
 * how well its members taste, while the next bottle is graded against a note
 * naming eight descriptors. That is not a scoring bug — it is a reference-data
 * gap, and it can only be closed by better reference data.
 *
 * Three stages, deliberately separate:
 *   1. select   — src/lib/noteQuality.ts measures every note with the same
 *                 lemma pipeline scoring uses, so the queue is ordered by
 *                 actual handicap rather than by string length.
 *   2. research — src/lib/webSearch.ts queries a search provider, drops blocked
 *                 hosts, fetches the surviving pages and keeps the sentences
 *                 that discuss taste; an LLM then distils them. Doing the search
 *                 ourselves rather than through a model-side tool makes the
 *                 source policy enforceable in code — the built-in-search
 *                 version once cited a different producer's page despite being
 *                 told not to. Kept apart from generation so importer sales copy
 *                 cannot leak its register into the note.
 *   3. generate — a second call, no tools, sees only the distilled findings and
 *                 the house style, and its output must clear the style gate in
 *                 noteQuality.ts before it is written anywhere.
 *
 * Writes go to smell_enriched/taste_enriched with status 'pending'. The
 * imported Vinmonopolet text is never overwritten and nothing reads the
 * enriched columns for scoring — promoting a wine to 'approved' is a separate,
 * deliberate act.
 *
 * Lives in src/lib rather than src/actions, and takes its Supabase client as a
 * parameter, for the same reason flavourScoring.ts does: scripts/enrich-wine-
 * notes.ts has to run the real pipeline offline. A `server-only` import would
 * make that impossible and a reimplementation would drift. The server-only
 * wrapper that supplies the service-role client is src/actions/note-enrichment.ts.
 */

const RESEARCH_MODEL = 'gpt-4o-mini';
const GENERATION_MODEL = 'gpt-4o-mini';

/** Search results requested per wine, before the domain policy thins them. */
const SEARCH_RESULTS = 10;
/**
 * Sources passed to the model. Snippets cost nothing once the query is paid
 * for, and they carry the critic content our own fetcher cannot reach —
 * jancisrobinson.com and wineenthusiast.com return 403, decanter.com paywalls
 * the note out of the HTML entirely. See src/lib/webSearch.ts.
 */
const SNIPPET_SOURCES = 8;
/** Of those, how many pages we also fetch in full. Producer sites and the Nordic
 * monopolies are where a full fetch actually adds something. */
const DOCUMENTS_READ = 5;

/** Retries of the generation call when the style gate rejects the output. */
const GENERATION_ATTEMPTS = 2;

/**
 * Wines assessed per batch request. The audit scan is a full table read (~50k
 * rows, five columns); this bounds the LLM work that follows it, not the scan.
 */
export const DEFAULT_BATCH_SIZE = 10;
export const MAX_BATCH_SIZE = 50;

/**
 * Batch ceiling for anything running inside a serverless invocation.
 *
 * Vercel's Hobby plan caps a function at 60 seconds, which bounds both the API
 * route and the `after()` callback that event creation fires. Measured cost is
 * roughly 8 s per wine — a search, up to five page fetches, and two LLM calls —
 * which at CONCURRENCY 3 amortises to ~2.7 s each. Reserving ~15 s for the
 * scan, the event insert and the response leaves room for about sixteen; twelve
 * keeps headroom for a slow source.
 *
 * The ceiling counts wines that *need* enrichment, not bottles on the list —
 * `candidateLimit` is applied after `needsEnrichment` filtering. Roughly half
 * of an event's wines qualify (4 of 8 on the first real event), so twelve
 * covers a bottle list of around two dozen and does not bind on any realistic
 * tasting. MAX_BATCH_SIZE still applies offline, where the only limit is
 * patience.
 */
export const SERVERLESS_BATCH_SIZE = 12;

/** Concurrent wines in flight. Each is two LLM calls, one of them web search. */
const CONCURRENCY = 3;

const SELECT_COLUMNS =
  'id,product_id,name,year,main_category,main_country,district,sub_district,main_producer,' +
  'grapes,alcohol,sugar,acidity,color,smell,taste,fylde,friskhet,garvestoff,sodme,enrichment_status';

const PAGE_SIZE = 1000;

type WineRow = {
  id: string;
  product_id: string;
  name: string;
  year: string | null;
  main_category: string | null;
  main_country: string | null;
  district: string | null;
  sub_district: string | null;
  main_producer: string | null;
  grapes: string[] | null;
  alcohol: string | null;
  sugar: string | null;
  acidity: string | null;
  color: string | null;
  smell: string | null;
  taste: string | null;
  fylde: number | null;
  friskhet: number | null;
  garvestoff: number | null;
  sodme: number | null;
  enrichment_status: string | null;
};

export type EnrichmentCandidate = {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  smell: string | null;
  taste: string | null;
  assessment: WineNoteAssessment;
  /** Everything the generation prompt needs about the wine — grape, district, structure. */
  facts: WineFacts;
  /**
   * Other wines row ids that are the same wine with the same notes — different
   * bottle sizes, or the same product listed more than once. Researched once,
   * written to all of them.
   */
  duplicateRowIds: string[];
};

export class NoteEnrichmentError extends Error {
  constructor(
    message: string,
    readonly code: 'not_configured' | 'query_failed' | 'write_failed'
  ) {
    super(message);
    this.name = 'NoteEnrichmentError';
  }
}

function toWineFacts(row: WineRow): WineFacts {
  return {
    name: row.name,
    productId: row.product_id,
    category: row.main_category,
    country: row.main_country,
    district: row.district,
    subDistrict: row.sub_district,
    producer: row.main_producer,
    year: row.year,
    grapes: row.grapes,
    fylde: row.fylde,
    friskhet: row.friskhet,
    garvestoff: row.garvestoff,
    sodme: row.sodme,
    alcohol: row.alcohol,
    sugar: row.sugar,
    acidity: row.acidity,
    color: row.color,
    currentSmell: row.smell,
    currentTaste: row.taste
  };
}

// ─── Stage 1: selection ───────────────────────────────────────────────────────

export type ScanOptions = {
  /** Restrict to one Vinmonopolet category ("Rødvin", "Hvitvin", …). */
  category?: string;
  /** Only wines whose handicap score reaches this. See assessWineNotes. */
  minPriority?: number;
  /** Re-examine wines already attempted. Default false — skip anything with a status. */
  includeAttempted?: boolean;
  /** Specific product IDs, bypassing the queue entirely. */
  productIds?: string[];
  /**
   * Specific `wines.id` values, bypassing the queue entirely.
   *
   * This is how the event trigger addresses wines: `events.wines` is a TEXT[]
   * of wine UUIDs, not product IDs.
   */
  wineIds?: string[];
};

/**
 * Wine ids that appear in an event that has not happened yet.
 *
 * The queue used to be ordered by how broken a note was, which is the right
 * ranking for the wrong question. Measured on the live data: 29 376 rows need
 * enrichment, 41 wines have ever been tasted or put in an event, and **none of
 * the 25 rows the first batch enriched had ever reached a user**. The binding
 * cost was never the API calls — it is that every note needs a human to approve
 * it before scoring may use it, and nobody can review 29 376 of them.
 *
 * An upcoming event is the one signal in this database that says, in advance,
 * "these specific bottles will be poured".
 */
export async function upcomingEventWineIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('events').select('wines').gte('date', new Date().toISOString());

  if (error) throw new NoteEnrichmentError(`events lookup failed: ${error.message}`, 'query_failed');

  return [...new Set((data ?? []).flatMap(event => (event.wines as string[] | null) ?? []).filter(Boolean))];
}

/** Wine ids attached to one event, whether or not it has happened. */
export async function eventWineIds(supabase: SupabaseClient, eventId: string): Promise<string[]> {
  const { data, error } = await supabase.from('events').select('wines').eq('id', eventId).maybeSingle();

  if (error) throw new NoteEnrichmentError(`event lookup failed: ${error.message}`, 'query_failed');

  return [...new Set(((data?.wines as string[] | null) ?? []).filter(Boolean))];
}

export type NoteQualityAudit = {
  scanned: number;
  needingEnrichment: number;
  /** Candidates after collapsing duplicate rows of the same wine. */
  distinctCandidates: number;
  verdicts: {
    smell: Record<string, number>;
    taste: Record<string, number>;
  };
  byCategory: Record<string, { scanned: number; needingEnrichment: number }>;
  alreadyAttempted: Record<string, number>;
  /** Highest-handicap wines first. */
  candidates: EnrichmentCandidate[];
};

/**
 * Read every wine and measure both notes.
 *
 * This is a full table scan on purpose. Note precision is a function of the
 * lemma dictionary, not of anything Postgres can index — `char_length(taste)`
 * would rank "Fyldig og med strukturerte tanniner. Frisk i avslutning." above
 * "Solbær, plomme og fat." and get the ordering exactly backwards.
 */
export async function auditNoteQuality(
  supabase: SupabaseClient,
  options: ScanOptions & { candidateLimit?: number } = {}
): Promise<NoteQualityAudit> {
  const candidateLimit = options.candidateLimit ?? 100;

  const audit: NoteQualityAudit = {
    scanned: 0,
    needingEnrichment: 0,
    distinctCandidates: 0,
    verdicts: { smell: {}, taste: {} },
    byCategory: {},
    alreadyAttempted: {},
    candidates: []
  };

  const ranked: EnrichmentCandidate[] = [];

  // A targeted scan addresses a handful of rows by key. Paging the whole
  // 59 000-row table to find them would make the event trigger cost a full
  // table read per event, so the filtered query is the whole scan.
  const targeted = Boolean(options.wineIds?.length || options.productIds?.length);
  if (options.wineIds?.length === 0) return audit;

  for (let from = 0; ; from += PAGE_SIZE) {
    // order('id') is load-bearing, not tidiness. PostgREST guarantees no
    // ordering without it, so .range() pages overlap: an unordered scan of this
    // table reported 46 rows carrying an enrichment_status against 23 actually
    // written, meaning rows were both double-counted and never scanned at all.
    let query = supabase
      .from('wines')
      .select(SELECT_COLUMNS)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (options.category) query = query.eq('main_category', options.category);
    if (options.productIds?.length) query = query.in('product_id', options.productIds);
    if (options.wineIds?.length) query = query.in('id', options.wineIds);

    const { data, error } = await query;
    if (error) throw new NoteEnrichmentError(`wines scan failed at offset ${from}: ${error.message}`, 'query_failed');
    if (!data?.length) break;

    for (const row of data as unknown as WineRow[]) {
      audit.scanned++;
      const category = row.main_category ?? 'Ukjent';
      audit.byCategory[category] ??= { scanned: 0, needingEnrichment: 0 };
      audit.byCategory[category].scanned++;

      const assessment = assessWineNotes(row.smell, row.taste);
      audit.verdicts.smell[assessment.smell.verdict] = (audit.verdicts.smell[assessment.smell.verdict] ?? 0) + 1;
      audit.verdicts.taste[assessment.taste.verdict] = (audit.verdicts.taste[assessment.taste.verdict] ?? 0) + 1;

      if (row.enrichment_status) {
        audit.alreadyAttempted[row.enrichment_status] = (audit.alreadyAttempted[row.enrichment_status] ?? 0) + 1;
      }

      if (!assessment.needsEnrichment) continue;
      if (options.minPriority !== undefined && assessment.priority < options.minPriority) continue;

      audit.needingEnrichment++;
      audit.byCategory[category].needingEnrichment++;

      if (!options.includeAttempted && row.enrichment_status && !targeted) continue;

      ranked.push({
        id: row.id,
        productId: row.product_id,
        name: row.name,
        category: row.main_category,
        smell: row.smell,
        taste: row.taste,
        assessment,
        facts: toWineFacts(row),
        duplicateRowIds: []
      });
    }

    if (data.length < PAGE_SIZE) break;
  }

  // 39.8% of the needy rows are the same wine listed more than once — different
  // bottle sizes, or a straight duplicate. Researching each separately pays for
  // the same search eight times over and, worse, produces a different note for
  // each: three rows of Kirnbauer K+K Konquest 2018 came back with three
  // different aroma lists. Group them, research the group once, write to all.
  //
  // The key includes the current note text, not just the identity, so every row
  // in a group has identical inputs. That keeps the preservation and
  // improvement gates valid for every row the result is written to.
  const groups = new Map<string, EnrichmentCandidate[]>();
  for (const candidate of ranked) {
    const key = [candidate.facts.producer ?? '', candidate.name, candidate.smell ?? '', candidate.taste ?? '']
      .join('|')
      .toLowerCase();
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  const deduped = [...groups.values()].map(([representative, ...rest]) => ({
    ...representative,
    duplicateRowIds: rest.map(duplicate => duplicate.id)
  }));

  audit.distinctCandidates = deduped.length;
  audit.candidates = deduped
    .sort((a, b) => b.assessment.priority - a.assessment.priority || a.productId.localeCompare(b.productId))
    .slice(0, candidateLimit);

  return audit;
}

// ─── Stage 2: research ────────────────────────────────────────────────────────

export type ResearchResult = {
  findings: string;
  sources: Array<{ url: string; title: string }>;
  /** Vintages the surviving sources describe. Empty when none stated one. */
  vintages: string[];
  /** Whether any surviving source covers this wine's own vintage. Review signal. */
  vintageMatch: 'exact' | 'neighbour' | 'unknown';
  /** True when the model reported it found nothing about this specific wine. */
  noCoverage: boolean;
};

const ResearchSchema = z.object({
  /**
   * The previous version parsed "INGEN DEKNING" out of free text. The model
   * wrote a complete, well-sourced answer and then put that phrase in its
   * uncertainty field, so every good result was thrown away — and one run
   * misspelled it "INGREN DEKNING", which no substring match would have caught
   * either way. A boolean cannot be misspelled.
   */
  hasCoverage: z.boolean().describe('false bare hvis ingen kilde beskriver denne vinen eller en nabo-årgang av den.'),
  aroma: z.string().describe('Aromadeskriptorer kildene nevner, på norsk, med kildenummer.'),
  taste: z.string().describe('Smaksdeskriptorer og struktur, på norsk, med kildenummer.'),
  production: z.string().describe('Fat, lagring, druesammensetning. Tom streng hvis kildene ikke sier noe.'),
  usedSources: z
    .array(
      z.object({
        index: z.number().describe('Kildenummeret.'),
        vintage: z.string().describe('Årgangen kilden beskriver, eller "ukjent".'),
        wineName: z.string().describe('Vinnavnet slik kilden selv skriver det, ordrett. Ikke navnet i oppgaven.')
      })
    )
    .describe('Kildene du faktisk hentet noe fra, én oppføring per kilde.'),
  uncertainty: z.string().describe('Forbehold, f.eks. at et notat gjelder en annen årgang. Tom hvis ingen.')
});

export async function researchWine(wine: WineFacts): Promise<ResearchResult> {
  const query = buildSearchQuery(wine);

  // Search, filter, fetch — all before the model sees anything. A blocked host
  // is never read, so no instruction has to hold it back.
  const hits = rankSources(await searchWeb(query, SEARCH_RESULTS)).slice(0, SNIPPET_SOURCES);
  if (hits.length === 0) {
    return { findings: '', sources: [], vintages: [], vintageMatch: 'unknown', noCoverage: true };
  }

  // Fetch bodies for the top few; the rest contribute their search snippet.
  const fetched = await retrieveDocuments(hits.slice(0, DOCUMENTS_READ));
  const documents = [...fetched, ...hits.slice(DOCUMENTS_READ).map(hit => ({ ...hit, text: '' }))];

  // A page whose fetch failed still contributes its search snippet, but a
  // result set with no body text at all is a search that found nothing about
  // this wine dressed up as eight links.
  const usable = documents.filter(doc => doc.text.length > 0 || doc.snippet.length > 0);
  if (usable.length === 0) {
    return { findings: '', sources: [], vintages: [], vintageMatch: 'unknown', noCoverage: true };
  }

  const { output } = await generateText({
    model: openai(RESEARCH_MODEL),
    output: Output.object({ schema: ResearchSchema }),
    temperature: 0,
    prompt: buildResearchPrompt(wine, usable)
  });

  // Credit only what the model drew on, and only where it confirms the source is
  // the same wine.
  //
  // This is the gate that was missing. Two wines in the first live batch got
  // plausible, well-formed notes built from sources about a *different cuvée by
  // the same producer* — Kirnbauer K+K Konquest graded against "Das Phantom",
  // Santa Carolina Merlot against "Reserva Merlot". Both passed every other
  // check, because every other check asks whether the note is well written, not
  // whether it is about this bottle. A taster scored against those descriptors
  // is being graded on a wine they did not drink.
  //
  // The model is asked only to quote the wine name as the page states it. The
  // comparison is verifyWineIdentity, in code — when the model was asked to
  // judge "same wine?" directly it answered true for both of the wrong-wine
  // cases above, twice, even with the rule spelled out in the prompt.
  const matched = output.usedSources
    .map(used => ({ used, doc: usable[used.index - 1] }))
    .filter((entry): entry is { used: (typeof output.usedSources)[number]; doc: (typeof usable)[number] } =>
      Boolean(entry.doc)
    )
    // Two independent checks. The first compares the name the model reported
    // against the catalogue name; the second reads the retrieved bytes, so a
    // model that quotes the name it was handed rather than the one on the page
    // still cannot get a mismatched source through.
    .filter(({ used }) => verifyWineIdentity(wine.name, used.wineName, wine.producer).sameWine)
    .filter(({ doc }) =>
      sourceMentionsCuvee(`${doc.title} ${doc.url} ${doc.snippet} ${doc.text}`, wine.name, wine.producer)
    );

  const sources = matched.map(({ doc }) => ({ url: doc.url, title: doc.title }));

  // Vintages the surviving sources actually describe, so a reviewer can see at a
  // glance that a 2014 wine was written from a 2012 note.
  const vintages = [...new Set(matched.map(({ used }) => used.vintage).filter(v => v && v !== 'ukjent'))];

  // A source describing the exact vintage, or one within two years of it. Used
  // only to flag the row for review — a neighbouring vintage is legitimate
  // evidence for grape, site and house style, just weaker evidence.
  const vintageMatch = vintages.some(v => classifyVintage(wine.year, v) === 'exact')
    ? 'exact'
    : vintages.some(v => classifyVintage(wine.year, v) === 'neighbour')
      ? 'neighbour'
      : 'unknown';

  const findings = [
    `AROMA: ${output.aroma}`,
    `SMAK: ${output.taste}`,
    output.production ? `PRODUKSJON: ${output.production}` : '',
    output.uncertainty ? `USIKKERHET: ${output.uncertainty}` : '',
    `KILDER: ${sources.map(source => source.url).join(', ') || '(ingen)'}`
  ]
    .filter(Boolean)
    .join('\n');

  return {
    findings,
    sources,
    vintages,
    vintageMatch,
    // No source survived the same-wine check, so as far as this pipeline is
    // concerned nothing was found about this wine at all.
    noCoverage: !output.hasCoverage || matched.length === 0
  };
}

// ─── Stage 3: generation ──────────────────────────────────────────────────────

const GeneratedNotesSchema = z.object({
  smell: z.string().describe('Luktnotat på norsk. Én setning, maks 100 tegn, avsluttes med punktum.'),
  taste: z
    .string()
    .describe('Smaksnotat på norsk. Én setning, maks 100 tegn, åpner med struktur, avsluttes med punktum.'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe(
      'high: flere kilder beskriver akkurat denne vinen. low: ingen kildedekning, utledet av drue og distrikt.'
    ),
  basis: z.string().describe('Én setning om hva notatene bygger på. Norsk.')
});

export type GeneratedNotes = z.infer<typeof GeneratedNotesSchema>;

export type EnrichmentOutcome =
  | {
      status: 'enriched';
      notes: GeneratedNotes;
      sources: ResearchResult['sources'];
      before: Components;
      after: Components;
    }
  | {
      status: 'rejected';
      reason: string;
      problems: string[];
      notes?: GeneratedNotes;
      sources: ResearchResult['sources'];
    }
  | { status: 'error'; reason: string };

type Components = { smell: NoteAssessment; taste: NoteAssessment };

/**
 * Research, write, and gate one wine. Performs no I/O against the database —
 * `runEnrichmentBatch` decides whether the outcome is worth persisting, so the
 * same function is usable from a dry run, the API and the CLI script.
 */
export async function enrichWine(
  wine: WineFacts,
  options: { requireSources?: boolean } = {}
): Promise<EnrichmentOutcome> {
  const requireSources = options.requireSources ?? true;

  let research: ResearchResult;
  try {
    research = await researchWine(wine);
  } catch (error) {
    if (error instanceof WebSearchError && error.code === 'not_configured') throw error;
    return { status: 'error', reason: `research failed: ${(error as Error).message}` };
  }

  // Without a source the model writes a plausible note for the grape and the
  // district rather than for the bottle. That reads fine and grades everyone
  // against descriptors nobody observed, which is the unfairness this pipeline
  // exists to remove. Refuse by default; an operator who wants type-typical
  // notes for an obscure catalogue has to ask for them.
  if (requireSources && (research.sources.length === 0 || research.noCoverage)) {
    return {
      status: 'rejected',
      reason: 'ingen kilde beskriver akkurat denne vinen — samme produsent og samme cuvée',
      problems: [],
      sources: research.sources
    };
  }

  const before: Components = {
    smell: assessNote(wine.currentSmell),
    taste: assessNote(wine.currentTaste)
  };

  let lastProblems: string[] = [];
  let lastNotes: GeneratedNotes | undefined;

  for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt++) {
    let notes: GeneratedNotes;
    try {
      const retryHint =
        attempt === 1
          ? ''
          : `\n\nFORRIGE FORSØK BLE AVVIST\n${lastProblems.map(p => `- ${p}`).join('\n')}\nSkriv om og rett akkurat disse punktene.`;

      const { output } = await generateText({
        model: openai(GENERATION_MODEL),
        output: Output.object({ schema: GeneratedNotesSchema }),
        temperature: attempt === 1 ? 0.2 : 0.5,
        prompt: buildGenerationPrompt(wine, research) + retryHint
      });
      notes = output;
    } catch (error) {
      return { status: 'error', reason: `generation failed: ${(error as Error).message}` };
    }

    lastNotes = notes;
    const smellCheck = validateGeneratedNote(notes.smell);
    const tasteCheck = validateGeneratedNote(notes.taste);
    const problems = [...smellCheck.problems.map(p => `lukt: ${p}`), ...tasteCheck.problems.map(p => `smak: ${p}`)];

    // Neither component may lose descriptors, and the wine has to gain somewhere
    // — otherwise the run costs two LLM calls and rewrites reference data for
    // no measurable benefit to a taster.
    if (smellCheck.ok && !isNotWorse(before.smell, smellCheck.assessment)) {
      problems.push(
        `lukt: dårligere enn dagens note (${before.smell.aromaLemmas} → ${smellCheck.assessment.aromaLemmas} aromaord)`
      );
    }
    if (tasteCheck.ok && !isNotWorse(before.taste, tasteCheck.assessment)) {
      problems.push(
        `smak: dårligere enn dagens note (${before.taste.aromaLemmas} → ${tasteCheck.assessment.aromaLemmas} aromaord)`
      );
    }
    for (const component of [
      { label: 'lukt', check: smellCheck, before: before.smell },
      { label: 'smak', check: tasteCheck, before: before.taste }
    ]) {
      if (!component.check.ok) continue;
      const dropped = droppedDescriptors(component.before, component.check.assessment);
      if (dropped.length > 0) {
        problems.push(`${component.label}: mistet deskriptorer fra originalnotatet: ${dropped.join(', ')}`);
      }
    }

    const gained =
      isImprovement(before.smell, smellCheck.assessment) || isImprovement(before.taste, tasteCheck.assessment);
    if (smellCheck.ok && tasteCheck.ok && !gained) {
      problems.push('ingen av notatene navngir flere aromaer enn dagens');
    }

    if (problems.length === 0) {
      return {
        status: 'enriched',
        notes,
        sources: research.sources,
        before,
        after: { smell: smellCheck.assessment, taste: tasteCheck.assessment }
      };
    }
    lastProblems = problems;
  }

  return {
    status: 'rejected',
    reason: research.noCoverage
      ? 'ingen kildedekning og utkastet besto ikke stilkravene'
      : 'utkastet besto ikke stilkravene',
    problems: lastProblems,
    notes: lastNotes,
    sources: research.sources
  };
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export type BatchOptions = ScanOptions & {
  limit?: number;
  /**
   * Refuse to write a note when the research turned up no usable source for
   * this wine. Default true — see enrichWine.
   */
  requireSources?: boolean;
  /** Research and generate, report the result, write nothing. Default true. */
  dryRun?: boolean;
};

export type BatchItemResult = {
  productId: string;
  name: string;
  category: string | null;
  priority: number;
  reasons: string[];
  /** Rows written, counting duplicate listings of the same wine. */
  appliedToRows: number;
  before: { smell: string | null; taste: string | null };
  outcome: EnrichmentOutcome;
  persisted: boolean;
};

export type BatchResult = {
  dryRun: boolean;
  requested: number;
  processed: number;
  enriched: number;
  rejected: number;
  errored: number;
  audit: Pick<
    NoteQualityAudit,
    'scanned' | 'needingEnrichment' | 'distinctCandidates' | 'verdicts' | 'alreadyAttempted'
  >;
  styleVersion: typeof noteStyleMetadata;
  items: BatchItemResult[];
};

async function persist(
  supabase: SupabaseClient,
  candidate: EnrichmentCandidate,
  outcome: EnrichmentOutcome
): Promise<void> {
  // Every duplicate row of this wine gets the same note and the same provenance.
  const rowIds = [candidate.id, ...candidate.duplicateRowIds];
  const base = {
    enriched_at: new Date().toISOString(),
    enrichment_meta: {
      researchModel: RESEARCH_MODEL,
      generationModel: GENERATION_MODEL,
      style: noteStyleMetadata,
      priority: candidate.assessment.priority,
      reasons: candidate.assessment.reasons
    } as Record<string, unknown>
  };

  if (outcome.status === 'enriched') {
    base.enrichment_meta = {
      ...base.enrichment_meta,
      confidence: outcome.notes.confidence,
      basis: outcome.notes.basis,
      before: { smell: outcome.before.smell, taste: outcome.before.taste },
      after: { smell: outcome.after.smell, taste: outcome.after.taste }
    };

    const { error } = await supabase
      .from('wines')
      .update({
        ...base,
        smell_enriched: outcome.notes.smell,
        taste_enriched: outcome.notes.taste,
        enrichment_status: 'pending',
        enrichment_sources: outcome.sources
      })
      .in('id', rowIds);

    if (error)
      throw new NoteEnrichmentError(`update failed for ${candidate.productId}: ${error.message}`, 'write_failed');
    return;
  }

  // Record the failure too. Without it the next run re-researches the same
  // wine, pays for the same web search and gets the same refusal.
  const { error } = await supabase
    .from('wines')
    .update({
      ...base,
      enrichment_status: 'failed',
      enrichment_meta: {
        ...base.enrichment_meta,
        failure: outcome.reason,
        problems: outcome.status === 'rejected' ? outcome.problems : []
      },
      enrichment_sources: outcome.status === 'rejected' ? outcome.sources : []
    })
    .in('id', rowIds);

  if (error)
    throw new NoteEnrichmentError(`update failed for ${candidate.productId}: ${error.message}`, 'write_failed');
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Audit the catalogue, take the worst `limit` wines, and enrich them.
 *
 * Dry run is the default. A run that writes costs two LLM calls per wine and
 * changes reference data the whole scoring system reads, so it has to be asked
 * for explicitly.
 */
export async function runEnrichmentBatch(supabase: SupabaseClient, options: BatchOptions = {}): Promise<BatchResult> {
  const dryRun = options.dryRun ?? true;
  const limit = Math.min(options.limit ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

  const audit = await auditNoteQuality(supabase, { ...options, candidateLimit: limit });

  const items = await mapWithConcurrency<EnrichmentCandidate, BatchItemResult>(
    audit.candidates,
    CONCURRENCY,
    async candidate => {
      const outcome = await enrichWine(candidate.facts, { requireSources: options.requireSources });

      let persisted = false;
      if (!dryRun && outcome.status !== 'error') {
        await persist(supabase, candidate, outcome);
        persisted = true;
      }

      return {
        productId: candidate.productId,
        name: candidate.name,
        category: candidate.category,
        priority: candidate.assessment.priority,
        reasons: candidate.assessment.reasons,
        appliedToRows: 1 + candidate.duplicateRowIds.length,
        before: { smell: candidate.smell, taste: candidate.taste },
        outcome,
        persisted
      };
    }
  );

  return {
    dryRun,
    requested: limit,
    processed: items.length,
    enriched: items.filter(i => i.outcome.status === 'enriched').length,
    rejected: items.filter(i => i.outcome.status === 'rejected').length,
    errored: items.filter(i => i.outcome.status === 'error').length,
    audit: {
      scanned: audit.scanned,
      needingEnrichment: audit.needingEnrichment,
      distinctCandidates: audit.distinctCandidates,
      verdicts: audit.verdicts,
      alreadyAttempted: audit.alreadyAttempted
    },
    styleVersion: noteStyleMetadata,
    items
  };
}
