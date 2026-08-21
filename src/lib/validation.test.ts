import { describe, expect, it } from 'vitest';
import { WINE_SEARCH_MIN_QUERY_LENGTH } from './constants';
import { foldSearchQuery, isValidSearchQuery, sanitizeSearchQuery, searchQueryKey } from './validation';

describe('foldSearchQuery', () => {
  it('folds the accents that actually occur in the wine catalogue', () => {
    expect(foldSearchQuery('André Clouet')).toBe('andre clouet');
    expect(foldSearchQuery('Étienne Calsac')).toBe('etienne calsac');
    expect(foldSearchQuery('Ten. Scerscé')).toBe('ten scersce');
    expect(foldSearchQuery('Côtes de Gascogne')).toBe('cotes de gascogne');
    expect(foldSearchQuery('Müller-Thurgau')).toBe('muller thurgau');
    expect(foldSearchQuery('Château')).toBe('chateau');
  });

  it('folds Norwegian characters, including the ae ligature expansion', () => {
    expect(foldSearchQuery('Gamle Tårnhuset')).toBe('gamle tarnhuset');
    expect(foldSearchQuery('Rødvin')).toBe('rodvin');
    expect(foldSearchQuery('æøå')).toBe('aeoa');
  });

  it('is idempotent, so folding client-side and again in SQL is harmless', () => {
    const once = foldSearchQuery('André Clouet Rosé');
    expect(foldSearchQuery(once)).toBe(once);
  });

  it('collapses punctuation and whitespace to single spaces', () => {
    expect(foldSearchQuery('  Chante-Alouette   2021 ')).toBe('chante alouette 2021');
    expect(foldSearchQuery('Dom. Castell-Reynoard')).toBe('dom castell reynoard');
  });

  it('maps the accented and unaccented spelling to one cache key', () => {
    expect(searchQueryKey('André Clouet')).toBe(searchQueryKey('andre clouet'));
  });
});

describe('isValidSearchQuery', () => {
  it(`requires ${WINE_SEARCH_MIN_QUERY_LENGTH} characters, because pg_trgm cannot index shorter`, () => {
    expect(isValidSearchQuery('an')).toBe(false);
    expect(isValidSearchQuery('and')).toBe(true);
  });

  it('counts folded characters, not raw ones', () => {
    // "Rø" folds to "ro" — two characters, still too short.
    expect(isValidSearchQuery('Rø')).toBe(false);
    // Punctuation and spaces do not count toward the minimum.
    expect(isValidSearchQuery('a-b')).toBe(false);
    expect(isValidSearchQuery('a b c')).toBe(true);
  });

  it('accepts a product id', () => {
    expect(isValidSearchQuery('10902101')).toBe(true);
  });
});

describe('sanitizeSearchQuery', () => {
  it('trims and caps the length a single keystroke can cost the database', () => {
    expect(sanitizeSearchQuery('  barolo  ')).toBe('barolo');
    expect(sanitizeSearchQuery('x'.repeat(500))).toHaveLength(200);
  });
});
