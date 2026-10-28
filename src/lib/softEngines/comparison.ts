import type { SoftEngineId, TokenAlignment } from './types';

/**
 * Shape of src/app/scoring-demo/engine-comparison.generated.json, written by
 * scripts/export-engine-comparison.ts and rendered by the demo page.
 */
export type EngineFieldScore = { score: number; softScore: number; raw: number; alignments: TokenAlignment[] };

export type ComparisonField = {
  key: string; taster: string; event: string | null; wine: string; field: 'lukt' | 'smak';
  userNote: string; referenceNote: string; storedScore: number | null; previousScore: number | null;
  humanRating: number | null; scoreable: boolean;
  scores: Partial<Record<SoftEngineId, EngineFieldScore>>;
};

export type EngineSummary = {
  id: SoftEngineId; model: string; fields: number; mean: number; sd: number;
  spearmanVsStored: number; spearmanVsPrevious: number | null; spearmanVsHuman: number | null;
};

export type EngineComparison = {
  meta: { generatedAt: string; commit: string; frozenSet: string; raters: number; engines: EngineSummary[] };
  fields: ComparisonField[];
};
