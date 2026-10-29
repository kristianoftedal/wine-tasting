import baselineRaw from './maxsim-baseline.generated.json';
import type { SoftEngineId } from './types';

/**
 * Measured MaxSim floor per engine, by reference length.
 *
 * A max over more reference words is higher by chance, and every model has its
 * own floor for unrelated pairs (BERT and ColBERT vectors are anisotropic in
 * their own ways; OpenAI's is removed by centring instead). The generated file
 * records, for each engine and reference-word-count bucket, the mean raw
 * MaxSim between a real taster note and a random wine's note, measured by
 * scripts/compute-maxsim-baseline.ts over the frozen set and the benchmark's
 * distractors. The rescale (raw − b) / (1 − b) then puts "unrelated" near 0
 * and "every word matched perfectly" at 1 for every engine and length.
 *
 * Missing engine or bucket → b = 0, i.e. no rescale; the demo shows the
 * baseline column so an uncalibrated engine is visible as such.
 */
export const BASELINE_BUCKETS = ['1-3', '4-6', '7-10', '11+'] as const;
export type BaselineBucket = (typeof BASELINE_BUCKETS)[number];

type BaselineFile = Partial<Record<SoftEngineId, { model: string; measuredAt: string; pairs: number; buckets: Partial<Record<BaselineBucket, number>>; /** Mean raw similarity of an exact word match (same word on both sides), the engine's own 100. */ top?: number }>>;

const BASELINES = baselineRaw as BaselineFile;

export function bucketFor(referenceWordCount: number): BaselineBucket {
  if (referenceWordCount <= 3) return '1-3';
  if (referenceWordCount <= 6) return '4-6';
  if (referenceWordCount <= 10) return '7-10';
  return '11+';
}

/**
 * The engine's floor for this reference length; the nearest measured bucket
 * when this one has no measurement, 0 when the engine was never calibrated.
 */
export function baselineFor(engine: SoftEngineId, referenceWordCount: number): number {
  const buckets = BASELINES[engine]?.buckets;
  if (!buckets) return 0;
  const want = BASELINE_BUCKETS.indexOf(bucketFor(referenceWordCount));
  for (let d = 0; d < BASELINE_BUCKETS.length; d++) {
    for (const i of [want - d, want + d]) {
      const b = buckets[BASELINE_BUCKETS[i]];
      if (b !== undefined) return b;
    }
  }
  return 0;
}

export function baselineMeta(engine: SoftEngineId) {
  return BASELINES[engine] ?? null;
}

/**
 * The engine's measured level for an exact word match, or 1 when not measured.
 * A contextual engine never reaches cosine 1 for the same word in two
 * sentences (NorBERT and mLateOn sit near 0.45 after centring), so without
 * this anchor their soft term tops out at a third of the OpenAI engine's.
 */
export function topFor(engine: SoftEngineId): number {
  return BASELINES[engine]?.top ?? 1;
}

/** (raw − b) / (top − b), clamped to [0, 1], then onto 0–100: unrelated reads 0, an exact match reads 100. */
export function rescale(raw: number, baseline: number, top = 1): number {
  const denom = top - baseline;
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(1, (raw - baseline) / denom)) * 100;
}
