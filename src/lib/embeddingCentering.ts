/**
 * Anisotropy correction for wine-note embeddings.
 *
 * Measured on this corpus with text-embedding-3-small: the mean of 1 166
 * L2-normalised wine-note vectors has magnitude 0.68. For an isotropic
 * distribution opposing directions cancel and that magnitude would be ~0, so
 * every wine note points substantially the same way — the vectors occupy a
 * narrow cone rather than the sphere.
 *
 * The consequence is a constant floor under every comparison:
 *
 *   cosine between two UNRELATED wine notes   0.459 ± 0.159
 *   the same pairs after mean-centering      -0.004 ± 0.156
 *
 * The offset disappears and the spread survives intact — the 0.46 was the model
 * observing that both texts are Norwegian wine prose, which is true of all
 * 50 057 wines and therefore carries no information about tasting accuracy.
 *
 * Mean-centering only; no whitening. A stable 1 536×1 536 covariance estimate
 * needs far more samples than the corpus supports, and a poorly-conditioned
 * whitening matrix amplifies noise instead of removing it.
 *
 * Regenerate with `npx tsx --env-file=.env.local scripts/compute-corpus-mean.ts`
 * after any embedding-model change — the mean is model-specific.
 */
import corpusMean from './corpus-mean.generated.json';

type CorpusMean = { model: string; dimensions: number; sampleSize: number; meanNorm: number; vector: number[] };

const MEAN = corpusMean as CorpusMean;
const MEAN_VECTOR = Float32Array.from(MEAN.vector);

export const CORPUS_MEAN_META = {
  model: MEAN.model,
  dimensions: MEAN.dimensions,
  sampleSize: MEAN.sampleSize,
  meanNorm: MEAN.meanNorm,
};

/**
 * L2-normalise, then subtract the corpus mean direction. Returns a new vector;
 * the input is untouched. Dimension mismatches pass the vector through rather
 * than throwing, so an embedding-model swap degrades to uncentered scoring
 * instead of taking down scoring entirely.
 */
export function centerEmbedding(vec: number[] | Float32Array): Float32Array {
  if (vec.length !== MEAN_VECTOR.length) return Float32Array.from(vec);

  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return Float32Array.from(vec);

  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm - MEAN_VECTOR[i];
  return out;
}
