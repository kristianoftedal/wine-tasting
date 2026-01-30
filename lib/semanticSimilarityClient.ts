"use client"

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

let embedder: FeatureExtractionPipeline | null = null;
let isLoading = false;
let loadPromise: Promise<FeatureExtractionPipeline> | null = null;

// Norwegian stopwords
const stopwords = new Set([
  'og', 'i', 'er', 'det', 'som', 'en', 'på', 'av', 'for', 'med', 'til', 
  'den', 'har', 'de', 'ikke', 'om', 'et', 'var', 'fra', 'vi', 'kan', 
  'men', 'så', 'han', 'hun', 'eller', 'hva', 'skal', 'selv', 'nå', 'når',
  'også', 'etter', 'over', 'ved', 'være', 'andre', 'alle', 'sin', 'seg',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'during',
]);

/**
 * Lazy load the embedder model (client-side only)
 */
async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;
  
  if (loadPromise) return loadPromise;
  
  if (isLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (embedder) {
          clearInterval(checkInterval);
          resolve(embedder);
        }
      }, 100);
    });
  }
  
  isLoading = true;
  loadPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<FeatureExtractionPipeline>;
  embedder = await loadPromise;
  isLoading = false;
  
  return embedder;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.hypot(...vecA);
  const magnitudeB = Math.hypot(...vecB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return embedder !== null;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading(): boolean {
  return isLoading;
}

/**
 * Preload the model (call early to reduce wait time later)
 */
export async function preloadModel(): Promise<void> {
  await getEmbedder();
}

/**
 * Compute semantic similarity (0–100) between two phrases using ML embeddings.
 * Runs entirely in the browser using @xenova/transformers.
 */
export async function semanticSimilarityClient(text1: string, text2: string): Promise<number> {
  if (!text1 || !text2) return 0;

  try {
    const embed = await getEmbedder();

    // Clean and filter stopwords, then join back into a single string
    const cleanText = (text: string) => 
      text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0 && !stopwords.has(word))
        .join(' ');

    const cleanedText1 = cleanText(text1);
    const cleanedText2 = cleanText(text2);

    if (!cleanedText1 || !cleanedText2) return 0;

    // Embed single strings to get consistent vector dimensions
    const [out1, out2] = await Promise.all([
      embed(cleanedText1, { pooling: 'mean', normalize: true }),
      embed(cleanedText2, { pooling: 'mean', normalize: true })
    ]);

    const emb1 = Array.from(out1.data) as number[];
    const emb2 = Array.from(out2.data) as number[];

    const similarity = cosineSimilarity(emb1, emb2);
    return Math.round(similarity * 100);
  } catch (error) {
    console.error('Semantic similarity error:', error);
    return 0;
  }
}
