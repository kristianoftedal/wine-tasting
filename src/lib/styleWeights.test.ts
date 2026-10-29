import { describe, expect, it } from 'vitest'
import { normalizeCategory, styleMultiplier, hasStyleTable } from './styleWeights'
import { lemmasWithWeight, lexicalCredit } from './flavourScoring'
import STYLE_TABLE from './style-idf.generated.json'

describe('styleWeights', () => {
  it('normalises the catalogue category spellings', () => {
    expect(normalizeCategory('Hvitvin')).toBe('Hvitvin')
    expect(normalizeCategory('"Rødvin"')).toBe('Rødvin')
    expect(normalizeCategory('musserende')).toBe('Musserende vin')
    expect(normalizeCategory(null)).toBeNull()
    expect(normalizeCategory('Portvin')).toBeNull()
  })

  it('has tables for the four large categories', () => {
    for (const c of ['Rødvin', 'Hvitvin', 'Musserende vin', 'Rosévin']) expect(hasStyleTable(c)).toBe(true)
  })

  it('discounts the default descriptor of a style and keeps the cap', () => {
    const sitrusWhite = styleMultiplier('sitrus', 'Hvitvin', 0.2)
    const sitrusRed = styleMultiplier('sitrus', 'Rødvin', 0.2)
    expect(sitrusWhite).toBeLessThan(1)
    expect(sitrusRed!).toBeGreaterThan(sitrusWhite!)
    expect(styleMultiplier('sitrus', 'Hvitvin', 0.5)).toBe(0.5)
    // any lemma rarer than the median in whites has a ratio above 1, and the cap bites
    const rare = Object.entries(STYLE_TABLE.categories.Hvitvin.ratio).find(([, r]) => r > 1.2)![0]
    expect(styleMultiplier(rare, 'Hvitvin', 0.5, 2.0)!).toBeGreaterThan(1)
    expect(styleMultiplier(rare, 'Hvitvin', 0.5, 0.9)).toBe(0.9)
  })

  it('returns null without a category or for an unmeasured lemma', () => {
    expect(styleMultiplier('sitrus', null)).toBeNull()
    expect(styleMultiplier('xyzzy', 'Hvitvin')).toBeNull()
  })

  it('changes lemma weights only when asked and only with a category', () => {
    const off = lemmasWithWeight('sitrus eple solbær', { styleWeights: false, category: 'Hvitvin' })
    const noCat = lemmasWithWeight('sitrus eple solbær', { styleWeights: true, category: null })
    const on = lemmasWithWeight('sitrus eple solbær', { styleWeights: true, category: 'Hvitvin', styleFloor: 0.5 })
    expect(noCat.get('sitrus')!.weight).toBe(off.get('sitrus')!.weight)
    expect(on.get('sitrus')!.weight).toBeLessThan(off.get('sitrus')!.weight)
    expect(on.get('solbær')!.weight).toBeGreaterThan(on.get('sitrus')!.weight)
  })

  it('lowers the score of an all-default note on its style but not its precision', () => {
    const ref = 'Preg av sitrus, epler og mineraler.'
    const off = lexicalCredit('sitrus eple mineral', ref, { styleWeights: false, category: 'Hvitvin' })
    const on = lexicalCredit('sitrus eple mineral', ref, { styleWeights: true, category: 'Hvitvin', styleFloor: 0.5 })
    expect(on.hitScore).toBeLessThan(off.hitScore)
    expect(on.precision).toBeCloseTo(1, 6)
    expect(off.precision).toBeCloseTo(1, 6)
  })
})
