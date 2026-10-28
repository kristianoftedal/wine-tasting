import { describe, expect, it } from 'vitest'
import { applyNegation } from './negation'

describe('applyNegation', () => {
  it('drops the descriptor after a bare negator', () => {
    expect(applyNegation('uten fat')).toEqual({ text: '', negated: ['fat'] })
  })

  it('skips fillers between the negator and the descriptor', () => {
    expect(applyNegation('ikke noe fat').negated).toEqual(['fat'])
    expect(applyNegation('ingen tydelig frukt').negated).toEqual(['frukt'])
    expect(applyNegation('ikke så mye eik her')).toEqual({ text: 'her', negated: ['eik'] })
  })

  it('keeps the rest of the note intact', () => {
    const r = applyNegation('Mørke bær og kirsebær, ikke noe fat. Lang avslutning.')
    expect(r.negated).toEqual(['fat'])
    expect(r.text).toBe('Mørke bær og kirsebær, Lang avslutning.')
  })

  it('treats "ikke bare X" as affirmation', () => {
    const r = applyNegation('ikke bare bær men også krydder')
    expect(r.negated).toEqual([])
    expect(r.text).toBe('ikke bare bær men også krydder')
  })

  it('stops at a clause boundary', () => {
    expect(applyNegation('ikke og krydder').negated).toEqual([])
    expect(applyNegation('ikke. Krydder og fat.').negated).toEqual([])
    expect(applyNegation('ikke noe, bare bær').negated).toEqual([])
  })

  it('never treats a negator as the negated word', () => {
    // A real note: "Vet ikke" ("don't know"), then the benchmark appends "ikke sitrus".
    // The clause-final "ikke" stays (it is a stopword); only the pair is dropped.
    expect(applyNegation('Vet ikke ikke sitrus')).toEqual({ text: 'Vet ikke', negated: ['sitrus'] })
    expect(applyNegation('Vet ikke, ikke sitrus').negated).toEqual(['sitrus'])
  })

  it('handles several negations', () => {
    const r = applyNegation('ikke fat, ingen vanilje, men mye solbær')
    expect(r.negated).toEqual(['fat', 'vanilje'])
    expect(r.text).toBe('men mye solbær')
  })

  it('is a no-op without a negator', () => {
    const note = 'Solbær, plomme og lite fat.'
    expect(applyNegation(note)).toEqual({ text: note, negated: [] })
  })

  it('tolerates empty input', () => {
    expect(applyNegation('')).toEqual({ text: '', negated: [] })
    expect(applyNegation('   ')).toEqual({ text: '   ', negated: [] })
  })
})
