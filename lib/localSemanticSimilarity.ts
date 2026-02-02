import { lemmatizeAndWeight, stopwords, type TextAnalysis } from "./lemmatizeAndWeight"

/**
 * Calculate weighted cosine similarity between two text analyses
 */
function calculateWeightedCosineSimilarity(
  text1Data: TextAnalysis,
  text2Data: TextAnalysis
): number {
  const lemmas1 = new Map<string, number>()
  const lemmas2 = new Map<string, number>()

  text1Data.lemmatized.forEach((item) => {
    lemmas1.set(item.lemma, (lemmas1.get(item.lemma) || 0) + item.weight)
  })

  text2Data.lemmatized.forEach((item) => {
    lemmas2.set(item.lemma, (lemmas2.get(item.lemma) || 0) + item.weight)
  })

  const allLemmas = new Set([...lemmas1.keys(), ...lemmas2.keys()])

  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0

  allLemmas.forEach((lemma) => {
    const val1 = lemmas1.get(lemma) || 0
    const val2 = lemmas2.get(lemma) || 0

    dotProduct += val1 * val2
    magnitude1 += val1 * val1
    magnitude2 += val2 * val2
  })

  if (magnitude1 === 0 || magnitude2 === 0) return 0
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))
}

/**
 * Calculate Jaccard similarity with overlap coefficient for better partial matching
 */
function calculateJaccardSimilarity(text1: string, text2: string): number {
  const cleanText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopwords.has(word))

  const words1 = new Set(cleanText(text1))
  const words2 = new Set(cleanText(text2))

  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = [...words1].filter((word) => words2.has(word)).length
  const union = new Set([...words1, ...words2]).size

  if (union === 0) return 0

  const jaccard = intersection / union
  const minSize = Math.min(words1.size, words2.size)
  const overlap = intersection / minSize

  // Weighted combination: 60% overlap + 40% Jaccard
  return overlap * 0.6 + jaccard * 0.4
}

/**
 * Local semantic similarity using weighted lemma matching and Jaccard similarity.
 * This runs entirely locally without requiring any external API.
 * Returns a score from 0-100.
 */
export async function localSemanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    // Get lemmatized data for weighted cosine similarity
    const data1 = lemmatizeAndWeight(text1)
    const data2 = lemmatizeAndWeight(text2)

    // Calculate weighted cosine similarity on lemmas
    const cosineSim = calculateWeightedCosineSimilarity(data1, data2)

    // Calculate Jaccard similarity for word overlap
    const jaccardSim = calculateJaccardSimilarity(text1, text2)

    // Combine both: 70% weighted cosine (uses Norwegian wine vocabulary), 30% Jaccard
    const combined = cosineSim * 0.7 + jaccardSim * 0.3

    return Math.round(combined * 100)
  } catch (error) {
    console.error("Local semantic similarity error:", error)
    return 0
  }
}
