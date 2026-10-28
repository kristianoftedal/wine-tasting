# BERT integration plan: measuring real tasting accuracy

Oct 28, 2026 · @kristian · revised 28 Oct 2026 after a review against the live data and code

## Summary

BERT reads the notes; the credit ladder keeps deciding whether a claim was right. The plan adds a **soft-engine interface** so that OpenAI token embeddings (today), a Norwegian BERT and a multilingual ColBERT can be scored side by side on `/scoring-demo` and in the benchmark, then ships whichever engine clears one acceptance gate. Accuracy is defined against human judgement before anything is tuned.

1. **Record the baselines.** Re-run the perturbation benchmark and freeze the real tasting set with its stored scores. No benchmark output is checked in today; the only record is a commit message.
2. **Define accuracy.** Human ratings on the frozen set; Spearman between the app's score and the raters' mean is the target metric.
3. **Build the harness.** One `SoftEngine` interface, used by production, by `benchmark-scoring.ts` and by the demo page. Engines are swapped by a flag; the ladder, weights and combine formula are untouched.
4. **Add two engines behind it.** NorBERT3 (contextual word vectors, idf-weighted, baseline-rescaled MaxSim precision) and mLateOn ColBERT (late interaction, 128-dim token vectors). Both run locally in Node from ONNX; no new service.
5. **Decide per engine.** Ship only through the acceptance gate. The winner scores **new** tastings only; stored scores are never recomputed. Old and new are compared through a static extract on the demo page.
6. **Later, if the data grows:** unknown-word mapping ("you wrote X, read as Y") from the winning engine, and difficulty-adjusted skill per taster.

The descriptor tagger from the previous draft is deferred to Appendix A: the corpus has 2 negated notes, so there is nothing to train or measure it on yet.

## Review findings and what changed

Measured on the live database on 28 Oct 2026 (aggregate counts only):

| Fact | Value |
| --- | --- |
| Tastings | 132, by 8 users, on 41 wines, across 6 events |
| Scoreable note fields (lukt + smak, non-empty) | 236 (120 lukt, 116 smak) |
| User note length, words | p10 2 · median 4 · p90 7 |
| Reference note length, words (tasted wines) | p10 6 · median 14 · p90 17 |
| User notes containing a negator (ikke, uten, ingen, aldri) | 2 of 236 |
| User notes containing an intensity word (hint, lett, litt, tydelig, …) | 22 of 236 |
| Reference notes with a negator | 0 of 82 |
| Users with ≥10 tastings · wines with ≥5 tastings | 5 · 12 |
| Tasted wines with an enriched note | 0 of 41 (all `enrichment_status` null) |

What this changes:

1. **The "frozen set of 150–200 tastings" is the whole corpus.** There are 236 fields in total, so there is no held-out data. Every choice fitted to it (layer, rescale, thresholds) is in-sample. The revision tunes on the perturbation benchmark and on synthetic pairs, and uses the human-rated set as a *final gate only*; anything fitted on it is cross-validated 5-fold.
2. **Negation is a correctness fix, not an impact item.** It affects 2 of 236 notes. The rule still ships (it is an hour of work and a benchmark invariant), but nothing is gated on it and it no longer sits at position 2.
3. **The descriptor tagger has no training data.** The previous draft wanted 400 hand-labelled notes containing negation, intensity or unknown words; there are 2, 22 and a few dozen respectively. Its stated gate (NEG recall ≥ 0.9 on 100 held-out notes) cannot be measured. Deferred; the unknown-word mapping it promised comes from the soft engine instead (section "Negation and unknown words").
4. **Contextual embeddings have little context to work with on the user side.** The median taster note is four words ("Mineral. Frukt."). The gain, if any, comes from the reference side (14 words, "hvit pepper" vs "sort pepper") and from a better Norwegian vocabulary, not from disambiguating the taster's words. Expectations are lowered accordingly; the benchmark decides.
5. **The benchmark's soft term is a reimplementation.** `scripts/benchmark-scoring.ts` has its own `softRaw` "mirroring" `tokenPrecisionSimilarity`, with its own OpenAI cache. The file header claims it exercises production code; for the lexical half that is true, for the soft half it is not. The `SoftEngine` interface fixes this: the script imports the engines.
6. **`BERTSCORE_ENABLED` does not exist.** The previous draft wanted it removed; the only flags are `SCORING_RECALL_ENABLED` and `SEMANTIC_FLAVOR_FILTER_ENABLED`, both legacy-display-only in `scoring-debug.ts`. Task dropped.
7. **ColBERT no longer needs a service.** `lightonai/mLateOn` ships `model_int8.onnx` (313 MB) with the Dense projection and L2 normalisation baked into the graph, Apache 2.0, Norwegian among its nine training languages. It runs under `onnxruntime-node`, which is already installed. Modal, Qdrant and Kaggle drop out of the evaluation path entirely. `jina-colbert-v2` is ruled out: CC-BY-NC and `trust_remote_code`.
8. **NorBERT3 export risk is mostly retired.** `lebchen/norbert3-base-onnx` (Apache 2.0) already runs under transformers.js feature-extraction with int8 and fp32 variants. Phase "model spike" shrinks to verifying its outputs against PyTorch on a handful of notes.
9. **Stored notes do not contain the chip selections.** `Summary.tsx` scores `selectedFlavorsSmak` chip names joined with the free text, but `addTasting` persists only the free text, so a stored score cannot always be reproduced from the stored note. Existing rows are left exactly as they are (decision: history is read-only). From phase 06 on, new tastings also store the text that was scored, in new nullable columns, so the frozen set's *future* additions are reproducible; for the 236 existing fields the stored free text is what gets rated and compared.
10. **Sizes in the infrastructure table were optimistic.** `@huggingface/transformers` is at v4, not v3. mLateOn int8 is 313 MB plus a 34 MB tokenizer, not "about 125 MB"; NorBERT3-base int8 is the ~125 MB case. This matters only for Vercel rollout, not for evaluation.
11. **Skill across tastings has 5 eligible users.** Keep the view, drop the "skill should correlate with human ratings" check: Spearman on n = 5 says nothing.
12. **Two recorded numbers disagree.** The mean-vector norm is 0.68 in `embeddingCentering.ts` and 0.58 in the commit message; the perturbation count is 148 in `scoringConfig.ts` and 152 in the commit. Phase 06 re-runs both and writes the output to `scripts/validation-results/`, which is the point of phase 06.

## Baselines to reuse

### Measures

| Baseline | Where it is recorded | Numbers |
| --- | --- | --- |
| Perturbation benchmark, previous vs current engine | commit `6d8d700` (18 Aug 2026), `scripts/benchmark-scoring.ts` | 152 cases, 100 distractors. Previous: +HIT +10.3, +WRONG +0.8, MISS −2.1, r(len) 0.41, d 0.80, top1 9%. Current: +11.2, −4.3, +2.6, 0.12, 1.62, 30% |
| Rejected variants | `src/lib/scoringConfig.ts`, commit `6d8d700` | max(user, wine) denominator MISS −2.3 and +WRONG +1.8; BERTScore F1 MISS −2.2; sentence cosine MISS −3.3 |
| Anisotropy and centring | `src/lib/embeddingCentering.ts` | unrelated wine notes cosine 0.459 ± 0.159 raw, −0.004 ± 0.156 centred; 1 166 notes; mean norm 0.68 |
| Token-level floor | `src/lib/derivations.ts` | unrelated descriptor pairs ≈ 0.14 centred; cos(fat, vanilje) = 0.09 |
| Derivation impact | `src/lib/derivations.ts` | 9.3% of wines mention oak, 81% of those name no derived aroma; 9 of 33 oaked-wine tastings named one |
| Reference-note coverage | CLAUDE.md, `scripts/enrich-wine-notes.ts --audit` | 18.7% of taste notes name no aroma, 23.5% name exactly one; "citrus" in 6.6% of user notes |
| Weight-profile validation | `scripts/validation-results/validation-report.md` (7 Feb 2026) | inverted 20/20, moderate 20/20, data-driven 2/20 |
| Pre-directional score snapshot | `backups/tasting-scores-20260818-204626.json` (gitignored, local only) | smell/taste/overall per tasting under the previous engine; copy it into `scripts/validation-results/` so the frozen set keeps a "previous engine" column |

The soft term's current operating range (centred cosine ≈ [−0.15, 0.55], `SOFT_SCALE` 160) is the number every new engine's rescale has to reproduce *in effect*, not in value.

### Tasting notes and pairs

Real pairs already used as worked examples; all are in the database and in code, so they can be re-run against any engine:

| Pair | Where | Why it is useful |
| --- | --- | --- |
| Champagne Aubry Premier Cru Brut, aroma, event `41a0d425…` (13 May 2026): Taster A "Rødt eple sitrus …", Taster B "Mineral. Frukt." | `scripts/make-scoring-slide.ts` | Same wine, same reference, only the taster differs; before/after scores on the slide |
| Same taster's taste note "Rødt eple brioche …" | `scripts/make-scoring-slide.ts` | "brioche" earns credit via `bakverk` (lees ageing); the kind of link a soft engine should also find |
| WINE = "Saftig, litt pepret og krydret, preg av moden kirsebær, krekling og bringebær, litt fat og urt." with ten invariant cases | `src/actions/similarity.test.ts` | The objective as unit tests; every engine must keep them green with the soft term mocked to 0 |
| "vanilje" vs "Preg av fat og mørke bær."; "solbær" vs "Saftig mørk frukt og lett krydret."; "frukt" vs "Preg av solbær og bjørnebær." | `src/actions/similarity.test.ts` | derived, specific and the non-specific reverse case |
| Seven demo pairs: God match, Delvis match, Dårlig match, Sjeldne (IDF), three synonym cases | `src/app/scoring-demo/ScoringDemo.tsx` | Synthetic, but they are what a reviewer clicks first |
| The 50 most recent tastings of the logged-in user | `/scoring-demo` tasting selector | Real notes with stored scores, already wired into the page |

Near-synonym pairs the ladder misses and a soft engine should catch (to be collected in phase 06 into `scripts/validation-results/near-synonyms.json`): brioche/bakverk, grapefrukt/sitrus, tjære/røyk, lakris/anis, kaffe/mokka, honning/aprikos (botrytis), våt stein/mineral, fiol/blomst. Add the pairs the raters flag.

## Defining accuracy

The target metric is Spearman correlation between the app's smell and taste scores and human accuracy ratings on the frozen set. The existing benchmark checks properties (omissions free, wrong guesses unpaid); this checks validity.

**The set.** All 236 scoreable fields, exported once to `scripts/validation-results/frozen-set-2026-10.json`: tasting id, field, user note as scored (see finding 9), reference note, stored score, previous-engine score from the snapshot. Frozen means the file is never regenerated; new tastings go into a second file.

**Raters.** Two or three experienced tasters from the club, mostly people who were at the earlier events, each rating independently with the wine's Vinmonopolet note and the taster's note side by side. Assign each rater the events they attended first, because the rubric asks them to judge against the wine, not the wording; fields from events nobody present attended are rated against the note and general knowledge, and flagged as such in the CSV. Report inter-rater agreement (Spearman and quadratic-weighted kappa, since the scale is ordinal); the app cannot be expected to agree with humans more than they agree with each other.

**Rubric (0–4)**, judging only what the taster wrote:

| Rating | Meaning |
| --- | --- |
| 4 | Every descriptor is supported by the wine; at least two are specific |
| 3 | Mostly supported, one minor miss or a vague term |
| 2 | Right style and families, few specific hits |
| 1 | Mostly unsupported, one or two lucky hits |
| 0 | Nothing supported, or contradicts the wine |

"vanilje" on an oaked wine counts as supported even if the note only says "fat". Store ratings as CSV under `scripts/validation-results/ratings/` (one file per rater); a table is not needed for 236 rows.

**History is read-only.** Ratings, new-engine scores and comparisons all live in files under `scripts/validation-results/` and in a generated JSON the demo page reads. Nothing in this plan updates a row in `tastings`.

**Reporting.** Alongside the current engine, report two reference points so the gain is interpretable: a trivial baseline (count of direct lemma hits) and the lexical half alone (soft term = 0). If the full engine does not beat the lexical half by more than the rater noise, the soft term is not earning its 45% weight.

**Sample-size honesty.** With 236 fields and rater agreement around 0.7, the standard error of a Spearman near 0.5 is roughly 0.05. Engine differences smaller than about 0.1 are not decidable on this set; the benchmark and the near-synonym list break ties.

## How smell and taste are scored today

Each smell or taste note runs through `scoreFlavourNote` in `src/actions/similarity.ts`. The README still describes the older semantic-floor design; the code below is what runs.

1. **Normalise both notes.** `sanitizeText` lowercases, strips punctuation and drops stopwords; `normalizeWineSynonyms` maps variants onto canonical terms.
2. **Check the reference is scoreable.** `hasScoreableFlavour` returns false when the Vinmonopolet note names only structure (18.7% of taste notes), so the component is excluded rather than scored 0.
3. **Lexical credit** (`lexicalCredit` in `flavourScoring.ts`). Each user lemma gets the best rung of the ladder: direct 1.0, derived 1.0, specific 0.85, subcategory 0.6, category 0.3, else 0, multiplied by its profile weight (which already includes an idf multiplier from `idf-weights.generated.json`, 151 lemmas, max 2.10). This yields `hitMass`, `userMass` and `precision = hitMass / userMass`. `hitScore = 100 × (1 − e^(−hitMass / 3))` rewards absolute correct mass with no wine-side denominator.
4. **Soft signal** (`tokenPrecisionSimilarity` in `semanticSimilarity.ts`). Generic terms are stripped, each remaining word is embedded on its own with `text-embedding-3-small` (cached in memory by `tokenEmbeddings.ts`, about 892 distinct words), centred by subtracting the corpus mean (`embeddingCentering.ts`), then scored as MaxSim precision: the plain mean, over user words, of each word's best cosine to any reference word.
5. **Combine** (`combineScore`). `softScore = clamp(softRaw × 160, 0, 100)`; `blended = 0.55 × hitScore + 0.45 × softScore`; `score = blended × (0.6 + 0.4 × precision)`.

Colour is scored separately by whole-text OpenAI cosine (`rawSemanticSimilarity`) and is out of scope.

Two gaps sit before any similarity maths. `ikke`, `hint`, `lett`, `litt` and `tydelig` are stopwords, so "ikke noe fat" scores as "fat" and "hint av fat" equals "massivt fat"; rare in this corpus (finding 2) but wrong. Unknown words resolve to `ukjent` and are skipped on both sides (why `scripts/audit-oov.ts` exists). Note also that colour adjectives (rød, mørk, grønn, hvit, …) are stopwords by design, so "hvit pepper" reaches the ladder as "pepper"; a contextual engine must encode the note *before* stopword removal or there is no context left to be contextual about.

## Negation and unknown words

**Negation rule, no model.** `applyNegation(text)` in `lemmatizeAndWeight.ts`, called before `sanitizeText`. When a negator (`ikke`, `uten`, `ingen`, `aldri`) appears, drop the next descriptor within a window of three words, skipping fillers (`noe`, `særlig`, `mye`, `spesielt`). Return the dropped descriptors so a negated term the reference does contain can be reported as a contradiction. Apply to both notes. Vitest cases: "ikke noe fat", "uten fat", "ingen tydelig frukt", and a non-case "ikke bare bær men også krydder" (the window must stop at `men`). Add a +NEG perturbation to the benchmark: negating a correct descriptor must not raise the score.

**Unknown-word mapping, from the soft engine.** Every engine below produces a vector per content word, so a word the dictionary does not know can be mapped to its nearest dictionary lemma by cosine, accepted above a threshold, and fed to the ladder as `{ lemma, source: 'mapped', via: originalWord }`. The UI shows "du skrev X, lest som Y". This is the part of the deferred tagger that the data can support, because the threshold is tuned on the OOV list from `audit-oov.ts` (hundreds of real unknown words with known correct lemmas), not on 2 negated notes. It ships behind `OOV_MAPPING_ENABLED` and only after an engine has been chosen, since the vectors come from that engine.

**Intensity** stays stored, not scored: `lukt_intensitet` and `smaks_intensitet` already exist as columns.

## Soft-engine interface

The one structural change. Everything else in this plan plugs into it.

```ts
// src/lib/softEngines/types.ts
export type SoftEngineId = 'openai' | 'bert' | 'colbert-word' | 'colbert-token';

export type TokenAlignment = { word: string; best: string; sim: number; weight: number };

export type SoftResult = {
  engine: SoftEngineId;
  model: string;          // e.g. 'text-embedding-3-small', 'lebchen/norbert3-base-onnx@int8', 'lightonai/mLateOn@int8'
  raw: number;            // engine-native MaxSim precision, before rescale
  baseline: number;       // b used for the rescale (0 for openai, which is centred instead)
  softScore: number;      // 0–100, what combineScore consumes
  alignments: TokenAlignment[];
  ms: number;
};

export interface SoftEngine {
  id: SoftEngineId;
  available(): Promise<boolean>;         // model files present, env set
  score(userNorm: string, referenceNorm: string, userRaw: string, referenceRaw: string): Promise<SoftResult>;
}
```

- `userNorm`/`referenceNorm` are the sanitised, synonym-normalised strings the ladder sees; `userRaw`/`referenceRaw` are the lightly cleaned originals (lowercase, punctuation stripped, stopwords kept) for engines that need context. The content-word set is the same for all engines: the words that survive `stripGenericTerms`.
- `combineScore` gains an overload that takes a 0–100 `softScore` directly; the existing `softRaw × SOFT_SCALE` path becomes the OpenAI engine's rescale, so `SOFT_SCALE` moves into that engine and is removed from `scoringConfig.ts` when the engine is retired.
- Production: `scoreFlavourNote` picks the engine from `SOFT_ENGINE` (default `openai`). Unknown or unavailable engine falls back to `openai` and logs once.
- `scripts/benchmark-scoring.ts` imports the engines and drops its private `softRaw`; `--engines=openai,bert,colbert-word,colbert-token` runs each in turn and writes `scripts/validation-results/benchmark-<date>.md` and `.json`. The script's own OpenAI REST cache goes away; the OpenAI engine's in-memory token cache already does the same job.
- Alignments are returned by every engine so the score breakdown and the demo can show *which* reference word each user word matched. For the current engine this is free; it is the single most useful thing the demo gains.

## Side-by-side on /scoring-demo

The page already loads the user's last 50 tastings, calls `getScoringBreakdown`, and shows the component scores. The additions:

**Server.**

- `getScoringBreakdown(userNote, wineNote, { recall, flavorFilter, engines })` gains `engines?: SoftEngineId[]` and returns `softEngines: Array<SoftResult & { combinedScore: number; delta: number }>`, where `combinedScore` is `combineScore(lexical, result.softScore)` and `delta` is against `currentScore`. The production path is untouched; `currentScore` still comes from `scoreFlavourNote`.
- `listSoftEngines(): Promise<Array<{ id; model; available; reason? }>>` so the page can grey out engines whose model files are missing.
- Models load lazily at first use into a module-scope singleton, so an engine nobody selects costs nothing.
- No corpus-wide computation happens on request. The comparison over existing tastings is a **static extract** (below), regenerated by a script.

**Client (`ScoringDemo.tsx`).**

- Engine chips next to the existing flag toggles: `OpenAI (nå)`, `NorBERT3`, `ColBERT ord`, `ColBERT token`. Unavailable engines are disabled with the reason as tooltip. Selection is remembered in `localStorage`.
- New section **"Motorsammenligning"** under Komponentscorer: one row per engine with Modell, Rå MaxSim, Baseline, Token-likhet (0–100), Totalscore, Δ mot nå, ms. The current engine's row is pinned first.
- Under the table, one **alignment panel per engine**: for each of the user's content words, the best reference word and its cosine, coloured by the engine's own rescaled value. Words where engines disagree on the best match are flagged, because those are exactly the cases to look at by hand (does ColBERT send "brioche" to "bakverk" where OpenAI sends it to "frukt"?).
- The existing error message ("Sjekk at OpenAI API-nøkkelen er satt") becomes per engine.

**Static comparison extract.** `scripts/export-engine-comparison.ts --engines=…` reads the frozen set, scores every field with every engine, and writes `src/app/scoring-demo/engine-comparison.generated.json`: per field the tasting id, wine, event, field, user note, reference note, the **stored** score (untouched), the previous-engine score from the August snapshot, and one score plus alignments per engine; per engine the mean, SD and Spearman against the stored score and against the human rating once it exists. `page.tsx` imports the file and renders a **"Motorsammenligning over smakingene"** section: the summary table, a scatter of engine score against stored score, and the per-field rows with a filter for the largest disagreements. The file is regenerated by the script, never on request, and the database is only read. Numbers only; no verdict is drawn on the page.

**Cleanup done on 28 Oct 2026.** The page used to compute the previous algorithm alongside (max-denominator overlap, sentence cosine, the "Recall (gammel)" and "Smakfilter" toggles, `SCORING_RECALL_ENABLED`, `SEMANTIC_FLAVOR_FILTER_ENABLED`). All of it is removed from `scoring-debug.ts`, `ScoringDemo.tsx`, `page.tsx` and the stylesheet; the breakdown now explains the current scorer only and shows when a reference note is unscoreable. The benchmark keeps its "previous" row, which is the one place that comparison is still needed.

**What the demo is not.** It is a place to look at disagreements, not the acceptance test. The acceptance gate runs on the benchmark and the frozen set from the CLI, where results are written down.

**Local setup.** `scripts/fetch-soft-models.ts` downloads the model files into `models/` (add to `.gitignore`): `lebchen/norbert3-base-onnx` (int8 and fp32) and `lightonai/mLateOn` (`model_int8.onnx`, `tokenizer.json`, `config.json`, `config_sentence_transformers.json`). Env: `SOFT_MODEL_DIR=models`. The demo works with no models present; only the OpenAI row shows.

## BERT engine

Keeps the signature and the formula; upgrades the four inputs.

| Weakness today | BERT-engine change | Expected effect |
| --- | --- | --- |
| Words embedded in isolation, so "pepper" ignores "hvit" vs "sort" | Encode the raw note once; take each content word's vector from its context | Modifiers carry meaning on the reference side; small effect on four-word user notes |
| Plain mean over user words: "bær" and "tyttebær" count equally | idf-weighted mean, reusing `idf-weights.generated.json` (default 1.0) | Soft score driven by specific descriptors, consistent with the lexical side |
| Centring fixes the note-level floor, not the MaxSim floor; a max over more reference words is higher by chance | Rescale with a measured baseline per reference-length bucket: P′ = (P − b) / (1 − b) | Scores comparable across short and long reference notes |
| Every request and the benchmark depend on OpenAI | Local ONNX via `@huggingface/transformers` v4 on `onnxruntime-node` | Deterministic, versioned, offline benchmark; no per-call cost |

**Model.** `lebchen/norbert3-base-onnx` (NorBERT3 base, 123M, Apache 2.0), int8 first. Fallback `NbAiLab/nb-bert-base` exported with Optimum. Verification step: encode five notes in PyTorch with `ltg/norbert3-base` and in Node, assert cosine of corresponding word vectors > 0.99.

**Layer.** BERTScore found intermediate layers match better than the last. Start with the last layer (what the hosted export returns). Only if the engine is competitive, re-export truncated at layer k (`num_hidden_layers = k`) and pick k by benchmark `d` and human correlation, 5-fold.

**Encoding and word alignment.**

1. Build the word list from the raw note: lowercase, punctuation stripped, synonyms normalised, stopwords kept.
2. Mark content words: those that survive `stripGenericTerms` on the normalised form.
3. Tokenise word by word, concatenate the ids, record each word's subword span. Unit test: on 200 real notes, the concatenation equals whole-text tokenisation in ≥ 99% of cases; log the rest.
4. One forward pass with `pooling: 'none'`; mean-pool each content word's subwords; L2-normalise.

**Scoring.** `P = Σ idf(u) · max_r cos(u, r) / Σ idf(u)` over user content words U and reference content words R; then `P′ = clamp((P − b) / (1 − b), 0, 1) × 100`. b is read from `maxsim-baseline.generated.json`, keyed by engine and reference-word-count bucket.

**What it will not fix.** A pretrained BERT has no wine chemistry; derived credit stays with `derivations.ts`. Its isolated-synonym similarity may be weaker than OpenAI's. The benchmark decides.

## ColBERT engine

Same formula, different vectors: tokens trained so that MaxSim means "these match". Verified facts about the candidate:

| `lightonai/mLateOn` | |
| --- | --- |
| Base | mmBERT-base, `ModernBertModel`, 22 layers, hidden 768, vocab 256 002, 307M parameters |
| Projection | three PyLate `Dense` modules to 128 dims, then L2 normalisation, all **inside** `model.onnx` / `model_int8.onnx` (per the repo's `export_onnx.py`) |
| ONNX I/O | inputs `input_ids`, `attention_mask` (int64, [batch, seq]); output `[batch, seq, 128]`, padding positions not zeroed |
| Sizes | `model_int8.onnx` 313 MB, `model.onnx` 1 247 MB, `tokenizer.json` 34 MB |
| Prefixes | `"[Q] "` for queries, `"[D] "` for documents; no query expansion; empty skiplist |
| Languages | nine, including Norwegian and Swedish |
| License | Apache 2.0 |

**Running it in Node.** The graph is custom (projection baked in), so it is loaded with `onnxruntime-node` `InferenceSession` directly rather than through a transformers.js pipeline; the tokenizer comes from `AutoTokenizer` pointed at the local directory. The taster note is the query (`[Q] ` prefix), the reference note the document (`[D] `). Word spans as for the BERT engine. Special-token and punctuation vectors are excluded by construction because only content-word spans are read.

**Two variants, both cheap once the vectors exist.**

- `colbert-token`: for each user subword, max cosine over all reference subwords; average within the word; idf-weighted mean over words. This is the operation the model was trained on.
- `colbert-word`: mean-pool each word's subwords first, L2-normalise, then MaxSim over words. Simpler to explain; may lose what late interaction is for.

**Baseline.** ColBERT vectors are anisotropic in their own way; unrelated-token cosines are not near zero. The same per-engine `maxsim-baseline.generated.json` applies, measured on the 100-distractor pairs the benchmark already builds.

**Rollout cost, noted now, decided later.** 347 MB of model files on a Vercel Hobby cold start is a 10–30 s first request and ~400 MB of RAM for the int8 session. If ColBERT wins, rollout options are: (a) the model in a private Hugging Face repo, downloaded to `/tmp` on cold start, kept warm by the event-day cron ping; (b) a Modal endpoint with scale-to-zero, called with a 2 s timeout and OpenAI fallback. Neither is needed to *evaluate*.

**Fine-tuning (contingency, Appendix A of the previous draft).** Only if pretrained ColBERT beats BERT but still misses the near-synonym list: distil the credit ladder into mLateOn with PyLate on Kaggle, paraphrase heavily, hold out surface forms and wines. Not planned.

## Calibration per engine

`scripts/compute-maxsim-baseline.ts --engine=<id>` scores every user note against the 100 distractor references used by the benchmark, buckets by reference content-word count (1–3, 4–6, 7–10, 11+), and writes the mean per bucket into `maxsim-baseline.generated.json` under the engine and model id. "Unrelated pairs centre near 0 regardless of reference length" is the check. For the OpenAI engine the file records b ≈ 0 by construction (centring) and the existing `SOFT_SCALE` behaviour is kept bit-for-bit so stored scores do not move.

## Skill across tastings

Unchanged in design: wine difficulty as the shrunk mean score per wine and field, taster skill as the shrunk mean residual, k ≈ 5, as a SQL view over `tastings`, shown on the profile after 10 tastings with the count beside it. Two caveats from the data: 5 users qualify today, and the view must not mix engines, so it groups by `scorer_version` and only reports a skill once a taster has 10 tastings under the same engine. The previous draft's "skill should correlate with human ratings" check is removed (n = 5).

## Infrastructure

Everything fits the standard limits; no paid tier is required for evaluation.

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | `@huggingface/transformers` v4 (replacing `@xenova/transformers` 2.17, which only `localSemanticSimilarity.ts` uses) plus `onnxruntime-node` (already installed) | Same Node stack; ColBERT's custom graph needs the raw session API |
| Next.js config | Add both packages to `serverExternalPackages` in `next.config.ts` | Keeps native ONNX binaries out of the bundler |
| Model files, local | `models/` (gitignored), fetched by `scripts/fetch-soft-models.ts` | Evaluation and benchmark run offline after one download |
| Model files, Vercel (winner only) | Private Hugging Face repo, downloaded to `/tmp` on cold start, loaded once at module scope | Not in the deploy bundle (250 MB limit); reused while Fluid compute keeps the instance warm |
| Reference vectors | Compute at event creation in the same `after()` hook that runs note enrichment, stored in `wine_word_vectors (product_id, field, engine, model_version, words text[], data bytea)` | 41 tasted wines; ~20 KB per field at 768 dims, ~3 KB at 128; the event is the moment we learn which bottles matter |
| Cold start | Seconds on the first request per instance | Event-day cron ping warms Supabase and the model |
| Latency budget | p95 under 300 ms warm for both fields, measured in the demo's ms column | `Summary.tsx` blocks on the score; longer than this is felt |

## Implementation phases

Numbered to continue the GSD phases in `.planning/` (v1.0 ended at phase 05). Each phase ends with a check that gates the next.

### Phase 06: Baselines, frozen set, negation

- [ ] Forward-only: `addTasting` also writes `lukt_scored` / `smak_scored` (the chip-plus-text string the score was computed on) and `scorer_version` for new rows; migration adds the nullable columns, old rows stay null and untouched
- [ ] Re-run `benchmark-scoring.ts`; commit the output as `scripts/validation-results/benchmark-2026-10-baseline.md`
- [ ] `scripts/export-frozen-set.ts` → `frozen-set-2026-10.json` (236 fields, stored and snapshot scores); copy the August snapshot into `validation-results/`
- [ ] Rater CSV template and instructions with the rubric and three worked examples; collect two ratings per field
- [ ] `scripts/evaluate-human-agreement.ts`: inter-rater agreement; Spearman of current engine, lexical-only and direct-hit-count against the mean rating
- [ ] `applyNegation` with Vitest cases; +NEG perturbation in the benchmark
- [ ] `near-synonyms.json` seeded from the list above and from rater comments

Done when the baseline table (benchmark, human correlation, agreement) is committed.

### Phase 07: Soft-engine interface and demo harness

- [ ] `src/lib/softEngines/` with `types.ts`, `openai.ts` (wrapping `tokenEmbeddings` + centring + `SOFT_SCALE`), `index.ts` (registry, `SOFT_ENGINE` selection, availability)
- [ ] `combineScore` overload taking a 0–100 soft score; `scoreFlavourNote` routed through the registry; `similarity.test.ts` stays green with the engine mocked
- [ ] `benchmark-scoring.ts` imports engines; `--engines`, `--frozen`, markdown and JSON output
- [ ] `scoring-debug.ts`: `engines` option, `softEngines` result, `listSoftEngines`
- [ ] `scripts/export-engine-comparison.ts` → `engine-comparison.generated.json` (OpenAI engine only at this point, which also records the stored-vs-recomputed drift)
- [ ] `ScoringDemo.tsx`: engine chips, Motorsammenligning table, alignment panels; `page.tsx` renders the static extract

Done when the demo shows the OpenAI engine's alignments and the benchmark output is byte-identical to phase 06's for `--engines=openai`.

### Phase 08: BERT and ColBERT engines

- [ ] `scripts/fetch-soft-models.ts`; `models/` in `.gitignore`; `serverExternalPackages`
- [ ] `bert.ts`: NorBERT3 ONNX, word spans, pooling, idf weighting; PyTorch parity check on five notes
- [ ] `colbert.ts`: mLateOn int8 session, `[Q]`/`[D]` prefixes, both variants; parity check against PyLate on five notes (Python, one-off)
- [ ] Vitest: span alignment (≥ 99% agreement with whole-text tokenisation), pooling, idf weighting, the directional property (extending the reference never lowers the score)
- [ ] All engines visible on `/scoring-demo`; extract regenerated with all engines

Done when all four engines score the seven demo pairs and the 50 loaded tastings without error, with latency recorded.

### Phase 09: Calibration

- [ ] `compute-maxsim-baseline.ts` per engine → `maxsim-baseline.generated.json`
- [ ] Apply the rescale in `bert.ts` and `colbert.ts`
- [ ] Layer k for BERT only if BERT is within reach of the gate

Done when unrelated pairs centre near 0 for every engine and reference-length bucket.

### Phase 10: Benchmark and decision

- [ ] Run `--engines=openai,bert,colbert-word,colbert-token` on the benchmark and the frozen set; human correlation 5-fold where anything was fitted
- [ ] Record the full table in `scripts/validation-results/benchmark-2026-11-engines.md`
- [ ] Decide against the acceptance gate; write the decision and the numbers into `scoringConfig.ts`, in the same style as the existing commentary

### Phase 11: Rollout, new tastings only (winner only)

- [ ] Shadow mode: `SOFT_ENGINE_SHADOW=<id>` computes both for new tastings and logs the delta; nothing is written
- [ ] Reference-vector table filled from the event-creation hook; cold-start warming in the cron ping
- [ ] Switch `SOFT_ENGINE` after two events with no regressions. From then on new tastings are scored by the new engine and carry its `scorer_version`; every existing row keeps its score and its note exactly as stored
- [ ] `recalculate-user-tasting-scores.ts` is **not** run. Old-versus-new is read from the static extract on the demo page; if a side-by-side for a user's own history is wanted, it is another generated file, not a column update
- [ ] Leaderboards and the profile show the engine version where scores from two engines sit next to each other (small badge from `scorer_version`)
- [ ] Keep `SOFT_SCALE` and the OpenAI engine in the tree while any displayed score was produced by them; rewrite the README scoring section

### Phase 12: Unknown-word mapping

- [ ] Nearest-lemma mapping from the winning engine; threshold tuned on the `audit-oov.ts` list
- [ ] `lexicalCredit` accepts mapped descriptors with `source: 'mapped'`; "lest som" in the breakdown UI and the demo
- [ ] Benchmark: mapping must not raise +WRONG

### Phase 13: Skill across tastings

- [ ] SQL view with shrinkage; profile tab after 10 tastings with the count shown

## Acceptance gate

An engine ships only if it raises the human-judgement correlation and matches or beats the current engine on every metric the benchmark reports, on the same frozen fields and perturbations.

| Metric | What it tests | Pass condition |
| --- | --- | --- |
| Human correlation | Spearman vs mean rater score, 236 fields | Higher than current by more than its bootstrap 95% interval |
| Lexical-only control | Full engine vs soft term = 0 | Full engine higher; otherwise the soft weight, not the engine, is the problem |
| +HIT | Adding a descriptor the wine has | ≥ current engine |
| +WRONG | Adding a genuinely wrong descriptor | ≤ current engine, and ≤ 0 |
| +NEG | Negating a correct descriptor | ≤ 0 |
| MISS | Reference gains notes the user never wrote | No worse than current, close to 0 |
| r(len) | Score vs user note length | \|r\| ≤ current engine |
| d / top1 | Real wine vs 100 random distractors | ≥ current engine |
| Near-synonyms | Pairs in `near-synonyms.json` | Rescaled soft value above the unrelated baseline for more pairs than current |
| `similarity.test.ts` | Objective invariants | Green |
| `validate-scoring` | Specific-vs-generic cases | 20/20 |
| Latency | Warm request, both fields, from the demo's ms column | p95 under 300 ms |

Record the full table for every engine either way, so a later fine-tuning attempt has a baseline to beat.

## Risks and open questions

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Raters disagree too much to give a usable target | Medium | Measure agreement on the first 40 fields; tighten the rubric with worked examples before rating the rest |
| 236 fields cannot separate engines that are close | High | Treat the human set as a gate, not a tuner; break ties on benchmark `d` and the near-synonym list; keep collecting tastings into a second frozen file |
| NorBERT3 hosted ONNX differs from PyTorch | Low | Five-note parity check in phase 08; NB-BERT export as fallback |
| ColBERT's general-domain training ignores wine chemistry | Certain | Derived credit stays in `derivations.ts`; the engine only replaces the soft term |
| Per-word tokenisation diverges from whole-text tokenisation | Low | Measured on 200 notes; fall back to whole-text tokenisation with offset reconstruction if under 99% |
| Unknown-word mapping assigns confident wrong lemmas | Medium | Threshold on the OOV audit list; "lest som" shown so users spot errors; +WRONG gate |
| Scores from two engines sit next to each other on leaderboards after the switch | Certain if shipped | `scorer_version` on new rows, shown as a badge; history is never rewritten, by decision |
| 347 MB cold start on Vercel for ColBERT | High if ColBERT wins | Decide at phase 11 between HF download and a Modal endpoint; not an evaluation concern |
| `@xenova/transformers` → `@huggingface/transformers` breaks `localSemanticSimilarity.ts` | Low | It is the recommendations fallback only; migrate it in the same change |

Open questions:

- [ ] Which rater attended which of the six events? Needed to assign fields.
- [ ] Should colour move to a local model too? Out of scope; measure separately once an engine exists.
- [ ] Recommendations still use OpenAI note-level embeddings; revisit after phase 11.

## Appendix A: descriptor tagger (deferred)

A NorBERT token classifier with BIO tags (DESC, NEG, INT, STRUCT, O) would let the ladder see multi-word descriptors ("grønn paprika"), negation scope and intensity, and map unknown spans to lemmas. It needs a few hundred hand-labelled notes that contain those phenomena; the corpus has 2 negated and 22 intensity-bearing notes, and the weak labels the dictionary can produce only teach the dictionary's own gaps. Revisit when the tasting corpus passes roughly 1 000 fields or when an event series produces notes with negation. The unknown-word half of its value is delivered by phase 12 without a tagger.

## Appendix B: sources checked for this revision

- `lightonai/mLateOn` model card, `config.json`, `modules.json`, `config_sentence_transformers.json`, `export_onnx.py` and file listing on Hugging Face
- `lebchen/norbert3-base-onnx` model card on Hugging Face
- `jinaai/jina-colbert-v2` model card (license CC-BY-NC, `trust_remote_code`)
- Sentence Transformers "Multi-Vector (Late Interaction) Embedding Models" blog post and `MultiVectorEncoder` docs
- `@huggingface/transformers` feature-extraction pipeline source (`pooling: 'none'`)
- This repository: commit `6d8d700`, `scoringConfig.ts`, `embeddingCentering.ts`, `derivations.ts`, `benchmark-scoring.ts`, `make-scoring-slide.ts`, `scoring-debug.ts`, `ScoringDemo.tsx`, `Summary.tsx`, `TastingWizard.tsx`, `actions/tasting.ts`, `validation-results/validation-report.md`
