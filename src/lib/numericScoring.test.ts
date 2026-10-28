import { describe, expect, it } from 'vitest';
import { ratioSimilarity, scaleSimilarity } from './numericScoring';

describe('scaleSimilarity — fixed 0–12 scales', () => {
  it('scores an exact match 100', () => {
    expect(scaleSimilarity(1, 1)).toBe(100);
    expect(scaleSimilarity(0, 0)).toBe(100);
  });

  it('costs the same for a one-step miss anywhere on the scale', () => {
    // The whole point of the change: sødme 1 vs 2 used to score 50 while
    // fylde 11 vs 12 scored 92 for an identical error.
    expect(scaleSimilarity(2, 1)).toBe(92);
    expect(scaleSimilarity(12, 11)).toBe(92);
    expect(scaleSimilarity(6, 7)).toBe(92);
  });

  it('is symmetric', () => {
    expect(scaleSimilarity(3, 8)).toBe(scaleSimilarity(8, 3));
  });

  it('scores a wine at 0 instead of skipping it', () => {
    expect(scaleSimilarity(1, 0)).toBe(92);
    expect(scaleSimilarity(0, 1)).toBe(92);
  });

  it('reaches 0 only at the full range', () => {
    expect(scaleSimilarity(0, 12)).toBe(0);
    expect(scaleSimilarity(1, 12)).toBe(8);
  });

  it('accepts numeric strings and decimals from the catalogue', () => {
    expect(scaleSimilarity('7', 7)).toBe(100);
    expect(scaleSimilarity(7, '7,5')).toBe(96);
  });

  it('returns 0 when either side is missing', () => {
    expect(scaleSimilarity(undefined, 5)).toBe(0);
    expect(scaleSimilarity(5, null)).toBe(0);
    expect(scaleSimilarity('-', 5)).toBe(0);
  });
});

describe('ratioSimilarity — open-ended quantities', () => {
  it('measures error relative to the value', () => {
    expect(ratioSimilarity(13.5, 13.5)).toBe(100);
    expect(ratioSimilarity('13,5 %', '14.5')).toBe(93);
    expect(ratioSimilarity(100, 200)).toBe(50);
  });

  it('returns 0 for missing or non-numeric input', () => {
    expect(ratioSimilarity('', 200)).toBe(0);
    expect(ratioSimilarity('abc', 200)).toBe(0);
  });
});
