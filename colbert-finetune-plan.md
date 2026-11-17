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

## Pilot, 15 Nov 2026 — measured, not shipped

Ran locally (Apple M4 Pro, MPS, ~2 min per run) with `scripts/build-colbert-pairs.ts` and `scripts/finetune-mlateon.py`. Two changes from the plan above, both from measurements the same day:

- **No contrastive phase.** ColBERT used by the book (full notes, every token, ranking the true wine among 150 of its category) retrieves well — the true wine sits at the 75th percentile — but the rank carries nothing about the human ratings once the ladder is known (partial ρ 0.00). Retrieval rewards words that are rare in the style; the rater rewards words that are right. The loss is therefore listwise per *reference note*: which of six taster notes describes it best (KL against the teacher's distribution).
- **Per field, not per wine.** A document is one lukt or smak note, as the score compares them.

Data: 1 000 training and 200 validation reference notes (frozen-set wines held out), six candidate notes each — gpt-4o-mini levels 4/2/0, level 4 padded with two level-0 words, two neighbours' level-4 notes — rated by the calibrated rubric on gpt-4.1-mini (7 194 ratings, ≈ $5). The same notes carry the ladder's score, so "train on the ladder" is the same run with the other teacher.

Measured on the frozen set (139 human-rated fields; soft term scaled by its own 5th–95th percentile, blended 55/45 as production):

| engine | ρ soft alone | partial ρ \| ladder | ρ blend vs human | ρ full target | ρ constructed | wrong paid |
| --- | --- | --- | --- | --- | --- | --- |
| ladder only | — | — | 0.681 | 0.719 | 0.738 | 0/220 |
| colbert-table (production) | 0.474 | 0.127 | 0.671 | 0.705 | 0.705 | 2/220 |
| mLateOn, no fine-tune | −0.169 | 0.060 | 0.617 | 0.643 | 0.618 | 0/220 |
| fine-tuned, LLM teacher | **0.523** | **0.155** | 0.679 | **0.750** | 0.731 | **41/220** |
| fine-tuned, ladder teacher | 0.521 | 0.041 | 0.667 | 0.721 | 0.705 | 53/220 |

What it shows:

1. **Fine-tuning works.** Two minutes of training take the soft term from −0.17 to 0.52 against the human, the best of any engine measured, and the full target to 0.750, the highest recorded (inside the bootstrap interval of the ladder's 0.719, so not yet a result).
2. **The teacher matters, as predicted.** Trained on the ladder, the model learns what the ladder already knows (partial ρ 0.04); trained on the LLM rater it carries the most information the ladder lacks (0.155). The ladder-teacher route stays closed.
3. **It is not shippable: wrong guesses pay.** Appending two wrong descriptors raises the blended score in 41–53 of 220 fields. Adding the padded notes to training did not fix it (43/220); scoring content words only halves it (24/220) at the cost of the signal (partial ρ 0.076). The teacher is part of the cause — asked about 40 of those perturbations it lowered its rating in only 18 — and the rest looks like noise amplified by a compressed score band (fine-tuned MaxSim sits between 0.82 and 0.89).

Next, if continued: a stricter teacher on padding (rubric line: an unsupported descriptor lowers the rating), five to ten times the data, training and scoring on the same token set, and the table route (isolated words) measured before anything else, since only a table deploys.

## Round 2, 16 Nov 2026 — stricter teacher, the table route, five times the data

Same frozen-set measurement as round 1. Table rows are scored the way `colbert-table` scores (content words, each encoded alone, centred, idf-weighted MaxSim); the "production table, re-created" row checks that harness against the real engine.

| engine | ρ soft alone | partial ρ \| ladder | ρ blend vs human | ρ full target | ρ constructed | wrong paid |
| --- | --- | --- | --- | --- | --- | --- |
| ladder only | — | — | **0.681** | 0.719 | 0.738 | 0/220 |
| colbert-table (production) | 0.474 | 0.127 | 0.671 | 0.705 | 0.705 | 2/220 |
| production table, re-created | 0.460 | 0.074 | 0.658 | 0.690 | 0.695 | 3/220 |
| whole notes, 1k (round 1) | 0.523 | 0.155 | 0.679 | 0.750 | 0.731 | 41/220 |
| whole notes, 1k → table | 0.400 | 0.033 | 0.643 | 0.708 | 0.697 | 6/220 |
| word by word, 1k, padded penalty → table | 0.419 | 0.063 | 0.659 | 0.732 | 0.693 | 5/220 |
| word by word, 5k, padded penalty → table | 0.380 | 0.015 | 0.638 | 0.722 | 0.737 | 8/220 |
| whole notes, 5k, padded penalty | 0.493 | 0.092 | 0.672 | 0.747 | 0.768 | 33/220 |

1. **A stricter rubric does not make a stricter teacher.** One added line ("an unsupported descriptor lowers the rating") moved agreement with the human from 0.573 to 0.496 and lowered padded notes in 15 of 60 against 14. Left off; `--padded-penalty` puts the rule in the targets instead, and it works where the scoring is word by word (41 → 5 wrong guesses paid).
2. **Whole-note training does not survive conversion to a table** (partial ρ 0.138 → 0.033). Training word by word (`--isolated`) is what the table needs; it matches the production table, no more.
3. **Five times the data trains the teacher, not the taster.** Validation agreement with the LLM teacher rises (0.795 → 0.808 for whole notes) while agreement with the human falls (partial ρ 0.155 → 0.092; for the table 0.063 → 0.015). The risk this plan named — "if only the panel moves, the model learned the judge" — is what happened.
4. **No variant beats the ladder alone against the human (0.681).** The full-target gains (up to 0.750) sit inside the bootstrap interval and lean on the LLM fallback ratings, which is the teacher's own family.

Closed for now. What would change it is a second human rater, not more synthetic data: the teacher agrees with the human at 0.57, the ladder at 0.68, and a student cannot learn agreement its teacher does not have. MPS notes for anyone rerunning: `--freeze-embeddings` is needed for `--isolated` on 48 GB, and the clip runs with `foreach=False` (the fused clip wrote NaN into every parameter after ~14 steps).
