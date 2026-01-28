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
  attributeScores: {
    fylde: number
    friskhet: number
    snaerp: number
    sodme: number
    smell: number
    taste: number
  }
}

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  fylde: 0.15,
  friskhet: 0.15,
  snaerp: 0.15,
  sodme: 0.15,
  smell: 0.2,
  taste: 0.2,
}

export const DEFAULT_THRESHOLDS: RecommendationThresholds = {
  minKarakter: 8,
  candidateLimit: 100,
}
