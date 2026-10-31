# Smak Vin

A Norwegian-language wine tasting app. You pick a wine, taste it, describe what you perceive, and the app scores your note against Vinmonopolet's official description. Wine clubs organise group events and compare scores.

For architecture, design decisions and gotchas aimed at contributors, see [CLAUDE.md](CLAUDE.md). It is the more detailed and more current of the two documents.

## Features

- **Tasting flow** ([/smaking/[id]](src/app/smaking)): enter colour (`farge`), smell (`lukt`) and taste (`smak`), numeric impressions for body (`fylde`), acidity (`friskhet`), tannin (`garvestoffer`) and sweetness (`sodme`), plus alcohol %, a price guess and an overall grade (`karakter`). Each component is scored 0–100 and combined into an overall score.
- **Groups and events** ([/gruppe](src/app/gruppe), [/arrangement](src/app/arrangement), [/invitasjon](src/app/invitasjon)): organise group tastings around a scheduled event, invite members by link, and compare results.
- **Profile and history** ([/profil](src/app/profil)): tasting history, preference analytics and recommendations.
- **Wine recommendations** ([wine-recommendations-sql.ts](src/actions/wine-recommendations-sql.ts)): wines similar to your highly rated tastings.
- **Leaderboard** ([/toppliste](src/app/toppliste)).
- **Food and wine pairing** ([/mat-og-vin](src/app/mat-og-vin)): a free-form Norwegian food query returns a structured wine recommendation.
- **Wine search**: type-ahead fuzzy search over the catalogue ([/api/wine-search](src/app/api/wine-search/route.ts)).
- **Note enrichment and review** ([/admin/notater](src/app/admin/notater)): fills in thin reference notes for wines in upcoming events. Each note needs an editor's approval before scoring can use it.
- **Scoring demo** ([/scoring-demo](src/app/scoring-demo)): explains how a note was scored, comparing the current and legacy algorithms side by side.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Supabase (Postgres, Auth, RLS, Realtime, `pg_trgm`, `pgvector`)
- OpenAI `text-embedding-3-small` via the Vercel AI SDK
- Jotai for client state, CSS Modules for styling
- Vitest for tests, `tsx` for scripts

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys (see Environment variables)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Database.** There is no migration runner. For a fresh Supabase project, paste [scripts/schema.sql](scripts/schema.sql) into the SQL editor (it consolidates migrations 001–016), then apply `scripts/017-*.sql` through `scripts/024-*.sql` in numeric order. After `021-search-overhaul.sql`, run `VACUUM (ANALYZE) wines;` separately. It cannot run inside the migration's transaction, and without it search is roughly 10× slower.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build. **Does not typecheck** (`ignoreBuildErrors: true`) |
| `npx tsc --noEmit` | Typecheck |
| `npm run test` / `npm run test:run` | Vitest watch / single run |
| `npm run analyze` | Find wine vocabulary missing from the lemma dictionary |
| `npm run recalculate-scores` | Re-lemmatise wines under the active weight profile (dry run) |
| `npm run validate-scoring` | Compare weight profiles on fixed test cases |
| `npm run benchmark-search` | Benchmark wine search |
| `npm run enrich-event-notes` | Enrich reference notes for wines in upcoming events |
| `npm run audit-notes` | Count notes needing enrichment (no LLM calls) |

`npm run lint` is defined, but ESLint is not installed, so the script fails. Scripts that write to the database dry-run by default and need `--execute`. See [CLAUDE.md](CLAUDE.md) for the full script list.

## How scoring works

The authoritative explanation, including the alternatives that were measured and rejected, is in [src/lib/scoringConfig.ts](src/lib/scoringConfig.ts). This is a summary.

### Components and weights

The overall score is a weighted average of the components that apply. Orchestration happens in [Summary.tsx](src/app/components/tasting/Summary.tsx).

| Component | Compared with | Method | Weight |
|---|---|---|---|
| Colour (`farge`) | `wines.color` | Embedding similarity of the raw text | 0.2 |
| Smell (`lukt`) | `wines.smell` | Flavour scoring (below) | 1.0 |
| Taste (`smak`) | `wines.taste` | Flavour scoring (below) | 1.0 |
| Body, acidity, tannin, sweetness | `fylde`, `friskhet`, `garvestoff`, `sodme` (0–12 scales) | `100 × (1 − |Δ| / 12)`. A one-step miss costs 8 points anywhere on the scale | 1.0 each |
| Alcohol % | `wines.alcohol` | Error relative to the larger value | 0.2 |
| Price | `wines.price` | Error relative to the larger value | 0.2 |

A component is **dropped** from the average, not scored 0, when the wine has no reference value. For smell and taste, this also covers a reference note that names no aroma at all, which applies to 18.7% of Vinmonopolet taste notes. A reference value of 0 on a numeric scale is a real reading and is scored.

### Flavour scoring (smell and taste)

The objective is to reward the taster for descriptors they named correctly and **never penalise them for descriptors they left out**. The reference note works as a lookup table, never as a denominator.

1. **Lexical credit.** Both texts are sanitised, synonym-normalised and lemmatised against the Norwegian dictionary in [lemmatizeAndWeight.ts](src/lib/lemmatizeAndWeight.ts). Each user lemma earns the best of the following credits, multiplied by its category weight:

   | Match | Credit |
   |---|---|
   | Direct: same lemma | 1.0 |
   | Derived: an oenological consequence, e.g. reference "fat" and taster "vanilje" ([derivations.ts](src/lib/derivations.ts)) | 1.0 |
   | Specific: reference names a category, taster names something inside it ("mørk frukt" → "solbær") | 0.85 |
   | Same subcategory | 0.6 |
   | Same main category | 0.3 |

   Matched mass saturates: `hitScore = 100 × (1 − e^(−mass / 3))`. One correct specific descriptor gives about 49, and four give about 93.
2. **Soft credit.** Directional MaxSim over the *user's* tokens only, using per-token embeddings centred on the corpus mean ([semanticSimilarity.ts](src/lib/semanticSimilarity.ts)). This gives partial credit for near-synonyms the dictionary does not link.
3. **Combine** ([flavourScoring.ts](src/lib/flavourScoring.ts)):

   ```
   blended = 0.55 × hitScore + 0.45 × softScore
   score   = blended × (0.6 + 0.4 × precision)
   ```

   `precision` is the share of the user's own weighted mass that matched anything. It discourages padding a note with guesses without punishing a short note.

### Weight profiles

[src/lib/profiles/weights.ts](src/lib/profiles/weights.ts) sets a weight for each aroma category (Frukt og bær, Krydder, Urter, Blomst, Treverk, Karamellisert, Nøtter, Jordaktig, Animalsk, Grønnsaker) plus a lower weight for `GENERIC` structural terms. Select a profile with `NEXT_PUBLIC_WEIGHT_PROFILE`: `inverted` (the default, specific categories mostly at 2.0 and GENERIC at 1.3) or `moderate` (gentler, GENERIC at 1.2).

### Recalculating historical scores

When scoring changes, existing tastings keep their old scores. [scripts/recalculate-user-tasting-scores.ts](scripts/recalculate-user-tasting-scores.ts) reruns the pipeline. By default it covers one user; `--all` covers every tasting. It is a dry run unless you pass `--execute`.

```bash
npx tsx scripts/recalculate-user-tasting-scores.ts --all             # preview
npx tsx scripts/recalculate-user-tasting-scores.ts --all --execute   # write
```

## Environment variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: server-only, used by scripts and the note-enrichment route
- `OPENAI_API_KEY`: embeddings and LLM calls

Optional:

- `NEXT_PUBLIC_WEIGHT_PROFILE`: `inverted` (default) or `moderate`
- `NEXT_PUBLIC_SITE_URL`: canonical site URL for metadata
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: auth redirect during local development
- `SERPER_API_KEY`, `TAVILY_API_KEY` or `BRAVE_API_KEY`: web search provider for note enrichment (checked in that order)
- `NOTE_ENRICHMENT_TOKEN`: bearer token for `/api/admin/note-enrichment`
- `NOTE_REVIEW_ADMINS`: comma-separated email allowlist for `/admin/notater`. If unset, nobody can approve notes
- `SCORING_RECALL_ENABLED`, `SEMANTIC_FLAVOR_FILTER_ENABLED`: defaults for `/scoring-demo` only. Production scoring ignores them

## Project structure

```
src/
  actions/      server actions and server-only modules (scoring, search, pairing, recommendations, enrichment)
  app/          App Router pages, components, API routes, Jotai store
  lib/          scoring engine, lemma dictionary, derivations, note enrichment, Supabase factories, types
scripts/        SQL schema and migrations, offline analysis, benchmarks, codegen
```

## Tests

```bash
npm run test:run
```

Tests sit next to the code they cover (`src/**/*.test.ts`) and run in the `node` environment. They cover the lemmatiser, derivations, flavour and numeric scoring, profiles, search-query folding, food synonyms, and the note-quality, web-search and wine-identity gates of note enrichment. Vitest only picks up `.test.ts`, so there are no component tests.
