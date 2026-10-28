import { describe, expect, it } from 'vitest'
import { displayableSkill, formatSkill } from './tasterSkill'

describe('tasterSkill', () => {
  it('shows nothing under ten tastings', () => {
    expect(displayableSkill([{ scorer_version: 'a', tastings: 9, fields: 18, raw_residual: 5, skill: 4 }])).toBeNull()
    expect(displayableSkill([])).toBeNull()
    expect(displayableSkill(null)).toBeNull()
  })
  it('picks the version with the most tastings once eligible', () => {
    const rows = [
      { scorer_version: 'old', tastings: 12, fields: 24, raw_residual: 2, skill: 1.7 },
      { scorer_version: 'new', tastings: 30, fields: 60, raw_residual: -1, skill: -0.9 },
    ]
    expect(displayableSkill(rows)?.scorer_version).toBe('new')
  })
  it('formats with a sign and one decimal', () => {
    expect(formatSkill(4.26)).toBe('+4.3')
    expect(formatSkill(-0.04)).toBe('0.0')
    expect(formatSkill(0)).toBe('0.0')
  })
})
