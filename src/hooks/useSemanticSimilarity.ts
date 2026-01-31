'use client';

import { isModelLoaded, isModelLoading, preloadModel, semanticSimilarityClient } from '@/lib/semanticSimilarityClient';
import { useCallback, useEffect, useState } from 'react';

interface UseSemanticSimilarityReturn {
  /** Calculate similarity between two texts (0-100) */
  calculateSimilarity: (text1: string, text2: string) => Promise<number>;
  /** Whether the ML model is loaded and ready */
  isReady: boolean;
  /** Whether the ML model is currently loading */
  isLoading: boolean;
  /** Any error that occurred during loading */
  error: Error | null;
}

/**
 * Hook for client-side semantic similarity using ML embeddings.
 * Automatically preloads the model when the component mounts.
 */
export function useSemanticSimilarity(): UseSemanticSimilarityReturn {
  const [isReady, setIsReady] = useState(isModelLoaded());
  const [isLoading, setIsLoading] = useState(isModelLoading());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isModelLoaded()) {
      setIsReady(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    preloadModel()
      .then(() => {
        setIsReady(true);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err);
        setIsLoading(false);
      });
  }, []);

  const calculateSimilarity = useCallback(async (text1: string, text2: string): Promise<number> => {
    return semanticSimilarityClient(text1, text2);
  }, []);

  return {
    calculateSimilarity,
    isReady,
    isLoading,
    error
  };
}
