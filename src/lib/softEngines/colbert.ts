import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { baselineFor, rescale } from './baseline';
import { idfWeight, maxSimPrecision, type WordVector } from './maxsim';
import { cosineSimilarity } from '../math';
import { EncodingCache, MODEL_DIR, l2normalize, meanPool, noteWords, tokenizeWithSpans, type Tokenizer } from './words';
import type { NoteInput, SoftEngine, SoftEngineId, SoftResult, TokenAlignment } from './types';

/**
 * mLateOn (lightonai), a multilingual ColBERT on mmBERT-base, as the soft
 * engine. Late interaction: every token gets a 128-dim vector trained so
 * that MaxSim between a query and a document means "these match". The
 * taster's note is the query ("[Q] " prefix), the reference the document
 * ("[D] "); no query expansion, as the checkpoint is configured.
 *
 * The ONNX graph in the repo already contains the three Dense projections
 * and the per-token L2 normalisation (see its export_onnx.py), so it is run
 * with onnxruntime-node directly rather than through a transformers.js
 * pipeline; only the tokenizer comes from transformers.js. Padding positions
 * are not zeroed by the graph; single-sequence inference here never pads.
 *
 * Two variants share one session and one cache:
 *   colbert-token  for each user subword, max similarity over the reference
 *                  content subwords; averaged within the word; idf-weighted
 *                  mean over words. The operation the model was trained on.
 *   colbert-word   subwords mean-pooled into one vector per word first, then
 *                  the same word-level MaxSim every other engine uses.
 *
 * Files: config.json, tokenizer.json, model_int8.onnx under
 * SOFT_MODEL_DIR/lightonai/mLateOn (scripts/fetch-soft-models.ts).
 */
export const COLBERT_REPO = 'lightonai/mLateOn';
const FILES = ['config.json', 'tokenizer.json', 'model_int8.onnx'];
const QUERY_PREFIX = '[Q]';
const DOCUMENT_PREFIX = '[D]';

type Encoded = { tokens: Map<string, Float32Array[]>; pooled: Map<string, Float32Array>; wordCount: number };

type Loaded = {
  tokenizer: Tokenizer;
  run: (ids: number[]) => Promise<{ data: Float32Array; dims: number[] }>;
  cls: number[];
  sep: number[];
};

let loading: Promise<Loaded> | null = null;
const cache = new EncodingCache<Encoded>();

function missingFile(): string | null {
  for (const f of FILES) if (!existsSync(join(MODEL_DIR(), COLBERT_REPO, f))) return f;
  return null;
}

async function load(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      const [tjs, ort] = await Promise.all([import('@huggingface/transformers'), import('onnxruntime-node')]);
      tjs.env.localModelPath = MODEL_DIR();
      tjs.env.allowRemoteModels = false;
      tjs.env.allowLocalModels = true;
      const tokenizer = (await tjs.AutoTokenizer.from_pretrained(COLBERT_REPO)) as unknown as Tokenizer;
      const probe = tokenizer.encode('x', { add_special_tokens: true });
      const bare = tokenizer.encode('x', { add_special_tokens: false });
      const at = probe.indexOf(bare[0]);
      const session = await ort.InferenceSession.create(join(MODEL_DIR(), COLBERT_REPO, 'model_int8.onnx'), {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
      const run = async (ids: number[]) => {
        const feeds = {
          input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
          attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids.map(() => BigInt(1))), [1, ids.length]),
        };
        const out = await session.run(feeds);
        const t = out[session.outputNames[0]];
        return { data: t.data as Float32Array, dims: t.dims as number[] };
      };
      return { tokenizer, run, cls: probe.slice(0, at), sep: probe.slice(at + bare.length) };
    })();
  }
  return loading;
}

async function encode(note: NoteInput, prefix: string): Promise<Encoded> {
  const key = `${prefix}\u0000${note.raw}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { tokenizer, run, cls, sep } = await load();
  const words = noteWords(note);
  const wordCount = words.filter(w => w.content).length;
  const tokens = new Map<string, Float32Array[]>();
  const pooled = new Map<string, Float32Array>();
  if (words.length && wordCount > 0) {
    // "[Q] solbær og fat": the prefix is the first word group and is skipped.
    const { ids, spans } = tokenizeWithSpans(tokenizer, words.map(w => w.text), cls, sep, prefix);
    const out = await run(ids);
    const dim = out.dims[out.dims.length - 1];
    words.forEach((w, i) => {
      if (!w.content) return;
      const [a, b] = spans[i];
      if (b <= a) return;
      const rows: Float32Array[] = [];
      for (let t = a; t < b; t++) rows.push(Float32Array.from(out.data.subarray(t * dim, (t + 1) * dim)));
      tokens.set(w.key, rows);
      pooled.set(w.key, l2normalize(meanPool(rows)));
    });
  }
  const encoded = { tokens, pooled, wordCount };
  cache.set(key, encoded);
  return encoded;
}

/** Token-level late interaction, averaged within each user word. */
function tokenMaxSim(user: Map<string, Float32Array[]>, reference: Map<string, Float32Array[]>): { raw: number; alignments: TokenAlignment[] } {
  if (!user.size || !reference.size) return { raw: 0, alignments: [] };
  const refTokens = [...reference.entries()].flatMap(([word, rows]) => rows.map(vec => ({ word, vec })));
  let num = 0, den = 0;
  const alignments: TokenAlignment[] = [];
  for (const [word, rows] of user) {
    let wordSum = 0;
    const bestCount = new Map<string, number>();
    for (const vec of rows) {
      let best = -Infinity, bestWord = '';
      for (const r of refTokens) {
        const sim = cosineSimilarity(vec, r.vec);
        if (sim > best) { best = sim; bestWord = r.word; }
      }
      wordSum += best;
      bestCount.set(bestWord, (bestCount.get(bestWord) ?? 0) + 1);
    }
    const sim = wordSum / rows.length;
    const best = [...bestCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const weight = idfWeight(word);
    num += weight * sim;
    den += weight;
    alignments.push({ word, best, sim, weight });
  }
  return { raw: den > 0 ? num / den : 0, alignments };
}

function makeEngine(id: Extract<SoftEngineId, 'colbert-word' | 'colbert-token'>): SoftEngine {
  const engine: SoftEngine = {
    id,
    model: `${COLBERT_REPO}@int8`,

    async available() {
      const missing = missingFile();
      return missing
        ? { ok: false, reason: `mangler ${COLBERT_REPO}/${missing} i ${MODEL_DIR()} (kjør scripts/fetch-soft-models.ts)` }
        : { ok: true };
    },

    async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
      const started = performance.now();
      const [u, r] = await Promise.all([encode(user, QUERY_PREFIX), encode(reference, DOCUMENT_PREFIX)]);
      const toList = (m: Map<string, Float32Array>): WordVector[] => [...m.entries()].map(([word, vec]) => ({ word, vec }));
      const { raw, alignments } = id === 'colbert-token'
        ? tokenMaxSim(u.tokens, r.tokens)
        : maxSimPrecision(toList(u.pooled), toList(r.pooled), idfWeight);
      const baseline = baselineFor(id, r.wordCount);
      return {
        engine: id,
        model: engine.model,
        raw,
        baseline,
        softScore: u.pooled.size && r.pooled.size ? rescale(raw, baseline) : 0,
        alignments,
        ms: performance.now() - started,
      };
    },
  };
  return engine;
}

export const colbertWordEngine = makeEngine('colbert-word');
export const colbertTokenEngine = makeEngine('colbert-token');
