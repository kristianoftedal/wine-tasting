import type { WeightProfile } from './types';

// Inverted profile: specific descriptors valued highly, generic terms low
// Rewards actual tasting skill - identifying specific aromas is harder than generic terms
export const INVERTED_PROFILE = {
  name: 'inverted',
  description: 'Specific descriptors valued highly (2.0-2.5), generic terms low (1.0)',
  weights: {
    'Frukt': 2.0,
    'Krydder': 2.2,
    'Urter': 2.0,
    'Blomster': 2.0,
    'Eik/fat': 2.5,
    'Mineral': 2.0,
    'GENERIC': 1.0
  }
} as const satisfies WeightProfile;

// Moderate profile: balanced differentiation between specific and generic
// Less aggressive than inverted, still rewards specific terms
export const MODERATE_PROFILE = {
  name: 'moderate',
  description: 'Moderate differentiation: specific (1.8-2.2), generic (1.2)',
  weights: {
    'Frukt': 1.8,
    'Krydder': 2.0,
    'Urter': 1.8,
    'Blomster': 1.8,
    'Eik/fat': 2.2,
    'Mineral': 1.8,
    'GENERIC': 1.2
  }
} as const satisfies WeightProfile;

// Data-driven profile: weights based on normalized database frequency
// Common terms = higher weight (reflects actual language usage patterns)
// Frequencies from Phase 1 analysis normalized to 0.8-2.5 range
export const DATA_DRIVEN_PROFILE = {
  name: 'data-driven',
  description: 'Weights based on normalized database frequency (common = high weight)',
  weights: {
    'Frukt': 2.2,      // Highest frequency in tasting notes (31752 occurrences)
    'Krydder': 1.4,    // Medium frequency (9465)
    'Urter': 1.0,      // Lower frequency (3200 est.)
    'Blomster': 0.9,   // Lower frequency (2100 est.)
    'Eik/fat': 1.1,    // Medium-low frequency (5800 est.)
    'Mineral': 1.0,    // Medium-low frequency (4500 est.)
    'GENERIC': 2.5     // Most common terms (aroma, duft, hint etc. ~52000)
  }
} as const satisfies WeightProfile;
