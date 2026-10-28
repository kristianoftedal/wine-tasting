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

type BaselineFile = Partial<Record<SoftEngineId, { model: string; measuredAt: string; pairs: number; buckets: Partial<Record<BaselineBucket, number>> }>>;

const BASELINES = baselineRaw as BaselineFile;

export function bucketFor(referenceWordCount: number): BaselineBucket {
  if (referenceWordCount <= 3) return '1-3';
  if (referenceWordCount <= 6) return '4-6';
  if (referenceWordCount <= 10) return '7-10';
  return '11+';
}

export function baselineFor(engine: SoftEngineId, referenceWordCount: number): number {
  return BASELINES[engine]?.buckets[bucketFor(referenceWordCount)] ?? 0;
}

export function baselineMeta(engine: SoftEngineId) {
  return BASELINES[engine] ?? null;
}

/** (raw − b) / (1 − b), clamped to [0, 1], then onto 0–100. */
export function rescale(raw: number, baseline: number): number {
  const denom = 1 - baseline;
  if (denom <= 0) return 0;
  return Math.max(0, Math.min(1, (raw - baseline) / denom)) * 100;
}
