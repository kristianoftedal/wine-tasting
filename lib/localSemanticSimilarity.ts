import { lemmatizeAndWeight, stopwords } from "./lemmatizeAndWeight"

/**
 * Calculate how many words from text1 are found in text2 (directional match)
 * This handles cases like user input "sitrus eple fersken" matching wine description
 */
function calculateDirectionalMatch(
  shortText: string,
  longText: string
): number {
  const cleanText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopwords.has(word))

  const shortWords = cleanText(shortText)
  const longWords = new Set(cleanText(longText))

  if (shortWords.length === 0) return 0

  let matchCount = 0
  for (const word of shortWords) {
    if (longWords.has(word)) {
      matchCount++
    }
  }

  // Return percentage of short text words found in long text
  return matchCount / shortWords.length
}

/**
 * Calculate weighted lemma match - how many lemmas from text1 match text2
 */
function calculateWeightedLemmaMatch(text1: string, text2: string): number {
  const data1 = lemmatizeAndWeight(text1)
  const data2 = lemmatizeAndWeight(text2)

  // Create lemma sets with weights
  const lemmas1 = new Map<string, number>()
  const lemmas2 = new Set<string>()

  data1.lemmatized.forEach((item) => {
    lemmas1.set(item.lemma, (lemmas1.get(item.lemma) || 0) + item.weight)
  })

  data2.lemmatized.forEach((item) => {
    lemmas2.add(item.lemma)
  })

  if (lemmas1.size === 0) return 0

  let matchedWeight = 0
  let totalWeight = 0

  lemmas1.forEach((weight, lemma) => {
    totalWeight += weight
    if (lemmas2.has(lemma)) {
      matchedWeight += weight
    }
  })

  return totalWeight > 0 ? matchedWeight / totalWeight : 0
}

/**
 * Calculate bidirectional overlap (traditional Jaccard-like)
 */
function calculateBidirectionalOverlap(text1: string, text2: string): number {
  const data1 = lemmatizeAndWeight(text1)
  const data2 = lemmatizeAndWeight(text2)

  const lemmas1 = new Set(data1.lemmatized.map((item) => item.lemma))
  const lemmas2 = new Set(data2.lemmatized.map((item) => item.lemma))

  if (lemmas1.size === 0 || lemmas2.size === 0) return 0

  const intersection = [...lemmas1].filter((lemma) => lemmas2.has(lemma)).length
  const minSize = Math.min(lemmas1.size, lemmas2.size)

  // Overlap coefficient - good for when one text is subset of another
  return intersection / minSize
}

/**
 * Local semantic similarity using weighted lemma matching.
 * Optimized for comparing user wine tasting notes against expert descriptions.
 * 
 * Example:
 * text1: "sitrus eple fersken aprikos nøtt"
 * text2: "Modent og ungdommelig preg av eple, sitrus, aprikos og fersken, litt fat, fløte, nøtt og blomst."
 * 
 * Returns a score from 0-100.
 */
export async function localSemanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0

  try {
    // Determine which text is shorter (likely user input)
    const [shortText, longText] = text1.length <= text2.length 
      ? [text1, text2] 
      : [text2, text1]

    // Calculate directional match: how many words from short text are in long text
    const directionalScore = calculateDirectionalMatch(shortText, longText)

    // Calculate weighted lemma match using Norwegian wine vocabulary
    const lemmaScore = calculateWeightedLemmaMatch(shortText, longText)

    // Calculate bidirectional overlap
    const overlapScore = calculateBidirectionalOverlap(text1, text2)

    // Combine scores:
    // - 50% weighted lemma match (uses wine vocabulary weights)
    // - 30% directional match (user words found in expert description)
    // - 20% bidirectional overlap
    const combined = lemmaScore * 0.5 + directionalScore * 0.3 + overlapScore * 0.2

    return Math.round(combined * 100)
  } catch (error) {
    console.error("Local semantic similarity error:", error)
    return 0
  }
}
