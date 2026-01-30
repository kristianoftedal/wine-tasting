"use server"

import { stopwords, lemmatizeAndWeight } from "@/lib/lemmatizeAndWeight"

/**
 * Compute text similarity (0–100) between two phrases using Jaccard similarity.
 * This is a serverless-compatible alternative - for ML-based similarity, use
 * the client-side useSemanticSimilarity hook.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    const cleanText = (text: string) =>
      text
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopwords.has(word))

    const words1 = new Set(cleanText(text1))
    const words2 = new Set(cleanText(text2))

    if (words1.size === 0 || words2.size === 0) return 0

    // Calculate Jaccard similarity: intersection / union
    const intersection = [...words1].filter((word) => words2.has(word)).length
    const union = new Set([...words1, ...words2]).size

    if (union === 0) return 0

    const jaccard = intersection / union

    // Also calculate overlap coefficient for better partial matching
    const minSize = Math.min(words1.size, words2.size)
    const overlap = intersection / minSize

    // Weighted combination: 60% overlap + 40% Jaccard
    const combined = overlap * 0.6 + jaccard * 0.4

    return Math.round(combined * 100)
  } catch (error) {
    console.error("Semantic similarity error:", error)
    return 0
  }
}

/**
 * Compute similarity between lemmatized words (0-100)
 */
async function lemmaSimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    const data1 = lemmatizeAndWeight(text1)
    const data2 = lemmatizeAndWeight(text2)

    const lemmas1 = new Set(data1.lemmatized.map((item) => item.lemma))
    const lemmas2 = new Set(data2.lemmatized.map((item) => item.lemma))

    if (lemmas1.size === 0 || lemmas2.size === 0) return 0

    const intersection = [...lemmas1].filter((lemma) => lemmas2.has(lemma)).length
    const union = new Set([...lemmas1, ...lemmas2]).size

    return Math.round((intersection / union) * 100)
  } catch (error) {
    console.error("Lemma similarity error:", error)
    return 0
  }
}

/**
 * Compute similarity between category distributions (0-100)
 */
async function categorySimpleSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    const data1 = lemmatizeAndWeight(text1)
    const data2 = lemmatizeAndWeight(text2)

    const categories1 = new Set(Object.keys(data1.categories))
    const categories2 = new Set(Object.keys(data2.categories))

    if (categories1.size === 0 || categories2.size === 0) return 0

    const intersection = [...categories1].filter((cat) => categories2.has(cat)).length
    const union = new Set([...categories1, ...categories2]).size

    return Math.round((intersection / union) * 100)
  } catch (error) {
    console.error("Category similarity error:", error)
    return 0
  }
}

/**
 * Calculate comprehensive similarity score (serverless-compatible version).
 * For ML-based similarity, use the client-side useSemanticSimilarity hook.
 */
export async function comprehensiveSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    const [standardScore, lemmaScore, categoryScore] = await Promise.all([
      semanticSimilarity(text1, text2),
      lemmaSimpleSimilarity(text1, text2),
      categorySimpleSimilarity(text1, text2),
    ])

    // Average the three scores
    const averageScore = Math.round((standardScore + lemmaScore + categoryScore) / 3)

    return averageScore
  } catch (error) {
    console.error("Comprehensive similarity error:", error)
    return 0
  }
}

/**
 * Calculate all similarity scores for a tasting in one server call.
 * Uses word-overlap similarity (serverless-compatible).
 */
export async function calculateTastingScores(
  userFarge: string,
  userLukt: string,
  userSmak: string,
  wineColor: string,
  wineSmell: string,
  wineTaste: string,
): Promise<{ colorScore: number; smellScore: number; tasteScore: number }> {
  const [colorScore, smellScore, tasteScore] = await Promise.all([
    userFarge && wineColor ? comprehensiveSimilarity(userFarge, wineColor) : Promise.resolve(0),
    userLukt && wineSmell ? comprehensiveSimilarity(userLukt, wineSmell) : Promise.resolve(0),
    userSmak && wineTaste ? comprehensiveSimilarity(userSmak, wineTaste) : Promise.resolve(0),
  ])

  return { colorScore, smellScore, tasteScore }
}
