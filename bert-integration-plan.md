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
| Same benchmark, re-run with +NEG on the grown corpus | `scripts/validation-results/benchmark-2026-10-baseline.md` (28 Oct 2026) | 236 cases. Current: +HIT +12.3, +WRONG −2.8, +NEG +0.0, MISS +3.8, r(len) 0.26, d 1.17, top1 21% (full table under phase 06) |
| Scorer agreement on the frozen set | `scripts/validation-results/human-agreement-2026-10-baseline.md` | stored vs recomputed 0.991; current vs lexical-only 0.921; previous engine vs current 0.439 |
| Rejected variants | `src/lib/scoringConfig.ts`, commit `6d8d700` | max(user, wine) denominator MISS −2.3 and +WRONG +1.8; BERTScore F1 MISS −2.2; sentence cosine MISS −3.3 |
| Anisotropy and centring | `src/lib/embeddingCentering.ts` | unrelated wine notes cosine 0.459 ± 0.159 raw, −0.004 ± 0.156 centred; 1 166 notes; mean norm 0.68 |
| Token-level floor | `src/lib/derivations.ts` | unrelated descriptor pairs ≈ 0.14 centred; cos(fat, vanilje) = 0.09 |
| Derivation impact | `src/lib/derivations.ts` | 9.3% of wines mention oak, 81% of those name no derived aroma; 9 of 33 oaked-wine tastings named one |
| Reference-note coverage | CLAUDE.md, `scripts/enrich-wine-notes.ts --audit` | 18.7% of taste notes name no aroma, 23.5% name exactly one; "citrus" in 6.6% of user notes |
| Weight-profile validation | `scripts/validation-results/validation-report.md` (7 Feb 2026) | inverted 20/20, moderate 20/20, data-driven 2/20 |
| Pre-directional score snapshot | `scripts/validation-results/tasting-scores-20260818-204626.json` (copied from `backups/`) | smell/taste/overall for the 79 tastings that existed in August, under the previous engine; the frozen set's `previousScore` column |
| Frozen set | `scripts/validation-results/frozen-set-2026-10.json` | 236 fields, never regenerated; new tastings go in a new file |

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
| Champagne Aubry, smell, six tasters on one reference note: "Rødt eple sitrus mineralsk" (stored 93), "Rødt eple, citrus, mineralsk, aprikos, fersken" (92), "Mineral. Frukt. Nøtt. Krydder" (55), "Gult eple, pære" (53), "Fersken, plomme," (44), "Brioche," (22) | frozen set, `ratings/README.md` | The widest spread of notes on one wine in the corpus; the worked examples for raters |

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

**Negation rule, no model.** `applyNegation(text)` in `src/lib/negation.ts`, called before `sanitizeText`. When a negator (`ikke`, `uten`, `ingen`, `aldri`) appears, drop the next descriptor within a window of three words, skipping fillers (`noe`, `særlig`, `mye`, `spesielt`). Return the dropped descriptors so a negated term the reference does contain can be reported as a contradiction (`negated` and `contradicted` on the breakdown; shown on the demo, not scored). Apply to both notes. A negator is never itself a candidate, so "vet ikke, ikke sitrus" negates sitrus and nothing else. Vitest cases cover "ikke noe fat", "uten fat", "ingen tydelig frukt", the affirmation "ikke bare bær men også krydder", and clause boundaries. The benchmark's +NEG perturbation (negating a descriptor the wine has) reads +0.0.

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

**Execution log.** Phases 06–13 were executed on branch `bert-integration` on 28 Oct 2026, one commit per phase or pair of phases. Outstanding items that need a person: collect the ratings (06), apply migrations 025 and 026, run the PyTorch parity check (08), decide whether to grow `WINE_SYNONYMS` from the phase 12 list.

### Phase 06: Baselines, frozen set, negation — done 28 Oct 2026 (ratings pending)

- [x] Forward-only: `addTasting` writes `lukt_scored` / `smak_scored` and `scorer_version` for new rows (`scripts/025-scored-text.sql`, nullable, never backfilled; the insert retries without them until the migration is applied). `SCORER_VERSION` lives in `scoringConfig.ts`
- [x] `npx tsx --env-file=.env.local scripts/benchmark-scoring.ts --out=…` → `scripts/validation-results/benchmark-2026-10-baseline.md`
- [x] `npx tsx --env-file=.env.local scripts/export-frozen-set.ts --sheet` → `frozen-set-2026-10.json` (236 fields, 8 tasters anonymised T1–T8, stored score, previous-engine score for 152 fields from the August snapshot, now copied into `validation-results/`)
- [x] `ratings/README.md` (rubric, four worked examples from the Aubry champagne) and `ratings/rating-sheet-2026-10.csv`; raters save `rater-<name>.csv`
- [x] Ratings: no human raters were available, so the backup plan below was built and run on 29 Oct 2026 (LLM panel + a 50-field calibration sample for one person + a constructed set with ratings known by construction)
- [x] `npx tsx --env-file=.env.local scripts/evaluate-human-agreement.ts --out=…` → `human-agreement-2026-10-baseline.md` (scorer-vs-scorer part; the human part fills in when rater files exist)
- [x] `applyNegation` in `src/lib/negation.ts` (its own module and test file rather than inside the 1 000-line lemma file), wired into `scoreFlavourNote`, `getScoringBreakdown`, `getTermBreakdown` and the benchmark's `prep`; +NEG column added
- [x] `near-synonyms.json` seeded with 12 pairs

What the baseline run measured (236 cases from the frozen set, 100 distractors, deterministic, re-recorded in phase 07):

| scorer | base | +HIT | +WRONG | +NEG | MISS | r(len) | d | top1% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| previous (recall on) | 62.1 | +11.5 | +1.1 | +0.0 | −0.6 | 0.40 | 0.58 | 11 |
| current + openai | 56.1 | +12.6 | −3.2 | +0.0 | +3.5 | 0.26 | 1.19 | 18 |

Before the negator-as-candidate fix, +NEG read +0.5 for both scorers: two of 236 cases ("Vet ikke" + "ikke sitrus") were being read as "Vet sitrus". The August numbers (152 cases) and these (236 cases) differ in `d` and `top1%` because the corpus has grown; the ordering between scorers is unchanged.

**The benchmark was not reproducible until phase 07.** Its two database queries had no `ORDER BY`, so the seeded sampler saw rows in a different order every run and drew different perturbations: three runs of the same code gave +WRONG −2.8, −2.5 and −3.1 for the same engine. The `base` column, which uses no sampling, was stable throughout, and that column is the one that proves an engine unchanged. Both queries are now ordered and `--frozen` takes the cases from the frozen file; two consecutive runs are byte-identical, which is the table above.

Scorer agreement on the frozen set (Spearman): stored vs recomputed 0.991 (19 of 232 fields differ, mean |Δ| 0.72, the chip-text gap from finding 9); current vs lexical-only 0.921; current vs direct-hit count 0.863; **previous engine vs current 0.439** on the 148 fields both scored, which is how differently the two engines rank the same notes. 12 reference notes among the tasted wines are unscoreable (name no aroma).

Done when the human-correlation rows are filled in — they are, with the LLM panel standing in; see "Accuracy without raters" below.

#### Accuracy without raters (backup plan, run 29 Oct 2026)

**LLM panel.** `scripts/rate-with-llm.ts` rates every field with the rubric and worked examples from `ratings/README.md`, one file per model, temperature 0, so disagreement between files is disagreement between models. Three models (gpt-4o-mini, gpt-4.1-mini, gpt-4o) agree with each other at Spearman 0.69–0.73 (weighted kappa 0.36–0.74), which is about what two experienced people manage on a 0–4 scale. `scripts/validation-results/human-agreement-2026-10-llm-panel.md`:

| scorer | Spearman vs panel mean | bootstrap 95% |
| --- | --- | --- |
| stored score | 0.616 | 0.523 – 0.684 |
| current engine (recomputed) | 0.622 | 0.536 – 0.689 |
| lexical half only (soft = 0) | 0.622 | 0.518 – 0.698 |
| direct-hit count | 0.620 | 0.540 – 0.712 |

**The soft term earns no validity on this set.** Full engine, lexical half alone and a bare count of direct hits agree with the panel equally. With a median note of four words, nearly all of them dictionary words, the ladder already decides, and the 45% soft weight redistributes without reordering. That is a stronger statement about where to spend effort than anything in the engine comparison.

Per engine on the demo extract (scoreable fields only, so the numbers differ from the table above): openai 0.664, bert 0.707, colbert-word 0.711, colbert-token 0.711 against the panel.

**Calibration sample, rated 29 Oct 2026.** `ratings/calibration-sample-2026-10.csv`: 50 fields stratified by event and stored score, rated by one club member (`rater-kristian.csv`). Agreement with the three models: Spearman 0.41 / 0.51 / 0.54 (weighted kappa 0.34–0.51), under the 0.6 bar, while the models agree among themselves at 0.69–0.73. `scripts/validation-results/human-agreement-2026-11.md`.

Where the gap comes from: the human rates stricter (mean 2.46 vs 2.75; two 0s and six 4s against the panel's zero 0s and ten 4s) and counts an unsupported word harder than the rubric does — "sitrus eple vanilje nøtter aprikos" on a note naming steinfrukt, eple, sitrus, fat, vanilje and smør got a 2 from the human and 3.7 from the panel, where the rubric's "one minor miss" reads 3. The panel, for its part, never uses 0. Both are defensible readings of a 0–4 scale; neither is the scorer's problem.

**150 fields, rated 29 Oct 2026.** With a second sample of 100, agreement between the one human rater and the panel is Spearman 0.44 (95% 0.26–0.58): the panel is not a stand-in for this rater. The decisive number is the other one: every scorer tracks the panel at 0.67–0.72 but the human at only 0.45–0.49 (openai 0.45, bert 0.49, colbert-word 0.49, colbert-token 0.49, stored 0.45; intervals about ±0.15, so no engine is preferred). The scorer and the language models judge alike; the person judges differently. Mean scorer output by human rating runs 18 / 41 / 53 / 68 / 84 for ratings 0–4, so the order is right and the resolution is poor.

Where the scorer and the human part ways, read from the largest rank disagreements (`scripts/validation-results/human-agreement-2026-11.md` and the extract):

1. **Obvious descriptors are not worth full credit to a person.** "Sitrus mineralsk fersken" on a white Burgundy with exactly those words in the reference scored 93 and was rated 2; "Sitrus, eple" on a champagne, 86, rated 2; "Brioche" alone, a direct hit, rated 1. The rater discounts descriptors that are the default for the style: citrus, apple and mineral on a white, red berries on a red. The scorer's idf multiplier is floored at 1.0, so a descriptor common across the catalogue still earns full credit, and it is corpus-wide, not relative to the wine's style. This is the project's own weight-inversion principle, applied one level deeper than the dictionary applies it.
2. **A person credits what the wine plausibly shows, not only what the note names.** "Brioch, smør, nøtt" on a developed champagne scored 13 (one typo, two descriptors absent from a thin note) and was rated 3; "Eple sitrus nøtt honning" against "nøtter, krydder, blomster og mineraler", 28, rated 3. The rubric asks for exactly this judgement and the scorer has only the note text. Two mechanisms already exist for it: note enrichment, which fills thin references, and typo mapping (`brioch → brioche` at 0.63 clears the tuned threshold), which is off.

**Re-rating, 29 Oct 2026.** The rater had read 4 as "a note worth a score of 100" and 3 as "about 80", i.e. rated completeness; the rubric rates correctness and says nothing about completeness, by design (omissions never cost). The 22 fields sitting two or more points under a literal rubric reading were re-rated with the question "is each word right, and are two specific?"; 16 moved, all by one point, six were kept (the rater still counts "Pepper, mørke bær" on a note naming krydder and bær as a 2, which is a real disagreement about whether `pepper → krydder` is specific). After the re-rating: human vs panel 0.47 (0.32–0.60); scorers vs human openai 0.57 (0.44–0.66), bert 0.61, colbert-word 0.61, colbert-token 0.61 (0.49–0.70). The local engines sit about 0.05 above OpenAI against the human, as they did against the panel and the constructed set: consistent in sign, inside the interval every time.

Both findings above point at the dictionary side of the score, not at the vectors, which is where phase 10 and the soft-term finding already pointed. A concrete next phase: descriptor weight relative to the wine's style, measured from the 50 000-wine catalogue (how common is "sitrus" among whites, "solbær" among reds), replacing the floored global idf. It is a dictionary-side change, cheap to compute, and this rated set is the target to measure it against.

What the first 50 meant for the engines: nothing. On the same 50 fields every scorer tracks the human and the panel about equally — openai 0.53 / 0.52, bert 0.52 / 0.57, colbert-word 0.53 / 0.57, colbert-token 0.55 / 0.53, stored score 0.53 / 0.51 — differences well inside the noise of 50 ratings. And the scorer is as close to the human (0.53) as the models are (0.41–0.54), which says the ceiling here is rater noise, not the scorer. The panel does not pass as a stand-in for people, but it is not far from one, and nothing that depends on the human row changes: the property gate decides, and it decided for the production engine.

**Constructed set.** `scripts/build-constructed-set.ts` has gpt-4o-mini write four taster-style notes per reference (levels 4/3/2/0, two to seven words) and keeps a note only if the credit ladder confirms the level it was asked for: 115 of 296 kept, mostly because a "level 0" note with any fruit word still earns category credit and lands at 2. `scripts/validation-results/constructed-set-2026-10.md`:

| engine | Spearman(score, level) | pairwise order accuracy | mean at 4 / 3 / 2 / 0 |
| --- | --- | --- | --- |
| openai | 0.704 | 92.3% (48/52) | 85.3 / 66.5 / 27.9 / 2.3 |
| bert | 0.751 | 94.2% (49/52) | 64.6 / 44.4 / 18.4 / 0.0 |
| colbert-word | 0.777 | 94.2% (49/52) | 61.4 / 44.1 / 18.3 / 0.3 |
| colbert-token | 0.770 | 92.3% (48/52) | 60.6 / 43.7 / 18.8 / 0.3 |

Every engine orders the levels; the set is too small at levels 2 and 0 to separate them.

### Phase 07: Soft-engine interface and demo harness — done 28 Oct 2026

- [x] `src/lib/softEngines/`: `types.ts`, `maxsim.ts` (content words, idf lookup, directional MaxSim with alignments), `openai.ts`, `index.ts` (lazy registry, `SOFT_ENGINE`, `listSoftEngines`), `comparison.ts` (shape of the static extract)
- [x] `combineScoreScaled(lexical, softScore)`; `combineScore(lexical, softRaw)` is now the OpenAI path on top of it. `scoreFlavourNote` goes through `getSoftEngine()` and carries `engine` and `alignments` on the breakdown. `tokenPrecisionSimilarity` is gone from `semanticSimilarity.ts`; its logic is the OpenAI engine. Tests mock `embedTokens` instead.
- [x] `benchmark-scoring.ts` scores through the engines (`--engines`, `--frozen`, `--out` writes `.md` and `.json`); its private `softRaw` copy and token REST cache are gone. The legacy row keeps its own sentence embeddings, since nothing in production embeds sentences any more.
- [x] `getScoringBreakdown(user, wine, { engines })` → `softEngines` with combined score, delta and alignments; `listSoftEngines()`
- [x] `scripts/export-engine-comparison.ts` → `src/app/scoring-demo/engine-comparison.generated.json` (OpenAI only so far: ρ(stored) 0.990, ρ(previous engine) 0.439)
- [x] Demo: engine chips (availability and the active engine from the server, selection remembered per viewer), Motorsammenligning table, one alignment panel per engine with disagreements highlighted, and the static extract rendered by `EngineComparison.tsx` with a scatter against the stored score and a largest-disagreement filter
- [x] Identity: the agreement script's per-field numbers before and after the refactor are the same (19 of 232 differ from stored, mean |Δ| 0.72, Spearman 0.991), and the benchmark's `base` column is unchanged (62.1 / 56.1). The perturbation columns could not be compared byte for byte because the pre-refactor benchmark was not reproducible (see phase 06); they are now.

### Phase 08: BERT and ColBERT engines — done 28 Oct 2026 (parity run pending)

- [x] `scripts/fetch-soft-models.ts` (NorBERT3 int8 142 MB + mLateOn int8 313 MB + 34 MB tokenizer into `models/`, gitignored); `@huggingface/transformers` 4.3 installed (brings `onnxruntime-node` 1.30); `serverExternalPackages` in `next.config.ts`
- [x] `bert.ts`: NorBERT3 through transformers.js (`AutoModel` base class, the config carries no `model_type`), last layer, mean-pooled subwords, L2, idf-weighted MaxSim, baseline rescale. Loads in ~0.3 s, scores a pair in ~10 ms
- [x] `colbert.ts`: mLateOn through `onnxruntime-node` directly (projection and L2 are inside the graph), `[Q]`/`[D]` prefixes, `colbert-word` and `colbert-token` sharing one session and cache. Loads in ~0.6 s, ~10 ms per pair
- [x] **Word spans are recovered from one whole-text tokenisation**, not from per-word concatenation as the draft proposed. Measured first: per-word concatenation equalled whole-text tokenisation in 1.5% of real notes for NorBERT and 0% for mLateOn (sentence-initial forms, stray space tokens that every word then shared, giving ColBERT ~0.98 for unrelated words). `words.ts` groups the tokenizer's token strings by their word-start markers (`Ġ` for NorBERT's byte-level BPE, `▁` for mLateOn's sentencepiece); a leading space makes the first word tokenise like every other. Agreement on 200 real notes: 100% for both; per-word tokenising remains as a counted fallback
- [x] Vitest: `maxsim.test.ts` (pure: directional property, weighting, alignments, grouping, bucketing, rescale) and `engines.test.ts` (skips without models: ≥ 99% span recovery on 200 real notes, a matching word beats an unrelated one, one alignment per content word, soft score within 0–100)
- [x] **Contextual engines are only approximately directional.** Extending the reference changes the context, so its word vectors move and the raw value can drop slightly. The test allows 0.05 of drift; the benchmark's MISS column measures what that does to scores (phase 10)
- [ ] **Parity against PyTorch not run.** `scripts/parity-dump.ts` (Node, ids + ONNX vectors for five notes) and `scripts/parity-check.py` (PyTorch originals on the same ids, per-token cosine, pass at mean > 0.99) are in the repo; running the Python half was blocked in this session. Needs an environment with `torch`, `transformers` and `pylate`, and downloads the originals (~1.7 GB)
- [x] All engines visible on `/scoring-demo` once `models/` is present; the extract is regenerated after calibration in phase 09, since uncalibrated local engines report raw ≈ 0.9 for everything

Observed before calibration (raw MaxSim, int8): NorBERT separates a little (0.77 for a close note, 0.33 for "vanilje" on an oaked wine, 0.46 for an unrelated note) but places `brioche` nearest `fersken`, not `bakverk`; mLateOn places `brioche` nearest `bakverk` (0.84) but sits at 0.89–0.94 for everything, matched or not, which is the anisotropy phase 09 exists to remove.

### Phase 09: Calibration — done 28 Oct 2026

- [x] `scripts/compute-maxsim-baseline.ts` writes two generated files: `centering.generated.json` (a corpus mean per local engine family, subtracted at score time) and `maxsim-baseline.generated.json` (the MaxSim floor per reference-length bucket, measured on centred vectors against 400 catalogue wines ids 3000–3399 that the benchmark never uses). Report: `scripts/validation-results/calibration-2026-10-28.md`
- [x] Rescale applied in `bert.ts` and `colbert.ts`; a missing bucket falls back to the nearest measured one (no reference in the corpus has 11+ content words)
- [x] **Centring was not in the draft and turned out to be the main step.** mLateOn's mean token vector has norm **0.978** (1.0 would be every vector identical): before centring any two descriptor words scored 0.89–0.94, matched or not. NorBERT's is 0.663, close to OpenAI's 0.68. After centring and rescaling, random pairs centre near 0 for every engine and bucket, which was the done-criterion
- [ ] Layer k for BERT: not attempted; BERT did not come within reach of the gate (phase 10)

Separation of true pairs from random ones on the centred raw MaxSim, (mean true − mean random) / sd(random), by reference bucket:

| engine | 1–3 words | 4–6 | 7–10 |
| --- | --- | --- | --- |
| openai | 0.55 | 1.07 | 1.11 |
| colbert-token | 0.81 | 0.97 | 1.06 |
| colbert-word | 0.79 | 0.94 | 0.99 |
| bert | 0.36 | 0.82 | 0.83 |

### Phase 10: Benchmark and decision — done 28 Oct 2026 (human rows pending)

- [x] `--engines=openai,bert,colbert-word,colbert-token --frozen=…` → `scripts/validation-results/benchmark-2026-10-engines.md` and `.json`; extract regenerated with all four engines
- [ ] Human correlation: waits for rater files
- [x] Decision recorded here and in `scoringConfig.ts`

| scorer | base | +HIT | +WRONG | +NEG | MISS | r(len) | d | top1% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| previous (recall on) | 62.0 | +11.5 | +1.1 | +0.0 | −0.6 | 0.40 | 0.58 | 11 |
| current + openai | 56.1 | +12.6 | −3.2 | +0.0 | +3.5 | 0.26 | 1.19 | 18 |
| current + bert | 37.3 | +9.9 | −0.9 | +0.0 | +2.0 | 0.35 | 0.92 | 10 |
| current + colbert-word | 37.0 | +9.5 | −1.2 | +0.0 | +2.1 | 0.31 | 0.94 | 12 |
| current + colbert-token | 36.9 | +9.6 | −1.2 | +0.0 | +1.8 | 0.32 | 0.94 | 12 |

On the frozen set (Spearman): bert 0.926 / colbert-word 0.929 / colbert-token 0.932 against the stored score, and 0.55–0.57 against the previous engine (OpenAI: 0.439), i.e. the local engines rank notes a little more like the old sentence-cosine scorer did.

**Decision: the OpenAI token engine stays, with a caveat added on 29 Oct.** The two validity measures run afterwards (LLM panel, constructed set) lean the other way: the local engines agree slightly better with the panel (0.71 vs 0.66) and order the constructed levels slightly better (0.75–0.78 vs 0.70). Neither difference clears its noise, and both are measured against language models judging language, so they cannot overturn a property gate the local engines fail by a wide margin. What they do is move the tie-break onto the calibration sample: if one person's 50 ratings agree with the panel, the panel's preference gains standing and the right next step is shadow mode (`SOFT_ENGINE_SHADOW=colbert-token`) through one real event. Both local engines fail the gate on every metric that discriminates: smaller reward for a correct descriptor (+HIT 9.5–9.9 vs 12.6), a weaker penalty for a wrong one (−0.9 to −1.2 vs −3.2), less separation from random wines (d 0.92–0.94 vs 1.19, top1 10–12% vs 18%) and more length dependence (r 0.31–0.35 vs 0.26). They pass only MISS, where they sit nearer 0. The lower `base` is a scale artefact of the rescale, not the reason: `d` and `top1` are rank-based. The human rows cannot overturn a gate that fails on four of five property metrics, so the decision does not wait for them; they are still worth collecting, because they also judge the engine that stays.

What the alignments show is more interesting than the totals. mLateOn finds `brioche → bakverk` (0.84 raw) where OpenAI and NorBERT do not, and it is the better engine on the shortest references (1–3 words: 0.81 vs 0.55 separation). It is worse at the isolated-synonym judgement that most of the score is made of. That is the profile the draft predicted for a pretrained ColBERT, and it is the case for the contingency in the ColBERT section (distil the credit ladder into mLateOn) if the near-synonym list is ever worth that work. Not planned.

`previous` reads 62.0 here against 62.1 in the baseline file: OpenAI sentence embeddings are not bit-reproducible between calls and one case sits on a rounding boundary. The engine rows, which use cached token vectors, are identical to the baseline.

### Phase 11: Rollout, new tastings only — shadow mode done 28 Oct 2026; the rest is gated on a winner there is not

- [x] Shadow mode: `SOFT_ENGINE_SHADOW=<id>` scores every new field with that engine as well and logs `[soft-shadow] {active, score, shadow, shadowScore, delta, ms}`; nothing is written and the response is unchanged
- [ ] Reference-vector table, `SOFT_ENGINE` switch, `scorer_version` badge: not done, by the phase 10 decision. The code path is ready; if a future engine clears the gate, these three bullets are the rollout
- [ ] README scoring section: not rewritten here, since README.md was being edited concurrently in the working tree

### Phase 12: Unknown-word mapping — built, measured, left off (28 Oct 2026)

- [x] `src/lib/oovMapping.ts`: unknown words (dictionary category `ukjent`, ≥ 4 letters) mapped to the nearest of the 163 aroma lemmas by centred OpenAI token cosine, accepted above a tuned threshold; `scoreFlavourNote` applies it to the user's side behind `OOV_MAPPING_ENABLED` and reports `mapped` on the breakdown
- [x] `scripts/tune-oov-threshold.ts` → `oov-threshold.generated.json` and `scripts/validation-results/oov-threshold-2026-10-28.md`. Labelled set: the synonym map's keys the dictionary cannot resolve (4 after stemming and compound splitting), 6 real-note positives (`brioch`, `toasty`, `chili`, `hibiscus`, `aske`, `autolyse`, `bakt`) and 22 real-note negatives (`gult` ×9 in the corpus, `sur`, `vet`, `bobler`, …)
- [x] Demo: a "Lest som" row shows every unknown word with its nearest lemma and cosine, coloured by whether it is applied, would clear the threshold, or sits below it
- [x] Benchmark with mapping on: identical to the baseline row (+WRONG −3.2, d 1.19); the perturbation words are dictionary lemmas, so the gate is passed trivially

**Result: it does not earn its place, and stays off.** At the chosen threshold 0.5 the OpenAI vectors map 3 of 10 positives correctly (`brioch → brioche` 0.63 is the only confident one), miss 7, accept no wrong positive and one negative (`kjerne → kjernefrukt` 0.63). Below 0.5 the negatives flood in; `toasty` lands on `toffee`, `aske` on `skinke`, `hibiscus` on `guava`. The local engines were measured as mapping sources on the same set: mLateOn also 3 of 10 (a different three: `brioch`, `toasty`, `bakt`) with negatives accepted from 0.7 down; NorBERT 1 of 10. Isolated rare words are exactly where these vectors are weakest, which is the measurement behind the derivation map in the first place.

What does work for this problem already exists: `WINE_SYNONYMS` is an exact, free, hand-curated mapping. The six real-note positives above are candidates for it (`brioch → brioche`, `toasty → toast`, `bakt → bakverk`, `autolyse → bakverk`; `aske` and `hibiscus` need a judgement), and `scripts/audit-oov.ts` ranks the rest by frequency. Growing that list beats any threshold measured here; it is a dictionary change and therefore a `SCORER_VERSION` bump.

### Phase 13: Skill across tastings — done 28 Oct 2026 (migration to apply)

- [x] `scripts/026-taster-skill.sql`: `tasting_field_scores` → `wine_difficulty` (mean per wine and field, shrunk toward the global mean, k = 5) → `taster_skill` (mean residual per taster, shrunk toward 0, k = 5), all grouped by `scorer_version` with null read as the directional scorer. The views run as owner because difficulty needs every tasting of a wine while RLS shows a user only their own and their groups'; they are revoked from clients and the single entry point is `my_taster_skill()`, `SECURITY DEFINER`, returning the caller's rows only
- [x] `src/lib/tasterSkill.ts` (`displayableSkill`, 10-tasting minimum under one scorer version) with tests; profile overview shows a "Ferdighet" stat card with the tasting count and an explanation on hover, "–" until eligible. Five tasters qualify today
- [ ] Apply the migration; until then the RPC errors quietly and the card shows "–"

### Phase 14: Style-relative descriptor weights — built, measured, left off (29 Oct 2026)

The hypothesis from the human ratings: a taster discounts the default descriptors of a style, the scorer does not, so weight each aroma lemma by its rarity *within the wine's main category* instead of the global, floor-at-1.0 idf.

- [x] `scripts/compute-style-idf.ts` → `src/lib/style-idf.generated.json`: per category (Rødvin 29 775 wines, Hvitvin 21 063, Musserende vin 6 486, Rosévin 2 099), idf / median idf per aroma lemma, unfloored; plus a sidecar with the frozen set's wine categories. In whites: sitrus 55% of notes (ratio 0.24), frukt 49%, mineral 48%, eple 41%
- [x] `src/lib/styleWeights.ts`, `STYLE_WEIGHTS_ENABLED` (off), `STYLE_WEIGHT_FLOOR` / `CAP`; `lexicalCredit` and `scoreFlavourNote` take `{ category }`; the summary screen passes the wine's `main_category`; the demo has a Stilvekter toggle and a category select
- [x] `scripts/measure-style-weights.ts`: floor sweep against the human ratings, the panel and the constructed set; `benchmark-scoring.ts --style=on`

| floor | ρ human (95%) | ρ panel | ρ constructed | mean score |
| --- | --- | --- | --- | --- |
| 1.0 (off) | 0.565 (0.44–0.66) | 0.664 | 0.704 | 60.1 |
| 0.7 | 0.568 | 0.663 | 0.704 | 55.5 |
| 0.5 | 0.569 | 0.649 | 0.713 | 52.0 |
| 0.3 | 0.573 | 0.636 | 0.719 | 48.7 |

Property benchmark with the flag on (floor 0.5): +HIT +13.2, +WRONG −3.0, +NEG +0.0, MISS +3.1, r(len) 0.29, d 1.18, top1 18%, against +12.6 / −3.2 / +0.0 / +3.5 / 0.26 / 1.19 / 18% off. `scripts/validation-results/style-weights-2026-10-29.md`, `benchmark-2026-10-style-weights.md`.

**Result: neutral everywhere, so it stays off.** Agreement with the human moves by +0.008 at best across the whole sweep, inside a ±0.1 interval; the panel loses a little; the properties are unchanged within noise; scores drop by up to 12 points on average. Lowering every common word on a white together lowers that note's score but reorders little, because most white-wine notes are made of the same common words, and the human's ranking lives inside those notes. The diagnosis from the ratings was right about *what* the scorer sees differently; this mechanism is not the one that moves it. The six re-rating holdouts (is `pepper` specific against `krydder`?) are the better lead: they are about the ladder's `specific` tier, not about weights.

### Step 3: housekeeping — done 29 Oct 2026

- [x] `WINE_SYNONYMS` grew by the typos and loanwords real notes contain and the vector mapping could not resolve: `brioch`, `toasty`, `bakt`, `autolyse`. `SCORER_VERSION` is now `directional-2:text-embedding-3-small`; new tastings carry it, stored scores are untouched
- [ ] PyTorch parity check: still needs a person to run it
- [ ] `package-lock.json` and the concurrent dependency cleanup: left for their author to commit
- [x] `main` fast-forwarded to the branch

## What's next, in order (29 Oct 2026)

1. **Hybrid soft term — measured, rejected.** The per-field reasons showed the local engines underpay exact matches: a contextual vector of the same word in two sentences gives a centred cosine near 0.45 where an isolated token gives 1.0. The fix seemed obvious: a word the ladder already credited (direct, derived, specific) counts as a full soft match, and the engine only judges the rest (`src/lib/softEngines/hybrid.ts`, `SOFT_HYBRID_ENABLED`). Measured on every engine (`scripts/validation-results/hybrid-soft-2026-10-29.md`):

   | engine | hybrid | ρ human | ρ panel | ρ constructed | mean score |
   | --- | --- | --- | --- | --- | --- |
   | openai | off → on | 0.569 → 0.520 | 0.664 → 0.635 | 0.704 → 0.830 | 60.3 → 61.5 |
   | bert | off → on | 0.609 → 0.530 | 0.707 → 0.646 | 0.751 → 0.829 | 40.0 → 58.5 |
   | colbert-token | off → on | 0.616 → 0.528 | 0.712 → 0.642 | 0.770 → 0.828 | 39.7 → 58.6 |

   Worse against the human and the panel for every engine, better only on the constructed set, which the ladder built; the four engines collapse onto one score. Properties (`benchmark-2026-10-hybrid-soft.md`): openai +HIT 12.6 → 10.4, d 1.19 → 0.92, top1 18 → 23%; colbert-token +WRONG −1.2 → −3.6, d 0.94 → 0.88. Off, and it explains something: the local engines' small validity edge comes *from* under-crediting exact matches of common words. A contextual cosine for "sitrus" in two different sentences is low and for a rare specific word high, which is the style-relative weighting of phase 14 arrived at implicitly, and it agrees with the human rater where the explicit version did not. The soft term is not a second vote on what the ladder matched; it is a different signal, and giving it the ladder's answer removes that.

2. **The ladder's `specific` tier — measured 29 Oct 2026; one change recommended.** 109 of the 750 ladder matches on the frozen set are `specific`; the licensing words that dominate are `krydder` (13, almost all `pepper`, mean human rating 2.4) and `frukt` (sitrus, eple; 1.5–2.4), while `bær → solbær / kirsebær` sits near 3. Ten variants, both engines (`scripts/measure-specific-tier.ts`, `specific-tier-2026-10-29.md`): changing the tier's credit (0.6, 0.3, 1.0) helps nothing; removing a licensing word does, and only one of them consistently:

   | variant | openai ρ human | openai ρ panel | colbert-token ρ human | specific matches |
   | --- | --- | --- | --- | --- |
   | current (0.85, all hypernyms) | 0.569 | 0.664 | 0.616 | 109 |
   | no `krydder` | **0.599** | 0.664 | **0.624** | 91 |
   | no `krydder`, `frukt` | 0.594 | 0.656 | 0.628 | 68 |
   | no specific tier at all | 0.580 | 0.654 | 0.607 | 0 |

   Properties with `krydder` removed (`benchmark-2026-10-no-krydder.md`): +HIT +12.9, +WRONG −3.1, MISS +3.5, d 1.19, top1 19%, unchanged within noise. The gain is +0.03 inside a ±0.1 interval, but it is the only variant that helps both engines, costs the panel nothing, and says exactly what the six re-rating holdouts said: "pepper" is not a specific answer to "krydder" (nearly every red has some spice; naming pepper identifies nothing). **Recommended:** drop `krydder` from `HYPERNYMS`, so pepper on a wine noted as "krydder" earns category credit (0.3) instead of 0.85; bump `SCORER_VERSION`. Not applied yet; it is a scoring change for new tastings and the call is the owner's.

   **Rating bump, 29 Oct 2026.** At the rater's request every rating was raised by one, capped at 4 (original kept as `ratings/kristian-original-2026-10-29.csv`). A uniform shift cannot change a rank correlation; the cap can, and did: 83 threes merged into the ten fours, 93 of 149 ratings are now 4, and agreement with every scorer fell (openai 0.565 → 0.542, bert 0.606 → 0.582, colbert-token 0.612 → 0.583) along with the weighted kappa against the panel. Restored to the original the same day, at the rater's request; the +1 file is gone and `rater-kristian.csv` is the 149 ratings with the 22 re-ratings.

3. **Re-measure the engines when the corpus has grown.** All three validity rows lean toward the local engines by ~0.05, inside the noise every time; at 500 fields the noise is half what it is now. The frozen set is dated so the next one is a new file, not a regeneration.

4. **PyTorch parity check** (`scripts/parity-dump.ts`, `scripts/parity-check.py`), one run.

5. **Commit `package-lock.json`** with the dependency cleanup it belongs to.

## Engine decision, 29 Oct 2026

Everything measured on existing notes, in one place:

| measure | what it asks | openai | bert | colbert-token | decides for |
| --- | --- | --- | --- | --- | --- |
| +HIT / +WRONG | rewards a correct word, punishes a wrong one | +12.6 / −3.2 | +9.9 / −0.9 | +9.6 / −1.2 | openai, clearly |
| d / top1 | tells the real wine from 100 random ones | 1.19 / 18% | 0.92 / 10% | 0.94 / 12% | openai, clearly |
| MISS | omissions cost nothing | +3.5 | +2.0 | +1.8 | local, slightly |
| ρ human (149 ratings) | agrees with a club member | 0.57 | 0.61 | 0.61 | local, inside noise |
| ρ LLM panel | agrees with three models | 0.66 | 0.70 | 0.71 | local, inside noise |
| constructed set | orders known levels | 0.70 | 0.75 | 0.77 | local, inside noise |
| cost | per call, cold start, memory | API call | 142 MB, local | 347 MB, local | — |

The property gate is the one the objective is written in, and it is the only row with a margin outside the noise, so the production engine stays OpenAI. The three validity rows all lean the same way by the same small amount; that is a reason to keep the local engines in the tree and measure them again when the corpus has grown, not a reason to switch now. Shadow mode (`SOFT_ENGINE_SHADOW=colbert-token`) at an event is a deployment check for cold start and latency on Vercel, not a scientific one; the scientific comparison is this table.

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
