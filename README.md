# Wine Tasting

A tasting-note web app for Norwegian wine enthusiasts. You pick a wine, taste it, describe what you sense, and the app scores your notes against Vinmonopolet's official description. The more accurately your description reflects what the wine actually shows — colour, aromas, flavours, structure — the higher you score.

## Features

- **Tasting flow** ([/smaking/[id]](src/app/smaking)) — enter colour (`farge`), smell (`lukt`), taste (`smak`), plus numeric impressions for body (`fylde`), acidity (`friskhet`), tannin (`snaerp`), sweetness (`sodme`), alcohol %, price guess, and an overall grade (`karakter`). Each component is scored 0–100 against the wine's reference data, and combined into an overall score.
- **Groups and events** ([/gruppe](src/app/gruppe), [/arrangement](src/app/arrangement)) — organise group tastings around a scheduled event and compare scores across participants.
- **Profile and history** ([/profil](src/app/profil)) — tasting history, preference analytics, awards, and tunable recommendation weights.
- **Wine recommendations** ([src/actions/wine-recommendations-sql.ts](src/actions/wine-recommendations-sql.ts)) — finds wines similar to your highly-rated tastings using numeric attributes plus OpenAI semantic similarity on smell/taste descriptions.
- **Leaderboard** ([/toppliste](src/app/toppliste)) — top-rated wines aggregated across users.
- **Sommelier chat** ([/sommailer](src/app/sommailer)) — conversational AI assistant for wine questions.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Postgres + Auth + RLS + Realtime)
- OpenAI `text-embedding-3-small` via Vercel AI SDK for semantic similarity
- Local `@xenova/transformers` (MiniLM-L6-v2) as an offline fallback for recommendations
- Jotai for client state, `react-hook-form` for forms, CSS Modules for styling
- Vitest for tests, `tsx` for scripts

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys — see Environment variables below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Apply the schema by running the migrations in [scripts/](scripts/) in numeric order against a fresh Supabase project (001, 002, …, 013).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run lint` | ESLint |
| `npm run analyze` | Analyse wine vocabulary across the wines table to find unmapped terms |
| `npm run recalculate-scores` | Re-lemmatise all wines under the active weight profile (dry-run) |
| `npm run validate-scoring` | Compare weight profiles on a fixed set of specific-vs-generic test cases |

## How scoring works

A tasting has nine scored components. Each produces an integer 0–100; the overall score is a weighted average of the components that apply (some are skipped when the wine lacks reference data).

### Per-component scoring

| Component | Source | Method | Weight in overall |
|---|---|---|---|
| Colour (`farge`) | user text vs `wines.color` | OpenAI semantic similarity | 1.0 |
| Smell (`lukt`) | user text vs `wines.smell` | Semantic + precision bonus (below) | 1.0 |
| Taste (`smak`) | user text vs `wines.taste` | Semantic + precision bonus (below) | 1.0 |
| Body (`fylde`) | user 1–10 vs `wines.fylde` | `100 − |Δ| × 20` | 1.0 |
| Acidity (`friskhet`) | user 1–10 vs `wines.friskhet` | `100 − |Δ| × 20` | 1.0 |
| Tannin (`snaerp`) | user 1–10 vs `wines.garvestoff` | `100 − |Δ| × 20` | 1.0 |
| Sweetness (`sodme`) | user 1–10 vs `wines.sodme` | `100 − |Δ| × 20` | 1.0 |
| Alcohol % | user guess vs `wines.alcohol` | numeric proximity | 0.2 |
| Price | user guess vs `wines.price` | numeric proximity | 0.2 |

Smell and taste are skipped from the overall when the wine's reference text is shorter than 10 characters. Numeric characteristics are skipped when the wine has no reference value.

### Reward-stacking formula for smell and taste

Smell and taste use three signals combined with a semantic-baseline + precision-bonus formula. Three parts:

**1. Semantic similarity (meaning floor)**
The user's text and the wine's text are both sanitised (lowercased, punctuation stripped, filler and colour adjectives removed), then embedded with `text-embedding-3-small`. The cosine similarity of the two embeddings scales to 0–100. This catches "you got the right idea" even when the exact words differ.

**2. Weighted lemma overlap (precision)**
Each word is looked up in a Norwegian lemma dictionary ([norwegianLemmas](src/lib/lemmatizeAndWeight.ts)). Known words carry a weight from the active profile (see below). The lemma overlap is the weighted intersection of user lemmas and wine lemmas divided by the smaller side's weighted mass:

```
lemmaScore = Σ weight[L] for L in (user ∩ wine)   ÷   min(Σ user weights, Σ wine weights)
```

Using the smaller side as denominator — the *overlap coefficient* — means a short, precise user note isn't penalised for being shorter than the wine's long prose. Matching specific descriptors (Frukt = 2.0) counts more than matching filler (GENERIC = 1.0), so "solbær" is worth twice "balanse" at the default profile.

**3. Hierarchical category match (precision)**
Each lemma has a `categoryPath` like `{ main: 'Frukt', sub: 'baer' }`. User lemmas earn full weight credit when their full path matches a wine lemma, and half credit when only the `main` matches. "solbær" and "kirsebær" both sit in Frukt/baer and fully match; "frukt" and "solbær" share Frukt → half credit. This lets a user who writes "mørke bær" get partial credit against a wine note that lists specific berries.

**Combining them**

```
precision = (lemmaScore + categoryScore) / 2
bonus     = max(0, precision − 30) × 0.35
final     = clamp(semantic + bonus, 0, 100)
```

Semantic is always the *floor* — the lemma and category signals can never pull a score below what the embedding found. They only add up to ~25 points of bonus when the user also names specific descriptors. This is the explicit design: reward for being in the ballpark, extra reward for being precise, no penalty for not being precise.

### Weight profiles

[src/lib/profiles/weights.ts](src/lib/profiles/weights.ts) defines presets for how much each main category counts. Active profile is picked by the `NEXT_PUBLIC_WEIGHT_PROFILE` env var (default: `inverted`).

| Profile | Specific categories | GENERIC | Effect |
|---|---|---|---|
| `inverted` (default) | 2.0 | 1.0 | Specific descriptor matches count 2× filler matches |
| `moderate` | 1.8–2.2 | 1.2 | Same direction, gentler differentiation |

### Dictionary and category hierarchy

- Lemmas live in [norwegianLemmas](src/lib/lemmatizeAndWeight.ts) — a Norwegian dictionary mapping inflected forms (`bæret`, `bærene`, `fruktig`, `jordpreg`, etc.) to canonical lemmas (`bær`, `frukt`, `jord`) with their hierarchical category paths.
- Stopwords live in the same file. Includes colour adjectives (`rød`, `mørk`, `grønn`) and vague intensifiers (`litt`, `middels`, `ung`) so "røde bær" collapses to "bær" on both sides of the comparison.
- Category hierarchy is [MainCategory × WineSubcategory](src/lib/categories/types.ts) — six wine-aroma mains (Frukt, Krydder, Urter, Blomster, Eik/fat, Mineral) plus a GENERIC bucket for structural terms.

### Recalculating historical scores

When the scoring logic changes, existing tastings carry their old scores. [scripts/recalculate-user-tasting-scores.ts](scripts/recalculate-user-tasting-scores.ts) reruns the pipeline against every tasting for a given user and writes the new `color_score`, `smell_score`, `taste_score`, and `overall_score` back to the database. It dry-runs by default; pass `--execute` to persist.

```bash
npx tsx scripts/recalculate-user-tasting-scores.ts              # preview
npx tsx scripts/recalculate-user-tasting-scores.ts --execute    # write
```

## Environment variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-side safe)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only, used by scripts)
- `OPENAI_API_KEY` — for embeddings and the sommelier chat

Optional:
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway token if routing OpenAI through the gateway
- `NEXT_PUBLIC_WEIGHT_PROFILE` — `inverted` (default) or `moderate`

## Project structure

```
src/
  actions/           # Next.js server actions (tasting, similarity, recommendations, wine search)
  app/               # App Router pages, components, API routes, global store
    components/      # Reusable UI (incl. tasting/Summary.tsx — the scoring orchestrator)
    arrangement/     # Group event flow
    gruppe/          # Groups
    profil/          # Profile tabs (history, preferences, awards)
    smaking/[id]/    # Tasting entry for a specific wine
    sommailer/       # AI sommelier chat
    toppliste/       # Leaderboard
  lib/
    categories/      # Main category + subcategory types
    profiles/        # Weight profiles (inverted, moderate) and getActiveProfile()
    supabase/        # Client/server/middleware Supabase factories
    lemmatizeAndWeight.ts   # Norwegian lemma dictionary, stopwords, sanitizeText
    semanticSimilarity.ts   # OpenAI embeddings
    localSemanticSimilarity.ts  # Xenova/transformers fallback
    math.ts          # cosineSimilarity
    types.ts         # Domain types (Wine, Tasting, etc.)
    validation.ts    # Input sanitisation
scripts/             # Database migrations (*.sql) and offline analysis (*.ts)
```

## Tests

```bash
npm run test:run
```

Covers the lemmatiser, profile resolution, semantic similarity, and the scoring helpers.
