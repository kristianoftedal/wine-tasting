import type { MainCategory } from '../categories/types';

// Weight profile structure for category-level scoring
export interface WeightProfile {
  readonly name: string;
  readonly description: string;
  readonly weights: {
    readonly [K in MainCategory | 'GENERIC']: number;
  };
}

// Profile name union type for environment variable validation
export type ProfileName = 'inverted' | 'moderate' | 'data-driven';
