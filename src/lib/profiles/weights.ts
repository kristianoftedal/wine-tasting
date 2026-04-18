import type { WeightProfile } from './types';

// Inverted profile: specific descriptors valued highly, generic terms low
// Rewards actual tasting skill - identifying specific aromas is harder than generic terms
export const INVERTED_PROFILE = {
  name: 'inverted',
  description: 'Specific descriptors valued highly (2.0-2.5), generic terms low (1.0)',
  weights: {
    Frukt: 2.0,
    Krydder: 2.0,
    Urter: 2.0,
    Blomster: 2.0,
    'Eik/fat': 2.0,
    Mineral: 2.0,
    GENERIC: 1.0
  }
} as const satisfies WeightProfile;

// Moderate profile: balanced differentiation between specific and generic
// Less aggressive than inverted, still rewards specific terms
export const MODERATE_PROFILE = {
  name: 'moderate',
  description: 'Moderate differentiation: specific (1.8-2.2), generic (1.2)',
  weights: {
    Frukt: 1.8,
    Krydder: 2.0,
    Urter: 1.8,
    Blomster: 1.8,
    'Eik/fat': 2.2,
    Mineral: 1.8,
    GENERIC: 1.2
  }
} as const satisfies WeightProfile;
