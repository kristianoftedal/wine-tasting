import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { baselineFor, rescale, topFor } from './baseline';
import { idfWeight, maxSimPrecision, type WordVector } from './maxsim';
import { EncodingCache, MODEL_DIR, centered, l2normalize, loadMean, meanPool, noteWords, tokenizeWithSpans, type Tokenizer } from './words';
import type { NoteInput, SoftEngine, SoftResult } from './types';

/**
 * NorBERT3 base as a contextual word-vector engine.
 *
 * The whole note is encoded once; each content word's vector is the mean of
 * its subword vectors from the last layer, L2-normalised. Scoring is the same
 * directional MaxSim as the OpenAI engine, but idf-weighted (the lexical side
 * already is) and rescaled against a measured floor per reference length
 * (baseline.ts) instead of the fixed SOFT_SCALE.
 *
 * Model: lebchen/norbert3-base-onnx (int8, Apache 2.0), fetched into
 * SOFT_MODEL_DIR by scripts/fetch-soft-models.ts. The config carries no
 * model_type, so transformers.js loads it through its base class; the ONNX
 * graph is what runs, and a five-note parity check against the PyTorch
 * original is part of phase 08.
 *
 * Word spans are recovered from one whole-text tokenisation by the
 * tokenizer's word-start markers (words.ts); engines.test.ts measures how
 * often that succeeds on real notes, and the fallback is per-word tokenising.
 */
export const BERT_REPO = 'lebchen/norbert3-base-onnx';
const FILES = ['config.json', 'tokenizer.json', 'onnx/model_quantized.onnx'];

type Encoded = { vectors: Map<string, Float32Array>; wordCount: number };

type Loaded = {
  tokenizer: Tokenizer;
  model: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  Tensor: new (type: string, data: BigInt64Array, dims: number[]) => unknown;
  cls: number[];
  sep: number[];
};

let loading: Promise<Loaded> | null = null;
const cache = new EncodingCache<Encoded>();

/**
 * Calibration state and hooks. `mean` is subtracted at score time (encodings
 * are cached uncentred), so scripts/compute-maxsim-baseline.ts can collect
 * raw vectors, set a mean, and re-score without reloading anything.
 */
export const bertCalibration = {
  mean: loadMean('bert'),
  setMean(mean: Float32Array | null) { this.mean = mean; },
  /** Uncentred, L2-normalised vector per content word. */
  async contentVectors(note: NoteInput): Promise<Float32Array[]> { return [...(await encode(note)).vectors.values()]; },
};

/** Same, for the isolated-word variant, whose vectors have their own distribution. */
export const bertIsoCalibration = {
  mean: loadMean('bert-iso'),
  setMean(mean: Float32Array | null) { this.mean = mean; },
  async contentVectors(note: NoteInput): Promise<Float32Array[]> { return [...(await encodeIsolated(note)).vectors.values()]; },
};

const isoCache = new EncodingCache<Float32Array>(8000);

/**
 * Each content word encoded on its own (with the leading space, so it
 * tokenises as it would mid-sentence), cached per word: the OpenAI engine's
 * approach with a local model. No context, no span recovery, and an exact
 * match is cosine 1.0 by construction.
 */
async function encodeIsolated(note: NoteInput): Promise<Encoded> {
  const { tokenizer, model, Tensor, cls, sep } = await load();
  const words = noteWords(note).filter(w => w.content);
  const vectors = new Map<string, Float32Array>();
  for (const w of words) {
    let vec = isoCache.get(w.key);
    if (!vec) {
      const { ids, spans } = tokenizeWithSpans(tokenizer, [w.text], cls, sep);
      const input_ids = new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
      const attention_mask = new Tensor('int64', BigInt64Array.from(ids.map(() => BigInt(1))), [1, ids.length]);
      const out = await model({ input_ids, attention_mask });
      const hidden = out.last_hidden_state ?? Object.values(out)[0];
      const dim = hidden.dims[hidden.dims.length - 1];
      const [a, b] = spans[0];
      const rows: Float32Array[] = [];
      for (let t = a; t < b; t++) rows.push(Float32Array.from(hidden.data.subarray(t * dim, (t + 1) * dim)));
      vec = l2normalize(meanPool(rows));
      isoCache.set(w.key, vec);
    }
    vectors.set(w.key, vec);
  }
  return { vectors, wordCount: words.length };
}

function missingFile(): string | null {
  for (const f of FILES) if (!existsSync(join(MODEL_DIR(), BERT_REPO, f))) return f;
  return null;
}

async function load(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      const tjs = await import('@huggingface/transformers');
      tjs.env.localModelPath = MODEL_DIR();
      tjs.env.allowRemoteModels = false;
      tjs.env.allowLocalModels = true;
      const tokenizer = (await tjs.AutoTokenizer.from_pretrained(BERT_REPO)) as unknown as Tokenizer;
      const model = (await tjs.AutoModel.from_pretrained(BERT_REPO, { dtype: 'q8' })) as unknown as Loaded['model'];
      // [CLS] x [SEP]: whatever sits before and after a lone token is the special-token frame.
      const probe = tokenizer.encode('x', { add_special_tokens: true });
      const bare = tokenizer.encode('x', { add_special_tokens: false });
      const at = probe.indexOf(bare[0]);
      return { tokenizer, model, Tensor: tjs.Tensor as unknown as Loaded['Tensor'], cls: probe.slice(0, at), sep: probe.slice(at + bare.length) };
    })();
  }
  return loading;
}

async function encode(note: NoteInput): Promise<Encoded> {
  const hit = cache.get(note.raw);
  if (hit) return hit;
  const { tokenizer, model, Tensor, cls, sep } = await load();
  const words = noteWords(note);
  const wordCount = words.filter(w => w.content).length;
  const vectors = new Map<string, Float32Array>();
  if (words.length && wordCount > 0) {
    const { ids, spans } = tokenizeWithSpans(tokenizer, words.map(w => w.text), cls, sep);
    const input_ids = new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
    const attention_mask = new Tensor('int64', BigInt64Array.from(ids.map(() => BigInt(1))), [1, ids.length]);
    const out = await model({ input_ids, attention_mask });
    const hidden = out.last_hidden_state ?? Object.values(out)[0];
    const dim = hidden.dims[hidden.dims.length - 1];
    words.forEach((w, i) => {
      if (!w.content) return;
      const [a, b] = spans[i];
      if (b <= a) return;
      const rows: Float32Array[] = [];
      for (let t = a; t < b; t++) rows.push(hidden.data.subarray(t * dim, (t + 1) * dim));
      vectors.set(w.key, l2normalize(meanPool(rows)));
    });
  }
  const encoded = { vectors, wordCount };
  cache.set(note.raw, encoded);
  return encoded;
}

function makeEngine(id: 'bert' | 'bert-iso'): SoftEngine {
  const isolated = id === 'bert-iso';
  const calibration = isolated ? bertIsoCalibration : bertCalibration;
  const engine: SoftEngine = {
    id,
    model: `${BERT_REPO}@int8${isolated ? ' (isolated words)' : ''}`,

    async available() {
      const missing = missingFile();
      return missing
        ? { ok: false, reason: `mangler ${BERT_REPO}/${missing} i ${MODEL_DIR()} (kjør scripts/fetch-soft-models.ts)` }
        : { ok: true };
    },

    async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
      const started = performance.now();
      const enc = isolated ? encodeIsolated : encode;
      const [u, r] = await Promise.all([enc(user), enc(reference)]);
      const mean = calibration.mean;
      const toList = (m: Map<string, Float32Array>): WordVector[] => [...m.entries()].map(([word, vec]) => ({ word, vec: centered(vec, mean) }));
      const { raw, alignments } = maxSimPrecision(toList(u.vectors), toList(r.vectors), idfWeight);
      const baseline = baselineFor(id, r.wordCount);
      return {
        engine: id,
        model: engine.model,
        raw,
        baseline,
        softScore: u.vectors.size && r.vectors.size ? rescale(raw, baseline, topFor(id)) : 0,
        alignments,
        ms: performance.now() - started,
      };
    },
  };
  return engine;
}

export const bertEngine = makeEngine('bert');
export const bertIsoEngine = makeEngine('bert-iso');
