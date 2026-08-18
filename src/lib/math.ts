/**
 * Cosine similarity between two vectors, returned in [-1, 1].
 *
 * Magnitudes are computed with a plain accumulator rather than
 * `Math.hypot(...vec)`: spreading 1 536 arguments onto the call stack and
 * running hypot's overflow-safe rescaling costs far more than the naive form,
 * and embedding components are all well inside float range.
 */
export function cosineSimilarity(vecA: number[] | Float32Array, vecB: number[] | Float32Array): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / Math.sqrt(normA * normB);
}
