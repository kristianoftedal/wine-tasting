# BERT integration plan: measuring real tasting accuracy

Oct 28, 2026 · @kristian

## Summary

BERT reads the notes; the credit ladder keeps deciding whether a claim was right. The plan integrates one Norwegian BERT in three roles, ordered by impact, and defines "accuracy" against human judgement before tuning anything.

1. **Define accuracy.** A human-judged set of 150–200 real tastings becomes the target metric: rank correlation between the app's score and experienced tasters' ratings.
2. **Fix negation now.** `ikke` and `hint` are stopwords today, so "ikke noe fat" earns a direct hit on "fat". A rule-based fix ships first.
3. **Descriptor tagger.** NorBERT fine-tuned to tag descriptors, negation and intensity, and to map out-of-vocabulary words onto dictionary lemmas, so the ladder sees what the taster actually claimed.
4. **Soft matcher.** Contextual, idf-weighted, baseline-rescaled MaxSim precision replaces the isolated OpenAI word embeddings in `tokenPrecisionSimilarity`.
5. **Skill across tastings.** Difficulty-adjusted skill per taster, so a hard wine does not look like a bad taster.

The tagger and soft matcher share one model and one forward pass. `flavourScoring.ts` stays pure; the ladder, weights and combine formula are unchanged. Each step ships only if it raises the human-judgement correlation without regressing the existing benchmark.

## Defining accuracy

The target metric is Spearman correlation between the app's smell and taste scores and human accuracy ratings on a fixed set of real tastings. The existing benchmark checks properties (omissions free, wrong guesses unpaid); this checks validity.

**The set.** 150–200 real smell and taste notes from `tastings`, stratified across wine styles and score ranges. Freeze it: same notes for every engine and every change.

**Raters.** Two or three experienced tasters from the wine club, each rating independently with the wine's Vinmonopolet note and the taster's note side by side. Report inter-rater agreement (Spearman between raters); the app cannot be expected to agree with humans more than they agree with each other.

**Rubric (0–4)**, judging only what the taster wrote:

| Rating | Meaning |
| --- | --- |
| 4 | Every descriptor is supported by the wine; at least two are specific |
| 3 | Mostly supported, one minor miss or a vague term |
| 2 | Right style and families, few specific hits |
| 1 | Mostly unsupported, one or two lucky hits |
| 0 | Nothing supported, or contradicts the wine |

Raters judge against the wine, not the reference wording: "vanilje" on an oaked wine counts as supported even if the note only says "fat". Store ratings in a small table (`accuracy_judgements`: tasting id, field, rater, rating) or a CSV under `scripts/validation-results/`.

## How smell and taste are scored today

Each smell or taste note runs through `scoreFlavourNote` in `src/actions/similarity.ts`. The README still describes the older semantic-floor design; the code below is what runs.

1. **Normalise both notes.** `sanitizeText` lowercases, strips punctuation and drops stopwords; `normalizeWineSynonyms` maps variants onto canonical terms.
2. **Check the reference is scoreable.** `hasScoreableFlavour` returns false when the Vinmonopolet note names only structure (about 18.7% of taste notes), so the component is excluded rather than scored 0.
3. **Lexical credit** (`lexicalCredit` in `flavourScoring.ts`). Each user lemma gets the best rung of the ladder: direct 1.0, derived 1.0, specific 0.85, subcategory 0.6, category 0.3, else 0, multiplied by its profile weight (which already includes an idf multiplier). This yields `hitMass`, `userMass` and `precision = hitMass / userMass`. `hitScore = 100 × (1 − e^(−hitMass / 3))` rewards absolute correct mass with no wine-side denominator.
4. **Soft signal** (`tokenPrecisionSimilarity` in `semanticSimilarity.ts`). Generic terms are stripped, each remaining word is embedded on its own with `text-embedding-3-small` (cached in memory by `tokenEmbeddings.ts`, about 892 distinct words), centred by subtracting the corpus mean (`embeddingCentering.ts`), then scored as MaxSim precision: the plain mean, over user words, of each word's best cosine to any reference word. Output sits roughly in \[−0.15, 0.55\].
5. **Combine** (`combineScore`). `softScore = clamp(softRaw × 160, 0, 100)`; `blended = 0.55 × hitScore + 0.45 × softScore`; `score = blended × (0.6 + 0.4 × precision)`.

Colour is scored separately by whole-text OpenAI cosine (`rawSemanticSimilarity`) and is out of scope here.

The design already gets the hard parts right. The reference is never a denominator, recall was measured and deliberately removed (the code comments record MISS −2.2 for BERTScore F1), and sentence-level cosine was rejected for smell and taste. This plan keeps all of that.

Two gaps sit before any similarity maths. Negation and intensity are lost: `ikke` and `hint` are stopwords, so "ikke noe fat" scores as "fat" and "hint av fat" equals "massivt fat". Unknown words resolve to `ukjent` and are silently skipped (the reason `scripts/audit-oov.ts` exists), so descriptors outside the dictionary are invisible on both sides.

## Reading the notes: negation, intensity and unknown words

This comes before the soft matcher because a wrong reading of the claim corrupts every score built on it.

**Step 1: negation rule (no model).** Handle negation before stopword removal in a new `applyNegation(text)` called ahead of `sanitizeText`. When a negator (`ikke`, `uten`, `ingen`, `aldri`) appears, drop the next descriptor within a window of three words, skipping fillers such as "noe", "særlig", "mye". Return the dropped descriptors too, so a negated term the reference does contain can be reported (and later scored) as a contradiction. Apply it to both notes.

**Step 2: descriptor tagger (NorBERT token classification).** One model labels each word with BIO tags:

| Tag | Examples | Used for |
| --- | --- | --- |
| DESC | solbær, fatlagret, skogbunn, grønn paprika | Descriptors, including multi-word ones |
| NEG | ikke, uten, ingen | Negation scope |
| INT | hint av, lett, massiv, tydelig | Intensity, stored now, scored later |
| STRUCT | god fylde, lang ettersmak | Kept out of aroma scoring, as GENERIC is today |
| O | everything else | — |

**Training data.** Weak labels first: run the lemma dictionary over the Vinmonopolet smell and taste notes and the user notes to tag DESC and STRUCT automatically. Then hand-label about 300 user notes that contain negation, intensity or unknown words. Split by note, not by sentence, and keep a held-out set of 100 hand-labelled notes.

**Mapping unknown descriptors.** A DESC span with no dictionary entry is mapped to its nearest dictionary lemma by cosine of the BERT word vectors, accepted only above a threshold tuned on the held-out set; below it the span stays unknown, as today. The match carries `via: 'tagger'` so the UI can say "you wrote X, read as Y".

**Integration.** `lexicalCredit` takes a list of descriptors instead of raw text: `{ lemma, negated, intensity, source: 'dictionary' | 'tagger' }`. The dictionary path still produces that list when the tagger is off, so the ladder, weights and tests keep working unchanged behind `TAGGER_ENABLED`.

## Soft matcher: what BERTScore-style precision improves

The soft term is already MaxSim precision, so this is not a new formula. It upgrades the four inputs to that formula.

| Weakness today | Where in code | BERTScore-style change | Expected effect |
| --- | --- | --- | --- |
| Words embedded in isolation, so "fat" is the same vector in "preg av fat" and "lite fat", and "pepper" ignores "hvit" vs "sort" | `embedTokens` | Encode the whole note once; take each word's vector from its context | Fewer false near-matches; modifiers carry meaning |
| Plain mean over user words: "bær" and "tyttebær" count equally | `tokenPrecisionSimilarity` | idf-weighted mean, reusing `idf-weights.generated.json` | Soft score driven by specific descriptors, consistent with the lexical side |
| Corpus-mean centring fixes the note-level floor, not the MaxSim floor; a max over more reference words is higher by chance, so long reference notes inflate scores | `embeddingCentering.ts`, `SOFT_SCALE = 160` | Rescale with a measured baseline: (s − b) / (1 − b), with b estimated per reference-length bucket | Scores comparable across wines with short and long notes |
| Every request depends on OpenAI, and the benchmark needs an API key | `tokenEmbeddings.ts`, `benchmark-scoring.ts` | Local model via transformers.js | Deterministic, versioned, offline benchmark runs, no per-call cost |

What it will not fix: a pretrained BERT has no wine chemistry, so derived credit stays with `derivations.ts`. Its word-to-word similarity for isolated synonyms may also be weaker than OpenAI's, which is why the benchmark decides. If it loses, the fallback is to fine-tune the same model later (ColBERT-style distillation), not to abandon the design.

## Soft matcher design

The new function keeps the signature `tokenPrecisionSimilarity(userText, referenceText): Promise<number>`, so callers do not change.

**Model.** First candidate: NorBERT3 base (123M parameters, UiO Language Technology Group). It needs custom modelling code, so the ONNX export is the first risk to retire. Fallbacks in order: NorBERT3 small (40M), then NB-BERT base (standard BERT architecture, exports cleanly). Pick by benchmark, not by size.

**Layer.** BERTScore found intermediate layers match better than the last. Export the model truncated to the chosen layer k (set `num_hidden_layers = k` before export). That is equivalent to reading layer k and makes the model smaller and faster.

**Encoding and word alignment.**

1. Build a word list from the lightly cleaned note: lowercase, punctuation stripped, synonyms normalised, stopwords kept so the model sees natural context.
2. Mark which words are content words: those that survive `stripGenericTerms`.
3. Tokenise word by word and concatenate the ids, recording each word's subword span. This avoids relying on offset mappings.
4. Run one forward pass; mean-pool each content word's subword vectors into one word vector; L2-normalise.

**Scoring.**

```latex
P = \frac{\sum_{u \in U} \mathrm{idf}(u) \cdot \max_{r \in R} \cos(u, r)}{\sum_{u \in U} \mathrm{idf}(u)}
```

U is the user's content words, R the reference's content words, idf from `idf-weights.generated.json` (default 1.0 for unknown words). Then rescale with the baseline: P′ = (P − b) / (1 − b), clamped to \[0, 1\], and multiply by 100 for `softScore`. b comes from a generated file keyed by reference-word-count bucket.

**Unchanged.** `lexicalCredit`, the credit ladder, `HIT_WEIGHT` / `SOFT_WEIGHT`, `PRECISION_FLOOR`, `hasScoreableFlavour` and colour scoring. `SOFT_SCALE` is replaced by the baseline rescale and removed once the BERT engine ships.

## Skill across tastings

A single score mixes the taster's skill with the wine's difficulty and the quality of one Vinmonopolet note. Skill is estimated across tastings instead, with no extra model.

**Wine difficulty.** For each wine and field, the mean smell or taste score across all its tastings, shrunk toward the global mean when few people have tasted it:

```latex
d_w = \frac{n_w \bar{s}_w + k \bar{s}}{n_w + k}
```

n\_w is the number of tastings of wine w, s̄\_w their mean score, s̄ the global mean, k about 5.

**Taster skill.** The shrunk mean of a taster's residuals (score − d\_w) across their tastings, with the same k. Positive means better than others on the same wines. Show it on the profile only after about 10 tastings, with the count beside it.

**Where it lives.** A Supabase SQL view over `tastings`, recomputed on read; no new storage. It needs scores from one scorer version, so compute it after rescoring history (phase 12).

## Infrastructure: Vercel and Supabase free

Everything fits the standard limits; no large-functions beta and no paid Supabase tier.

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | `@huggingface/transformers` (v3, successor to the `@xenova/transformers` already in `package.json`) on `onnxruntime-node`, inside the existing server action | Same Node stack; no separate service |
| Next.js config | Add both packages to `serverExternalPackages` in `next.config.ts` | Keeps native ONNX binaries out of the bundler |
| Model size | int8 ONNX: about 125 MB for base, 40 MB for small | Under Vercel's 250 MB function limit (Node) |
| Model hosting | Your own Hugging Face repo, downloaded on cold start into `/tmp`, loaded once at module scope | Not in the deploy bundle; reused while Fluid compute keeps the instance warm |
| Reference vectors, phase 1 | Encode the reference note per request; in-memory LRU keyed by product id + field + model version | Simplest; one extra forward pass of about 50 words |
| Reference vectors, phase 2 (only if latency needs it) | Supabase table `wine_word_embeddings`: `product_id`, `field`, `model_version`, `words text[]`, `data bytea` (float16, content words only) | About 20 KB per field at 768 dims; cache only wines used in tastings, well inside the 500 MB free quota |
| Cold start | A few seconds on the first request per instance | Acceptable; warm requests should be tens of milliseconds |

One model serves both roles: the ONNX export returns tag logits and layer-k hidden states from a single forward pass, so the tagger adds no extra model download or inference time.

The Supabase free project pauses after a week of inactivity; a Vercel cron ping before events avoids a slow first tasting.

## Alternative architecture: ColBERT if BERT is weak

The soft matcher's formula stays the same either way: idf-weighted MaxSim precision, taster note against reference. ColBERT only changes the vectors, from general-purpose BERT tokens to tokens trained so that MaxSim means "these match". The tagger, credit ladder and `combineScore` are untouched.

**Triggers.** Switch only on evidence from phase 11:

- The BERT soft matcher fails the acceptance gate, or adds no human-correlation gain over `SOFT_ENGINE=openai`
- Near-synonym cases in the frozen set (pairs the ladder misses but raters accept) score no better than chance after rescaling
- Blind-tasting search over the whole catalogue becomes a goal

**Route A (preferred): NorBERT trained as ColBERT, still inside Vercel.** Fine-tune NorBERT3 (NB-BERT if NorBERT3's custom code fights PyLate) with the ColBERT objective, distilling the credit ladder: taster-style notes paired with reference notes, ladder scores as teacher (an LLM judge for descriptors the ladder does not know), hard negatives from wines of the same grape or region, query expansion off. Paraphrase descriptors heavily and hold out surface forms and wines so the model learns concepts, not the 60 derivation rules. Export to ONNX with the 128-dimension projection and run it exactly as the BERT engine runs. Keeps Norwegian strength and the existing infrastructure; the tagger becomes a separate small model.

**Route B: off-the-shelf multilingual ColBERT as a service.** A Norwegian-capable checkpoint such as mLateOn (about 300M parameters) run natively with PyLate on Modal. No ONNX export risk and enables catalogue search, at the cost of a network hop, cold starts and two more accounts. Choose B when catalogue search matters or route A's export fails.

| Service | Role | Free allowance |
| --- | --- | --- |
| Kaggle Notebooks | Fine-tuning (A and B) and batch-encoding the catalogue | Weekly GPU quota; 12-hour sessions |
| Hugging Face Hub | Model hosting (private repo) | Free model repos. Not Spaces: new free CPU Spaces now need PRO |
| Modal (route B) | `/score` and `/search` web endpoints, token-protected, scale to zero | $30/month compute credits |
| Qdrant Cloud (search only) | Multivector collection of all wines, native MaxSim | 1 node, 1 GB RAM, 4 GB disk |

**Qdrant within 1 GB RAM.** About 50 tokens × 128 dims per note is roughly 1.3 GB in float32 for the catalogue. Store multivectors on disk with int8 quantisation (about 320 MB), no HNSW on the multivector field, plus one pooled dense vector per wine with HNSW. Query in two stages: dense prefetch of about 200 candidates, then MaxSim rerank. Check the free cluster's inactivity policy; the event-day cron ping can wake it with Supabase and Modal.

**Integration.** `SOFT_ENGINE=colbert` in `tokenPrecisionSimilarity`. Route A calls the local ONNX model; route B calls Modal with a 2-second timeout and falls back to the BERT or OpenAI engine on failure. Both return per-word best matches so the score breakdown keeps its explanations.

**Contingency phases** (run between phase 11 and phase 12 if triggered; rollout then ships whichever engine passed):

- [ ] **11a, training data:** `scripts/build-colbert-pairs.ts` from real tastings, invariant-style perturbations and synthetic notes; ladder scores as labels; paraphrase pass; held-out wines and surface forms
- [ ] **11b, training on Kaggle:** PyLate distillation (KL over grouped candidates plus term-level credit regression); push to the Hub
- [ ] **11c, serving:** route A ONNX export and verification, or route B Modal app with `/score`
- [ ] **11d, re-run phase 11** with `--soft=colbert`; ship only through the same acceptance gate
- [ ] **11e, optional search:** batch-encode the catalogue on Kaggle, load Qdrant, add `/search` and a blind-tasting view

## Implementation phases

Numbered to continue the GSD phases in `.planning/` (v1.0 ended at phase 05). Each phase ends with a check that gates the next. Phases 06 and 07 can run in parallel.

### Phase 06: Accuracy baseline and negation fix

- [ ] Draw the frozen set of 150–200 tastings; collect 2–3 independent ratings per note using the rubric
- [ ] `scripts/evaluate-human-agreement.ts`: Spearman of the current scorer vs mean rating, plus inter-rater agreement
- [ ] `applyNegation` in `lemmatizeAndWeight.ts`, called before `sanitizeText`; Vitest cases for "ikke noe fat", "uten fat", "ingen tydelig frukt"
- [ ] Add a benchmark perturbation, +NEG: negating a correct descriptor must not raise the score
- [ ] Rescore the frozen set and record both correlations

Done when the baseline correlation is recorded and the negation fix does not lower it.

### Phase 07: Model spike (offline, Python)

- [ ] Export NorBERT3 base (fallback NB-BERT base) to ONNX with two outputs, token logits and layer-k hidden states; quantise int8
- [ ] Load in Node with `@huggingface/transformers` and confirm outputs match PyTorch
- [ ] Check compound tokenisation ("solbærpreg", "fatlagret", "mineraltoner")
- [ ] Push exports to a Hugging Face repo

Done when one Norwegian model runs in Node with verified outputs.

### Phase 08: Descriptor tagger

- [ ] `scripts/build-tagger-dataset.ts`: weak BIO labels from the dictionary over Vinmonopolet and user notes
- [ ] Hand-label about 400 notes with negation, intensity or unknown words (300 train, 100 held out)
- [ ] Fine-tune token classification in Python (Hugging Face Trainer); report per-tag F1 on the held-out set
- [ ] Tune the unknown-word mapping threshold on held-out notes
- [ ] `src/lib/descriptorTagger.ts`; refactor `lexicalCredit` to take a descriptor list; `TAGGER_ENABLED` flag
- [ ] UI: show "read as" for tagger-mapped words in the score breakdown

Done when held-out NEG recall ≥ 0.9, DESC F1 ≥ 0.85, and the human correlation does not drop.

### Phase 09: Soft matcher behind a flag

- [ ] `src/lib/contextualEmbeddings.ts`: model load, word spans, subword pooling, reference LRU, sharing the tagger's forward pass
- [ ] idf-weighted MaxSim precision in `tokenPrecisionSimilarity`, selected by `SOFT_ENGINE=openai|bert`; remove the unused `BERTSCORE_ENABLED` flag
- [ ] `serverExternalPackages` in `next.config.ts`
- [ ] Vitest: alignment, pooling, idf weighting, and the directional property

Done when a preview deploy scores a tasting with the BERT engine.

### Phase 10: Calibration

- [ ] `scripts/compute-maxsim-baseline.ts` → `maxsim-baseline.generated.json` per reference-length bucket
- [ ] Apply the rescale; retire `SOFT_SCALE`
- [ ] Pick layer k by benchmark discrimination and human correlation

Done when unrelated pairs centre near 0 regardless of reference length.

### Phase 11: Benchmark and decision

- [ ] `--soft=openai|bert` and `--tagger=on|off` in `benchmark-scoring.ts`, reusing production code
- [ ] Run the four combinations; record benchmark metrics and human correlation in `scripts/validation-results/`
- [ ] Decide per component against the acceptance gate: tagger and soft matcher ship independently

### Phase 12: Rollout and rescoring

- [ ] Shadow mode: compute old and new scores, log via `scoring-debug.ts`
- [ ] Switch flags after two events with no regressions
- [ ] Rescore history with `recalculate-user-tasting-scores.ts` (dry run, review, `--execute`)
- [ ] Supabase reference cache only if p95 latency exceeds budget
- [ ] Rewrite the README scoring section

### Phase 13: Skill across tastings

- [ ] SQL view for wine difficulty and taster skill with shrinkage (k ≈ 5)
- [ ] Profile tab: skill with tasting count, shown after 10 tastings
- [ ] Sanity check: skill should correlate with the human ratings of each taster's notes

## Acceptance gate

The tagger and the soft matcher each ship only if they raise the human-judgement correlation and match or beat the current engine on every metric `benchmark-scoring.ts` reports, on the same frozen tastings and perturbations.

| Metric | What it tests | Pass condition |
| --- | --- | --- |
| Human correlation | Spearman vs mean rater score on the frozen set | Higher than current, by more than its run-to-run noise |
| +HIT | Adding a descriptor the wine has | ≥ current engine |
| +WRONG | Adding a genuinely wrong descriptor | ≤ current engine, and ≤ 0 |
| +NEG | Negating a correct descriptor | ≤ 0 |
| MISS | Reference gains notes the user never wrote | No worse than current, close to 0 |
| r(len) | Score vs user note length | \|r\| ≤ current engine |
| d / top1 | Real wine vs 100 random distractors | ≥ current engine |
| Tagger, held out | Per-tag F1 on 100 hand-labelled notes | NEG recall ≥ 0.9, DESC F1 ≥ 0.85 |
| `validate-scoring` | Specific-vs-generic test cases | Same pass count or better |
| Latency | Warm scoring request, both fields | p95 within budget (suggest under 300 ms) |

Record the full results table for both engines in `scripts/validation-results/` either way, so a later fine-tuning attempt has a baseline to beat.

## Risks and open questions

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Raters disagree too much to give a usable target | Medium | Measure inter-rater agreement first; tighten the rubric with worked examples before scaling up |
| NorBERT3's custom code blocks ONNX export | Medium | Phase 07 tests it first; NB-BERT is the drop-in fallback |
| Weak dictionary labels teach the tagger the dictionary's gaps | Medium | Hand-labelled notes target exactly those gaps; held-out F1 on hand labels only |
| Unknown-word mapping assigns confident wrong lemmas | Medium | Threshold tuned on held-out notes; mapped words shown as "read as" so users can spot errors |
| Pretrained BERT is weaker than OpenAI on isolated synonyms | Medium | Soft matcher ships independently of the tagger; fallback is fine-tuning, not reverting |
| Rescored history shifts users' past scores | Certain if shipped | Dry run first; a one-line note in the app when scores are recalculated |
| Cold start delays the first score at an event | Medium | Cron ping before events that also warms the model |

Open questions:

- [ ] What latency budget is acceptable for a score to appear after submitting a tasting?
- [ ] Should colour move to a local model too, to drop OpenAI from scoring entirely? Out of scope here; measure separately.
- [ ] Do you want the recommendations feature (still OpenAI note-level embeddings) on the same model later?
