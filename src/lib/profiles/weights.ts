import type { WeightProfile } from './types';

export const INVERTED_PROFILE = {
  name: 'inverted',
  description: 'Specific descriptors valued highly (2.0), generic terms low (1.3)',
  weights: {
    'Frukt og bær': 2.0,
    Krydder: 2.0,
    Urter: 2.0,
    Blomst: 2.0,
    Treverk: 2.0,
    Karamellisert: 2.0,
    Nøtter: 2.0,
    Jordaktig: 2.0,
    Animalsk: 1.8,
    Grønnsaker: 1.5,
    GENERIC: 1.3,
  },
} as const satisfies WeightProfile;

export const MODERATE_PROFILE = {
  name: 'moderate',
  description: 'Moderate differentiation: specific (1.8-2.0), generic (1.2)',
  weights: {
    'Frukt og bær': 1.8,
    Krydder: 2.0,
    Urter: 1.8,
    Blomst: 1.8,
    Treverk: 2.0,
    Karamellisert: 1.8,
    Nøtter: 1.8,
    Jordaktig: 1.8,
    Animalsk: 1.6,
    Grønnsaker: 1.3,
    GENERIC: 1.2,
  },
} as const satisfies WeightProfile;
