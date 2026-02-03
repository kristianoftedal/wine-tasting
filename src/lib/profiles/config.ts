import type { ProfileName, WeightProfile } from './types';
import { INVERTED_PROFILE, MODERATE_PROFILE, DATA_DRIVEN_PROFILE } from './weights';
import type { MainCategory } from '../categories/types';

// Profile registry mapping names to profile objects
const PROFILES: Record<ProfileName, WeightProfile> = {
  'inverted': INVERTED_PROFILE,
  'moderate': MODERATE_PROFILE,
  'data-driven': DATA_DRIVEN_PROFILE
};

/**
 * Get the currently active weight profile based on environment variable.
 * Reads NEXT_PUBLIC_WEIGHT_PROFILE, falls back to 'inverted' if invalid or missing.
 */
export function getActiveProfile(): WeightProfile {
  const profileName = process.env.NEXT_PUBLIC_WEIGHT_PROFILE as ProfileName | undefined;

  // Default to inverted if not set
  if (!profileName) {
    return PROFILES['inverted'];
  }

  // Validate profile exists
  const profile = PROFILES[profileName];

  if (!profile) {
    console.warn(`Invalid NEXT_PUBLIC_WEIGHT_PROFILE: "${profileName}". Using "inverted".`);
    return PROFILES['inverted'];
  }

  return profile;
}

/**
 * Get the weight for a specific category from the active profile.
 * This is the primary function used by lemmatization for scoring.
 */
export function getCategoryWeight(category: MainCategory | 'GENERIC'): number {
  return getActiveProfile().weights[category];
}
