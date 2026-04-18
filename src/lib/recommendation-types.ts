// Shared types and constants for wine recommendations
// These can be imported by both client and server components

export interface RecommendationWeights {
  fylde: number
  friskhet: number
  snaerp: number
  sodme: number
  smell: number
  taste: number
}

export interface RecommendationThresholds {
  minKarakter: number // Minimum rating to consider a wine "liked"
  candidateLimit: number // How many candidates to consider
}

export interface WineSimilarityScore {
  wine: import("@/lib/types").Wine
  similarityScore: number
  // null means the component was skipped (wine or user lacks the data);
  // display as "—" rather than imputing a middle value.
  attributeScores: {
    fylde: number | null
    friskhet: number | null
    snaerp: number | null
    sodme: number | null
    smell: number | null
    taste: number | null
  }
}

// Semantic smell/taste is the only signal that meaningfully varies across
// high-matching candidates — numeric attributes are integers 0–10 and
// candidates cluster at identical distances from the user's averages. A
// 70/30 semantic-to-numeric split lets the varying signal drive the ranking
// instead of being diluted by constants. See recommendation diagnosis
// 2026-04 for the data.
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  fylde: 0.075,
  friskhet: 0.075,
  snaerp: 0.075,
  sodme: 0.075,
  smell: 0.35,
  taste: 0.35,
}

export const DEFAULT_THRESHOLDS: RecommendationThresholds = {
  minKarakter: 8,
  candidateLimit: 100,
}
