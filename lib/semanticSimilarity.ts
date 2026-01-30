import { stopwords } from './lemmatizeAndWeight';

/**
 * Compute text similarity (0–100) between two phrases using Jaccard similarity
 * with word overlap. This is a serverless-compatible alternative to ML embeddings.
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    // Clean and filter stopwords
    const cleanText = (text: string) => 
      text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopwords.has(word));

    const words1 = new Set(cleanText(text1));
    const words2 = new Set(cleanText(text2));

    if (words1.size === 0 || words2.size === 0) return 0;

    // Calculate Jaccard similarity: intersection / union
    const intersection = [...words1].filter(word => words2.has(word)).length;
    const union = new Set([...words1, ...words2]).size;

    if (union === 0) return 0;

    // Jaccard gives 0-1, scale to 0-100
    const jaccard = intersection / union;
    
    // Also calculate overlap coefficient for better partial matching
    // Overlap = intersection / min(|A|, |B|)
    const minSize = Math.min(words1.size, words2.size);
    const overlap = intersection / minSize;
    
    // Weighted combination: 60% overlap (better for partial matches) + 40% Jaccard
    const combined = overlap * 0.6 + jaccard * 0.4;
    
    return Math.round(combined * 100);
  } catch (error) {
    console.error('Semantic similarity error:', error);
    return 0;
  }
}
