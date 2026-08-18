import { describe, expect, it } from 'vitest'
import { DERIVATIONS, derivationSource, derivedFrom } from './derivations'
import { norwegianLemmas } from './lemmatizeAndWeight'

describe('DERIVATIONS', () => {
  it('every key and value resolves to a dictionary entry', () => {
    // A term absent from norwegianLemmas can never be produced by the
    // lemmatizer, so an edge referencing one is silently dead.
    const missing: string[] = []
    for (const [source, derived] of Object.entries(DERIVATIONS)) {
      if (!norwegianLemmas[source]) missing.push(`key: ${source}`)
      for (const d of derived) if (!norwegianLemmas[d]) missing.push(`${source} -> ${d}`)
    }
    expect(missing).toEqual([])
  })

  it('maps a derived term back to the reference term that licensed it', () => {
    // Edges are keyed on the dictionary lemma, which is what the scorer sees:
    // norwegianLemmas maps some surface forms onto a different lemma.
    for (const [source, derived] of Object.entries(DERIVATIONS)) {
      expect(norwegianLemmas[source].lemma, `${source} must be its own lemma`).toBe(source)
      for (const d of derived) {
        expect(norwegianLemmas[d].lemma, `${d} must be its own lemma`).toBe(d)
      }
    }
  })

  it('has no self-edges', () => {
    for (const [source, derived] of Object.entries(DERIVATIONS)) {
      expect(derived, `${source} implies itself`).not.toContain(source)
    }
  })
})

describe('derivedFrom', () => {
  it('licenses barrel-derived aromas from an oak reference', () => {
    // The case this map exists for: oak releases vanillin, so "vanilje" on a
    // barrel-aged wine is a correct call, not a wrong guess. The category
    // hierarchy cannot express it — fat is Treverk, vanilje is Krydder.
    const derived = derivedFrom(['fat'])
    expect(derived.has('vanilje')).toBe(true)
    expect(derived.has('kokos')).toBe(true)
    expect(derived.has('karamell')).toBe(true)

    expect(norwegianLemmas.fat.categoryPath?.main).toBe('Treverk')
    expect(norwegianLemmas.vanilje.categoryPath?.main).toBe('Krydder')
  })

  it('does not license unrelated descriptors', () => {
    const derived = derivedFrom(['fat', 'eik'])
    expect(derived.has('fersken')).toBe(false)
    expect(derived.has('sitrus')).toBe(false)
    expect(derived.has('solbær')).toBe(false)
  })

  it('returns an empty set for a reference with no derivations', () => {
    expect(derivedFrom(['solbær', 'kirsebær']).size).toBe(0)
  })

  it('ignores lemmas that are not derivation keys', () => {
    expect(derivedFrom(['ikkeetord']).size).toBe(0)
  })
})

describe('derivationSource', () => {
  it('names the reference term behind an inferred descriptor', () => {
    expect(derivationSource('vanilje', new Set(['fat', 'krydder']))).toBe('fat')
  })

  it('returns null when nothing in the reference licenses the term', () => {
    expect(derivationSource('vanilje', new Set(['solbær']))).toBeNull()
    expect(derivationSource('solbær', new Set(['fat']))).toBeNull()
  })
})
