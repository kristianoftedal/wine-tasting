import { describe, expect, it } from 'vitest'
import { hybridSoftScore } from './hybrid'
import { lexicalCredit } from '../flavourScoring'
import type { SoftResult } from './types'

const result = (engine: SoftResult['engine'], alignments: SoftResult['alignments'], baseline = 0): SoftResult =>
  ({ engine, model: 'test', raw: 0, baseline, softScore: 10, alignments, ms: 0 })

describe('hybridSoftScore', () => {
  const lexical = lexicalCredit('solbær vanilje plomme', 'Preg av solbær og fat.')

  it('gives a ladder-credited word full soft credit and keeps the engine value elsewhere', () => {
    // solbær: direct; vanilje: derived via fat; plomme: no credit
    const r = result('openai', [
      { word: 'solbær', best: 'solbær', sim: 1, weight: 1 },
      { word: 'vanilje', best: 'fat', sim: 0.09, weight: 1 },
      { word: 'plomme', best: 'solbær', sim: 0.25, weight: 1 },
    ])
    // openai: plomme's 0.25 × 160 / 100 = 0.4; credited words 1.0 → (1 + 1 + 0.4) / 3
    expect(hybridSoftScore(r, lexical)).toBeCloseTo(80, 5)
  })

  it('rescales a local engine word against its floor', () => {
    const r = result('bert', [
      { word: 'solbær', best: 'solbær', sim: 0.45, weight: 1 },
      { word: 'plomme', best: 'solbær', sim: 0.5, weight: 1 },
    ], 0.2)
    // solbær credited → 1; plomme (0.5 − 0.2) / 0.8 = 0.375 → mean 0.6875
    expect(hybridSoftScore(r, lexical)).toBeCloseTo(68.75, 5)
  })

  it('respects idf weights and falls back to the engine score with no alignments', () => {
    const r = result('bert', [
      { word: 'solbær', best: 'solbær', sim: 0.4, weight: 3 },
      { word: 'plomme', best: 'solbær', sim: 0.2, weight: 1 },
    ], 0.2)
    expect(hybridSoftScore(r, lexical)).toBeCloseTo(75, 5) // (3·1 + 1·0) / 4
    expect(hybridSoftScore(result('bert', []), lexical)).toBe(10)
  })
})
