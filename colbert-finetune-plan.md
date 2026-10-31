# Fine-tuning mLateOn on this app's notes

31 Oct 2026 · follows `bert-integration-plan.md`

## What it is for

Every pretrained engine measured here is weakest on exactly the words the soft term exists for: the ones the dictionary cannot place. Two attempts to teach the soft term the dictionary (the hybrid, the projection) made the score worse, because a second vote on what the ladder already decided is worth less than a different opinion. This plan trains a different opinion: *does this taster's note describe this wine*, learned from the catalogue and from judges that are not the ladder.

The model is mLateOn (LightOn, mmBERT-base, 128-dim token vectors, Norwegian in training, Apache 2.0). It is already multi-vector pretrained, which the ColBERT-Zero paper found is the expensive part; a supervised phase plus distillation on top reached 99.4% of full pretraining at a tenth of the cost. We are in that cheap regime.

**Ship condition, unchanged:** the fine-tuned engine must match the production engine on every property-benchmark row within noise (v6: +HIT +14.9, +WRONG −4.4, MISS +3.5, r(len) 0.33, d 1.37, top1 21%) and beat it on the full target (v6: 0.708) by more than the bootstrap interval. If it clears both, it ships as a table (`colbert-table` built from the fine-tuned weights), not as a runtime model.

## Data

Three kinds of rows, all produced by one script, `scripts/build-colbert-pairs.ts` (to be written), as JSONL under `scripts/validation-results/finetune/` (gitignored; the recipe is in git, the data is regenerable).

**1. Documents.** The catalogue: 59 423 wines, smell note + taste note joined, after the same cleaning the scorer uses. Two held-out sets are carved out first and never trained on: the 41 wines of the frozen evaluation set, and 500 random wines stratified by category for the model's own validation.

**2. Queries: synthetic taster notes.** Two or three per wine, written by gpt-4o-mini in the register real tasters use. The generator exists (`scripts/build-constructed-set.ts` writes notes at known rubric levels); it changes in three ways: few-shot examples are drawn from the frozen set's real notes so the output is "Rødt eple sitrus mineralsk", not prose; length is sampled from the real distribution (median four words, p90 seven); and a fraction get the typos real notes have (`brioch`, `meineralsk`, `citrus`). For each wine: one note at level 4 (all words supported), one at level 2–3 (partly), one at level 0 (another style's descriptors). The level-0 note is not a negative for its own wine only; it is a *query* for whichever wine its words do describe, which the generator records. Volume: about 150 000 short generations, a few dollars.

**3. Hard negatives.** For each (query, wine) pair, five other wines of the same main category whose notes are closest to the wine's by the catalogue co-occurrence vectors (`cooc` table, already built), excluding any wine whose note contains every content word of the query. Same-category neighbours are the negatives that matter: a Syrah note against another Syrah, not against a Riesling. The literature's warning (SyNeg) is that LLM-written negatives alone underperform mined ones; these are mined.

**4. Teacher scores, for distillation.** The calibrated gpt-4o rater (`scripts/rate-with-llm.ts --calibrate=kristian`, agreement with the human 0.61) scores a stratified sample of 15 000 (query, candidate wine) pairs with the rubric, 0–4. That is the opinion the model learns, and it is the one that was *not* in the ladder. The remaining pairs train contrastively without a teacher.

**Leakage check, in the script:** no held-out wine appears as a positive, a negative or a source of few-shot examples in any training row.

## Training

On Kaggle (free GPU quota, 30 hours a week; a P100 or T4 is enough) with PyLate. The notebook is `notebooks/finetune-mlateon.ipynb` (to be written); the steps it runs:

1. `pip install pylate` ; load `lightonai/mLateOn` with `models.ColBERT(..., query_prefix='[Q] ', document_prefix='[D] ', query_length=32, document_length=96)`. The prefixes and lengths must match what the engines use at inference; ColBERT-Zero stresses this and our own span bug showed why.
2. **Phase A, contrastive**: `losses.Contrastive` with in-batch and the five mined negatives, batch 64, learning rate 2e-5, one epoch over the ~120 000 query rows, warm-up 5%. About two hours on a P100.
3. **Phase B, distillation**: `losses.Distillation` (KL between the model's and the teacher's score distributions) on the 15 000 teacher-scored pairs, learning rate 1e-5, two epochs. About half an hour.
4. Evaluate on the 500 held-out wines after each phase with the retrieval metric PyLate reports (does the right wine come first) and, more importantly, export and run *our* measurements, because retrieval rank is not the objective.
5. Export: the model repo ships `export_onnx.py` (Transformer → Dense ×3 → L2, opset 18, dynamic int8). Run it on the fine-tuned checkpoint; it produces `model.onnx` and `model_int8.onnx`.

Output: a folder `mLateOn-ft/` with `config.json`, `tokenizer.json`, `config_sentence_transformers.json`, `model_int8.onnx`.

## Bringing it back

1. Put the folder under `models/lightonai/mLateOn-ft/`.
2. `COLBERT_REPO=lightonai/mLateOn-ft` makes every `colbert-*` engine read it (one-line change to `colbert.ts`: the constant becomes an env override).
3. `npx tsx scripts/parity-dump.ts` + `scripts/parity-check.py` on the new checkpoint, same as before.
4. `scripts/compute-maxsim-baseline.ts --engines=colbert-iso,colbert-token` for centring, floor and the exact-match top.
5. `scripts/build-colbert-table.ts` to encode the vocabulary once with the fine-tuned model.
6. `scripts/benchmark-scoring.ts --engines=openai,colbert-table --frozen=…` and `scripts/measure-hybrid-soft.ts --engines=openai,colbert-table`: the gate.
7. If it clears: regenerate the demo extract and the scores CSV; the decision table in the main plan gets a row.

## Who does what

| step | who | effort |
| --- | --- | --- |
| `build-colbert-pairs.ts`: documents, synthetic queries, mined negatives, teacher sample, leakage check | me | 1 day; runs ~2 hours, a few dollars of API |
| Kaggle notebook | me | half a day |
| Kaggle account, upload the JSONL as a private dataset, run the notebook, download the export | you | an hour of attention, 3–4 hours of wall-clock |
| parity, calibration, table, gate, write-up | me | half a day |

## Risks, and what each one costs

- **Synthetic notes are not real notes.** The few-shot conditioning, the length distribution and the typo injection are the mitigation; the check is that the fine-tuned engine's agreement with the *human* rows (149 fields) moves with its agreement with the panel. If only the panel moves, the model learned the judge, not the tasters.
- **The teacher is a model judging language.** It agrees with one person at 0.61, about what two people manage; that is the ceiling we have. A second human rater would raise it, and is the one input this plan cannot manufacture.
- **Overfitting to catalogue prose.** The validation set of 500 unseen wines catches it in the retrieval metric; the frozen set catches it in the score.
- **It may simply not beat OpenAI.** Every local engine so far sits within 0.03 of it. The outcome is then a documented negative at the cost of a day and a few dollars, which is how every other experiment here ended, and the table engine remains the local option regardless.

## First step

Say go and I write `build-colbert-pairs.ts` and run it; the data lands in a folder you upload. Nothing in production changes until step 7.
