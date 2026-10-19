# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Norwegian-language wine tasting app ("Smak Vin"). A user tastes a wine, writes what they perceive, and the app scores their note against Vinmonopolet's official reference note for that wine. Wine clubs organise group events and compare scores. Everything user-facing is in Norwegian — UI strings, route segments, database columns, and the lemma dictionaries.

## Commands

```bash
npm run dev            # Next.js dev server
npm run build          # production build
npm run test           # vitest watch
npm run test:run       # vitest single run
npx vitest run src/lib/flavourScoring.test.ts   # one test file
npx vitest run -t "derivation"                  # one test by name
npx tsc --noEmit       # typecheck (build does NOT typecheck — see Gotchas)
```

`npm run lint` is defined but **eslint is not in `devDependencies`** and is not installed — the script fails. `.eslintrc.json` documents the intended rules (`no-explicit-any`, `no-unused-vars` as errors); treat it as a style contract, not something you can run.

### Offline scripts

Scripts under `scripts/` are run with `tsx`. Most need Supabase and OpenAI credentials; they split into two conventions — check the file's header before running:

```bash
npx tsx --env-file=.env.local scripts/compute-corpus-mean.ts   # node flag style
npx tsx scripts/analyze-wine-vocabulary.ts                      # self-loads via dotenv
```

Scripts that write to the database dry-run by default and need `--execute` to persist (e.g. `recalculate-user-tasting-scores.ts`, `build-food-lemmas.ts`).

Named shortcuts: `npm run analyze`, `recalculate-scores`, `validate-scoring`, `benchmark-search`, `verify-search-migration`, `verify-search-production`, `record-search-comparison`, `make-scoring-slide`, `make-search-slide`, `build-note-style`, `audit-notes`, `enrich-notes`.

### Database

`scripts/schema.sql` is the consolidated schema; `scripts/0NN-*.sql` are incremental migrations applied in numeric order against Supabase. There is no migration runner — they are pasted into the Supabase SQL editor. `023-note-enrichment.sql` must be applied before the note-enrichment routine runs — the candidate scan selects `enrichment_status`. `021-search-overhaul.sql` has a **required post-deploy `VACUUM (ANALYZE) wines;`** that cannot run inside its transaction block; skipping it makes search ~10× slower.

## Architecture

Next.js 16 App Router + React 19, Supabase (Postgres + Auth + RLS + Realtime), OpenAI embeddings via the Vercel AI SDK. Jotai for client state, CSS Modules for styling. Path alias `@/*` → `./src/*`.

```
src/actions/   server actions + server-only modules (the app's service layer)
src/app/       routes, components, API routes, Jotai store
src/lib/       scoring engine, dictionaries, Supabase factories, domain types
scripts/       SQL migrations + offline analysis/benchmark/codegen
.planning/     GSD workflow artifacts (phase plans, verification, codebase maps)
```

### The scoring engine — the core of this codebase

This is the part that requires reading several files to understand, and the part most likely to be misunderstood.

**The objective, stated once:** reward a taster for descriptors they correctly named; *never* penalise them for descriptors they omitted. The reference note is a lookup table, never a denominator. `src/lib/scoringConfig.ts` is the authoritative commentary — it records which alternatives were tried and the measured numbers that rejected them. Read it before changing any constant.

Flow for smell (`lukt`) and taste (`smak`):

1. `src/app/components/tasting/Summary.tsx` (client) orchestrates. It calls `calculateServerSideScores` and computes the numeric components itself.
2. `src/actions/similarity.ts` (`'use server'`) is a thin I/O wrapper: sanitise → synonym-normalise → check scoreability → compute lexical credit → fetch the token MaxSim value → combine.
3. `src/lib/flavourScoring.ts` holds the **pure** scoring function. It is deliberately I/O-free so `scripts/benchmark-scoring.ts` exercises production code rather than a reimplementation that can drift. Credit ladder, best match wins: `direct` (1.0) → `derived` (1.0) → `specific` (0.85) → `subcategory` (0.6) → `category` (0.3).
4. `src/lib/derivations.ts` encodes oenological causation — the reference says "fat" (barrel), the taster says "vanilje", and that is a *correct* call. Embeddings do not recover this (measured cos(fat, vanilje) = 0.09, below the unrelated-pair baseline), so it is a hand-maintained map. `HYPERNYMS` handles the reverse case: reference generalises ("mørk frukt"), taster is more precise ("solbær").
5. `src/lib/semanticSimilarity.ts` → `tokenPrecisionSimilarity` is directional MaxSim over *user* tokens only. Omitted reference tokens are never iterated, so the loop direction *is* the scoring objective.
6. `src/lib/tokenEmbeddings.ts` caches per-token embeddings in a process-local map (the descriptor vocabulary is closed, ~892 tokens), and `src/lib/embeddingCentering.ts` subtracts the corpus mean before use. Uncentered cosine between two *unrelated* wine notes is 0.459 — that floor is the model noticing both texts are Norwegian wine prose, which carries zero information.

Things that are structurally load-bearing:

- **`scoreable: false`** — 18.7% of Vinmonopolet taste notes describe only structure and name no aroma. `hasScoreableFlavour` returns false, `serverSideSimilarity` returns `null`, and `Summary.tsx` **drops** the component from the weighted average rather than scoring it 0.
- **Colour uses a different path.** `semanticOnlySimilarity` → `rawSemanticSimilarity` embeds the text with no term stripping; the generic-term filter would destroy "lys rubinrød".
- **Weight profiles** (`src/lib/profiles/`) set per-category lemma weights, selected by `NEXT_PUBLIC_WEIGHT_PROFILE` (`inverted` default, or `moderate`).
- **`src/lib/lemmatizeAndWeight.ts`** (~1000 lines) is the Norwegian lemma dictionary + stopwords + `sanitizeText`/`stripGenericTerms`/`flavorOnlyText`. Every key in `DERIVATIONS` and `HYPERNYMS` must exist here as a *lemma* surface form — `derivations.test.ts` enforces it.
- **`src/actions/scoring-debug.ts`** computes both the current and the legacy algorithm side by side to power the debug UI and `/scoring-demo`. It is explanation, not scoring — do not route production scores through it.

### Wine search

Type-ahead search is a `GET` at `src/app/api/wine-search/route.ts`, not a server action, specifically so responses are cacheable and in-flight requests are abortable while the user types. It calls `src/actions/wine-search.ts` (`server-only`, not `'use server'`, because it also exports a class), which calls the `search_wines_fuzzy` Postgres function.

Two rules:

- **`foldSearchQuery` in `src/lib/validation.ts` must stay byte-identical to `wine_fold()` in `scripts/021-search-overhaul.sql`.** The DB stores pre-folded search columns; any divergence silently returns nothing. This is the bug that made "andre clouet" miss "André Clouet".
- **There is no fallback path, by design.** An earlier `ilike` fallback masked a total RPC failure and presented it as "search sometimes returns nothing". Errors now propagate as `WineSearchError`.

Ranking is a tier ladder inside the SQL function (exact product_id 1.00 → exact folded name 0.98 → prefix 0.92 → word-start 0.85 → all tokens 0.80 → substring 0.75 → fuzzy trigram 0.60× → metadata 0.50/0.40×), each tier a separately bounded index-backed branch. Client tunables live in `src/lib/constants.ts` with the reasoning attached (3-char floor is a pg_trgm constraint, not a preference; debounce is deliberately 0).

### Food-and-wine pairing

`src/actions/food-pairing.ts` takes a free-form Norwegian query, expands it via `src/lib/food-synonyms.ts` into the exact canonical terms stored in the DB, retrieves articles by tag overlap and embedding similarity, then has an LLM emit a structured recommendation (zod schema) including categorical sensory targets that map onto the wines table's 0–12 scales.

The column names mislead and the file says so: real *occasions* (Jul og nyttår, 17. mai) live in `wine_articles.food_tags`, while `occasion_tags` holds the *course* (Hovedrett, Forrett). Route by content, never by column name. Term matching is case-sensitive `TEXT[]` overlap — "Svin", not "Svinekjøtt".

### Recommendations

`src/actions/wine-recommendations-sql.ts` scores candidates against the user's high-rated wines: for each candidate, the mean of its top-3 similarities to that set, rather than one comparison against a concatenated corpus (which collapses to an average-wine centroid identical for everyone). Falls back to `@xenova/transformers` MiniLM locally if the OpenAI call throws.

### Wine-note enrichment

The scoring engine credits a taster only for descriptors the reference note names. Measured across all 50 057 wines: **18.7% of taste notes name no aroma at all** and 23.5% name exactly one. A club tasting "Duft av røde bær." is capped at one direct hit however well they taste, while the next bottle is graded against a note naming eight descriptors. That is a reference-data gap, not a scoring bug.

**Enrichment is driven by events, not by the catalogue.** Measured on the live data: 29 376 rows need enrichment, 41 wines have ever been tasted or put in an event, and **none of the 25 rows the first batch enriched had ever reached a user** — the "worst note first" queue did exactly what it was told and picked the most broken notes, which are obscure bottles nobody will pour. The binding cost was never the ~$0.002 per wine of API calls; it is that every note needs a human to approve it in `/admin/notater` before scoring may use it, and nobody can review 29 376 of them.

So `events.wines` is the queue. Creating an event triggers `enrichEventNotes` in an `after()` callback — that is the moment the database first learns which bottles will be poured, and it happens days before anyone tastes them, which is the lead time both the research (~8 s per wine) and the human review need. `enrichUpcomingEventNotes` is the backstop: `after()` can be cut short by the platform, and wines added from the edit screen are saved client-side with no server action to hook, so a periodic sweep turns both into a delay rather than a miss. A targeted scan filters in the query rather than paging the whole table, so an event costs a scan of its own wines, not 59 000 rows.

`src/lib/noteEnrichment.ts` closes it in three separate stages:

1. **Select** — `src/lib/noteQuality.ts` measures every note through the *same* sanitise → synonym-normalise → lemma pipeline that scoring uses, so the queue is ordered by actual handicap. `char_length(taste)` would rank "Fyldig og med strukturerte tanniner. Frisk i avslutning." above "Solbær, plomme og fat." and get it exactly backwards — which is why the scan is a full table read rather than an indexed query.

   **Any paged `.range()` scan of `wines` must carry `.order('id')`.** PostgREST guarantees no ordering without it, so pages overlap: an unordered scan reported 46 rows carrying an `enrichment_status` against 23 actually written — rows were double-counted *and* never scanned at all. Three consecutive audits disagreed by 1 000 wines. With the order clause they are identical.

   Candidates are then **deduplicated**: 39.8% of needy rows are the same wine listed more than once (bottle sizes, straight duplicates). Researching each separately pays for the same search repeatedly and produces a *different* note per row — three rows of Kirnbauer K+K Konquest 2018 came back with three different aroma lists. The group key includes the current note text, not just the identity, so every row in a group has identical inputs and the preservation/improvement gates stay valid for all of them.
2. **Research** — `src/lib/webSearch.ts` queries a search provider (`SERPER_API_KEY`, else `TAVILY_API_KEY`, else `BRAVE_API_KEY`), drops blocked hosts, fetches the surviving pages and keeps only sentences that discuss taste; an LLM then distils them. Doing the search ourselves rather than through a model-side tool makes the source policy **enforceable in code** — the earlier built-in-search version cited a different producer's Vivino page despite being told not to. Deliberately a separate call from generation, so importer sales copy cannot leak its register into the note.

   Measured constraint: the premium critics cannot be fetched directly. `jancisrobinson.com` and `wineenthusiast.com` return 403; `decanter.com` serves 92 kB of HTML that reduces to 428 characters of metadata with the tasting note paywalled out of the markup. They still reach the prompt, but through the search engine's indexed **snippet**. What fetches cleanly is producer sites (ghisolfi.com yielded 2 005 characters) and the Nordic monopolies. Hence 8 snippet sources, 5 full fetches.
3. **Generate** — a second call, no tools, sees only the distilled findings plus the house style, and must clear the style gate in `noteQuality.ts`.

Four gates stand between a draft and the database, all in `noteQuality.ts`:

- **Style** — ≤100 chars (the measured maximum across the whole catalogue), ≤2 sentences, closing period, ≥3 aroma lemmas, no marketing vocabulary, no evaluative vocabulary, no second person, OOV ratio ≤0.40 (the 99th percentile of authentic notes).

  Two blocklists, answering different questions: `BANNED_MARKETING_TERMS` (is this sales copy) and `BANNED_EVALUATIVE_TERMS` (is this an opinion — `elegant`, `delikat`, `kompleks`, `fin`, `flott`, `harmonisk`). The evaluative list holds generated notes to a **stricter standard than the catalogue holds itself**: `kompleks` appears in 3 765 of the 99 722 live notes and `fin` in 2 129. That is deliberate — a taster cannot earn credit for "kompleks", so it is wasted space in a note whose only job is to be scoreable. Matching enumerates Norwegian inflections rather than using substrings, because `fin` as a substring flags `raffinert` and `definert`, and an open suffix swallows `finkornede`, a legitimate tannin texture.
- **Preservation** — `droppedDescriptors` rejects any rewrite that loses a lemma the Vinmonopolet note named. Their text is a first-hand observation; enrichment extends it, never edits it.
- **Improvement** — each component must not lose ground (`isNotWorse`) and the wine must gain somewhere (`isImprovement`). Only 4.8% of wines are thin in *both* components, so demanding that an already-good smell note also improve would throw away correct rewrites of the broken taste note beside it.
- **Sourcing** — `requireSources` (default **true**) refuses to write when the research found nothing about the specific wine. Without it the model writes a plausible note for the grape and the district, which grades everyone against descriptors nobody observed.
- **Identity** — `src/lib/wineIdentity.ts` rejects sources that are not this bottling. Two wines in the first live batch were written from a *different cuvée by the same producer* — Kirnbauer K+K Konquest graded against "Das Phantom", Santa Carolina Merlot against "Reserva Merlot" — and passed every other gate, because every other gate asks whether the note is well written, not whether it is about this wine.

  Asking the model directly ("is this the same wine?") does not work: it answered true for both, twice, with the rule spelled out. So the model only *quotes the wine name as the page states it*, and the comparison is code. Two independent checks — `verifyWineIdentity` compares the quoted name against the catalogue name with the **producer stripped** (identity lives in the cuvée; "Kirnbauer" is shared by every wine in the cellar), and `sourceMentionsCuvee` reads the retrieved bytes so a model that quotes the name it was handed still cannot launder a mismatch. Tier markers (`reserva`, `grand cru`, …) must match on both sides; appellation terms deliberately do not count, because Vinmonopolet rows routinely omit them.

**Nothing reads `smell_enriched`/`taste_enriched` for scoring.** Writes land with `enrichment_status = 'pending'`; promoting a wine to `'approved'` is a deliberate editorial act, and `wines.smell`/`wines.taste` are never overwritten so a catalogue re-import never has to reconcile with generated prose.

Entry points:

Requires `SERPER_API_KEY` (or `TAVILY_API_KEY` / `BRAVE_API_KEY`) and, for the API route, `NOTE_ENRICHMENT_TOKEN`.

```bash
npm run enrich-event-notes                           # wines in upcoming events — the normal run
npm run enrich-notes -- --event=<uuid> --execute     # one event's wines
npm run audit-notes                                  # counts only, no LLM calls
npm run enrich-notes -- --limit=5                    # dry run over the whole catalogue
npm run enrich-notes -- --product=12267801 --execute
```

A catalogue-wide run is the exception, not the default — see the event-driven note above.

```bash
curl -H "Authorization: Bearer $NOTE_ENRICHMENT_TOKEN" https://…/api/admin/note-enrichment
# the scope worth scheduling on a cron:
curl -X POST -H "Authorization: Bearer $NOTE_ENRICHMENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"scope":"events","dryRun":false}' https://…/api/admin/note-enrichment
```

The route is a bearer-token endpoint, not a server action, because it is driven by curl and cron and must work without a browser session — which also means it cannot use Supabase auth, hence the service-role client in `src/lib/supabase/admin.ts`. `POST` is a dry run unless the body says `"dryRun": false`.

### Note review

`/admin/notater` is the editorial queue. Every row has already cleared the automated gates; what is left is the judgement no gate can make — whether the sources are convincing for this bottle. The page surfaces the residual signals the gates deliberately do not act on (neighbouring vintage, single source, low confidence, thin taste note), because each can be legitimate.

Access is an email allowlist in `NOTE_REVIEW_ADMINS`, checked server-side in every action and **fail-closed** — unset means nobody can approve. There is no role column on `profiles`. Approve/reject run under the caller's session, not the service role: RLS already requires an authenticated user to update `wines`, and review is a normal logged-in action rather than a maintenance job. The update is conditional on `enrichment_status = 'pending'`, so a stale tab cannot flip an already-decided note.

`scripts/024-note-review.sql` adds `reviewed_at` / `reviewed_by` and must be applied before the page can write.

`src/lib/notePrompt.ts` builds the prompt. Its style rules are *derived* from `note-style.generated.json`, not described from memory, so regenerating the corpus statistics regenerates the prompt. The load-bearing part is the per-category vocabulary: it is the set of words this app can score, so a note written outside it reads fine and grades nobody.

### Generated files

Never hand-edit these; regenerate them:

| File | Regenerate with |
|---|---|
| `src/lib/corpus-mean.generated.json` | `scripts/compute-corpus-mean.ts` — **model-specific**, rerun on any embedding-model change |
| `src/lib/idf-weights.generated.json` | `scripts/compute-idf-weights.ts` |
| `src/lib/food-synonyms.generated.json` | `scripts/build-food-lemmas.ts --execute` |
| `src/lib/note-style.generated.json` | `scripts/build-note-style.ts` — rerun after a catalogue import or a lemma-dictionary change |

## Domain vocabulary

Norwegian terms appear as identifiers, DB columns, and route segments. Non-exhaustive:

| Term | Meaning |
|---|---|
| `farge` / `lukt` / `smak` | colour / smell / taste |
| `fylde` / `friskhet` / `garvestoff(er)` / `sodme` | body / acidity / tannin / sweetness |
| `karakter` | the user's own 1–10 overall grade |
| `egenskaper` | free-text comment |
| `smaking` | tasting | 
| `gruppe` / `arrangement` / `invitasjon` | group / event / invite |
| `toppliste` / `profil` / `mat-og-vin` | leaderboard / profile / food-and-wine |
| `frukt`, `bær`, `krydder`, `urter`, `blomst`, `treverk`, `nøtter`, `jordaktig` | aroma categories (`src/lib/categories/types.ts`) |

Note the spelling drift between layers: the wines table uses `garvestoff` (singular) while tastings use `garvestoffer`.

## Conventions

- Prettier: single quotes, 120 cols, 2 spaces, no trailing comma, `arrowParens: avoid`, `bracketSameLine: true`, `singleAttributePerLine: true`.
- Tests are colocated (`src/**/*.test.ts`) and run under the `node` environment — vitest only picks up `.test.ts`, not `.tsx`, so there is no component testing.
- Server code reads Supabase via `createClient()` from `@/lib/supabase/server` (async, cookie-aware, **returns `null` when env vars are missing** — callers must handle that); client code uses the singleton in `@/lib/supabase/client` (throws instead).
- DB rows are snake_case (`src/lib/types.ts` mirrors them exactly); form/UI state is camelCase.
- Non-obvious decisions are documented as long file-header comments that cite measured numbers. Match that style — when changing scoring or search behaviour, update the reasoning, not just the code.

## Gotchas

- `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `tsconfig.json` has `strict: false`. A green `npm run build` proves nothing about types — run `npx tsc --noEmit` separately.
- **`README.md` is stale on scoring.** It describes the previous "semantic floor + precision bonus" formula, `min(user, wine)` overlap coefficient, an obsolete six-category hierarchy, and a `/sommailer` route that no longer exists. It also states colour weight 1.0 where `Summary.tsx` weights it 0.2. Trust the code and `scoringConfig.ts`.
- `src/lib/supabase/middleware.ts` exports `updateSession` but there is no root `middleware.ts` importing it — route protection is currently not enforced at the edge.
- `src/app/api/embeddings/route.ts` hardcodes the embedding model instead of importing `EMBEDDING_MODEL`; change both if you swap models (and regenerate the corpus mean).
