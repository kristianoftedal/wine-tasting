import { baselineFor, levelFor, rescale, topFor } from './baseline';
import { idfWeight, maxSimPrecision, type WordVector } from './maxsim';
import { centered, loadMean, noteWords } from './words';
import type { NoteInput, SoftEngine, SoftEngineId, SoftResult } from './types';
import tableRaw from './colbert-table.generated.json';
import projectionRaw from './colbert-projection.generated.json';
import coocRaw from './cooc-table.generated.json';

/**
 * mLateOn as a lookup table: no model at runtime.
 *
 * The isolated-word engine (colbert-iso) only ever needs one vector per
 * vocabulary word, so scripts/build-colbert-table.ts encodes the whole
 * vocabulary once — every dictionary surface form, every synonym target,
 * every content word that appears at least twice in the catalogue's notes —
 * under both the [Q] and the [D] prefix, and commits the result. Production
 * then does a table lookup: no ONNX runtime, no 350 MB download, no cold
 * start. A word outside the table gets no soft vector, which is what the
 * ladder already does with words it does not know.
 *
 * Two engines share the table:
 *   colbert-table  the vectors as encoded (centred with colbert-iso's mean)
 *   colbert-tuned  the same vectors through a learned 128×128 projection
 *                  fitted on the ladder's own pairs (scripts/train-soft-projection.ts),
 *                  so that what the dictionary knows — fat implies vanilje —
 *                  is also what the metric says.
 */
type TableFile = { meta: { model?: string; dimensions?: number; words?: number; builtAt?: string }; words: Record<string, { q: string; d: string }> };
type ProjectionFile = { dimensions?: number; matrix?: string; trainedAt?: string; pairs?: number; fit?: Record<string, number> };

const TABLE = tableRaw as TableFile;
const COOC = coocRaw as TableFile;
const PROJECTION = projectionRaw as unknown as ProjectionFile;
const DIM = TABLE.meta.dimensions ?? 128;

const decode = (b64: string): Float32Array => {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};

const vectorCache = new Map<string, Float32Array>();
function tableVector(table: TableFile, word: string, side: 'q' | 'd'): Float32Array | null {
  const key = `${table === COOC ? 'c' : 't'}${side}\u0000${word}`;
  const hit = vectorCache.get(key);
  if (hit) return hit;
  const entry = table.words[word];
  if (!entry) return null;
  const vec = decode(entry[side]);
  vectorCache.set(key, vec);
  return vec;
}

let projection: Float32Array | null | undefined;
function projectionMatrix(): Float32Array | null {
  if (projection !== undefined) return projection;
  projection = PROJECTION.matrix ? decode(PROJECTION.matrix) : null;
  return projection;
}

/** y = W·x for a row-major DIM×DIM matrix. */
export function project(x: Float32Array, w: Float32Array): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const row = i * n;
    for (let j = 0; j < n; j++) s += w[row + j] * x[j];
    out[i] = s;
  }
  return out;
}

export const colbertTableCalibration = {
  mean: loadMean('colbert-iso'),
  setMean(mean: Float32Array | null) { this.mean = mean; },
};

/**
 * Catalogue co-occurrence vectors (scripts/build-cooc-vectors.ts): which
 * descriptors are written about the same wines, PPMI + SVD over 59 423
 * notes. Not synonymy but association — vanilje sits by sjokolade and
 * kaffe, tjære by steinsopp and trøfler — which is the "what the wine
 * plausibly shows" judgement the human rater makes and no dictionary holds.
 */
export const coocCalibration = {
  mean: loadMean('cooc'),
  setMean(mean: Float32Array | null) { this.mean = mean; },
  /** Uncentred vector per content word, for the calibration script. */
  async contentVectors(note: NoteInput): Promise<Float32Array[]> {
    return noteWords(note).filter(x => x.content).flatMap(x => { const v = tableVector(COOC, x.key, 'q'); return v ? [v] : []; });
  },
};

export const TABLE_META = { ...TABLE.meta, size: Object.keys(TABLE.words).length, projection: PROJECTION.matrix ? { trainedAt: PROJECTION.trainedAt, pairs: PROJECTION.pairs, fit: PROJECTION.fit } : null };

function makeEngine(id: Extract<SoftEngineId, 'colbert-table' | 'colbert-tuned' | 'cooc'>): SoftEngine {
  const tuned = id === 'colbert-tuned';
  const table = id === 'cooc' ? COOC : TABLE;
  const calibration = id === 'cooc' ? coocCalibration : colbertTableCalibration;
  const engine: SoftEngine = {
    id,
    model: id === 'cooc' ? (COOC.meta.model ?? 'catalogue co-occurrence') : `${TABLE.meta.model ?? 'lightonai/mLateOn'} table${tuned ? ' + projection' : ''}`,

    async available() {
      if (!Object.keys(table.words).length) return { ok: false, reason: id === 'cooc' ? 'tabellen er tom (kjør scripts/build-cooc-vectors.ts)' : 'tabellen er tom (kjør scripts/build-colbert-table.ts)' };
      if (tuned && !projectionMatrix()) return { ok: false, reason: 'ingen projeksjon (kjør scripts/train-soft-projection.ts)' };
      return { ok: true };
    },

    async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
      const started = performance.now();
      const mean = calibration.mean;
      const w = tuned ? projectionMatrix() : null;
      const vectorsOf = (note: NoteInput, side: 'q' | 'd'): { list: WordVector[]; count: number } => {
        const words = noteWords(note).filter(x => x.content);
        const list: WordVector[] = [];
        for (const x of words) {
          const raw = tableVector(table, x.key, side);
          if (!raw) continue;
          const c = centered(raw, mean);
          list.push({ word: x.key, vec: w ? project(c, w) : c });
        }
        return { list, count: words.length };
      };
      const u = vectorsOf(user, 'q'), r = vectorsOf(reference, 'd');
      const { raw, alignments } = maxSimPrecision(u.list, r.list, idfWeight);
      const baseline = baselineFor(id, r.count);
      return {
        engine: id,
        model: engine.model,
        raw,
        baseline,
        softScore: u.list.length && r.list.length ? levelFor(id, rescale(raw, baseline, topFor(id))) : 0,
        alignments,
        ms: performance.now() - started,
      };
    },
  };
  return engine;
}

export const colbertTableEngine = makeEngine('colbert-table');
export const colbertTunedEngine = makeEngine('colbert-tuned');
export const coocEngine = makeEngine('cooc');
