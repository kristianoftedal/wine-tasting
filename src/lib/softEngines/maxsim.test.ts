import { describe, expect, it } from 'vitest'
import { contentWords, idfWeight, maxSimPrecision } from './maxsim'
import { groupTokensIntoWords } from './words'
import { bucketFor, rescale } from './baseline'

const v = (...xs: number[]) => Float32Array.from(xs)

describe('maxSimPrecision', () => {
  const user = [{ word: 'a', vec: v(1, 0) }, { word: 'b', vec: v(0, 1) }]
  const reference = [{ word: 'x', vec: v(1, 0) }]

  it('is directional: extending the reference never lowers the result', () => {
    const base = maxSimPrecision(user, reference).raw
    const extended = maxSimPrecision(user, [...reference, { word: 'y', vec: v(0.7, 0.7) }]).raw
    expect(extended).toBeGreaterThanOrEqual(base)
  })

  it('weights words by the supplied function', () => {
    const plain = maxSimPrecision(user, reference).raw
    const weighted = maxSimPrecision(user, reference, w => (w === 'a' ? 3 : 1)).raw
    expect(plain).toBeCloseTo(0.5, 6) // (1 + 0) / 2
    expect(weighted).toBeCloseTo(0.75, 6) // (3·1 + 1·0) / 4
  })

  it('reports the best reference word per user word', () => {
    const { alignments } = maxSimPrecision(user, [...reference, { word: 'y', vec: v(0, 1) }])
    expect(alignments.map(a => [a.word, a.best])).toEqual([['a', 'x'], ['b', 'y']])
  })

  it('returns 0 with nothing to compare', () => {
    expect(maxSimPrecision([], reference).raw).toBe(0)
    expect(maxSimPrecision(user, []).raw).toBe(0)
  })
})

describe('contentWords / idfWeight', () => {
  it('drops generic terms and duplicates, keeps order', () => {
    expect(contentWords('solbær frisk solbær fat balansert')).toEqual(['solbær', 'fat'])
  })
  it('looks idf up by lemma and defaults to 1', () => {
    expect(idfWeight('svovel')).toBeGreaterThan(1)
    expect(idfWeight('xyzzy')).toBe(1)
  })
})

describe('groupTokensIntoWords', () => {
  it('groups byte-level BPE tokens by the Ġ marker', () => {
    expect(groupTokensIntoWords(['sit', 'rus', 'Ġfrisk', 'Ġfat', 'lag', 'ret'], 3)).toEqual([[0, 1], [2], [3, 4, 5]])
  })
  it('groups sentencepiece tokens and drops the prefix group', () => {
    expect(groupTokensIntoWords(['[Q]▁', '▁sit', 'rus', '▁frisk'], 2, 1)).toEqual([[1, 2], [3]])
  })
  it('returns null when the count does not match', () => {
    expect(groupTokensIntoWords(['sit', 'rus', 'Ġfrisk'], 3)).toBeNull()
  })
})

describe('baseline rescale', () => {
  it('buckets reference lengths', () => {
    expect([1, 3, 4, 6, 7, 10, 11, 40].map(bucketFor)).toEqual(['1-3', '1-3', '4-6', '4-6', '7-10', '7-10', '11+', '11+'])
  })
  it('maps the floor to 0 and a perfect match to 100', () => {
    expect(rescale(0.4, 0.4)).toBe(0)
    expect(rescale(1, 0.4)).toBe(100)
    expect(rescale(0.7, 0.4)).toBeCloseTo(50, 6)
    expect(rescale(0.2, 0.4)).toBe(0)
  })
})
