import { describe, expect, it } from 'vitest'
import { colourSimilarity, parseColour } from './colourScoring'

describe('colourScoring', () => {
  it('parses depth and hue, including compounds and separators', () => {
    expect(parseColour('Dyp rubinrød.')).toMatchObject({ hue: 6, depth: 2 })
    expect(parseColour('lys strågul, grønnskjær')).toMatchObject({ hue: 2, depth: 0 })
    expect(parseColour('mørkerød')).toMatchObject({ hue: 6.1 })
    expect(parseColour('dyp rød/lilla').hue).toBeCloseTo(6.5, 5)
    expect(parseColour('strågul').depth).toBeNull()
  })

  it('scores the same colour at 100 and a yellow against a red at 0', () => {
    expect(colourSimilarity('Dyp rubinrød', 'Dyp rubinrød.')).toBe(100)
    expect(colourSimilarity('lys strågul', 'Dyp rød.')).toBe(0)
  })

  it('treats a depth step and an adjacent hue as near, and a distant hue as far', () => {
    const depthStep = colourSimilarity('lys rubinrød', 'Dyp rubinrød.')!
    const hueStep = colourSimilarity('dyp blårød', 'Dyp rubinrød.')!
    const farHue = colourSimilarity('lakserosa', 'Dyp rubinrød.')!
    for (const near of [depthStep, hueStep]) { expect(near).toBeGreaterThanOrEqual(70); expect(near).toBeLessThan(100) }
    expect(farHue).toBeLessThan(Math.min(depthStep, hueStep))
    expect(farHue).toBeGreaterThan(0)
  })

  it('does not punish a missing depth word', () => {
    expect(colourSimilarity('strågul', 'Lys strågul.')).toBe(100)
  })

  it('rewards an agreeing tint a little and a disagreeing one a little less', () => {
    const agree = colourSimilarity('lys gul med grønnskjær', 'Lys gul, grønnskjær.')!
    const plain = colourSimilarity('lys gul', 'Lys gul, grønnskjær.')!
    const disagree = colourSimilarity('lys gul med brunskjær', 'Lys gul, grønnskjær.')!
    expect(agree).toBeGreaterThanOrEqual(plain)
    expect(disagree).toBeLessThan(plain)
  })

  it('returns null with no hue on either side and 0 for nonsense against a colour', () => {
    expect(colourSimilarity('', 'Dyp rød.')).toBe(0)
    expect(colourSimilarity('klar', 'intens')).toBeNull()
    expect(colourSimilarity('uringul', 'Lys gul.')).toBe(0)
  })
})
