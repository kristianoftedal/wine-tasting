import { describe, expect, it, vi } from 'vitest'

// Token embeddings are the only network dependency in the flavour scorer. Stub
// them out so these tests exercise the scoring *shape* — the invariants the
// objective demands — without an API key or network access. The soft term is
// held at zero, so what is asserted here is the lexical half of the score.
vi.mock('@/lib/semanticSimilarity', () => ({
  tokenPrecisionSimilarity: vi.fn().mockResolvedValue(0),
  rawSemanticSimilarity: vi.fn().mockResolvedValue(0),
}))

const { scoreFlavourNote } = await import('./similarity')

const WINE = 'Saftig, litt pepret og krydret, preg av moden kirsebær, krekling og bringebær, litt fat og urt.'

describe('scoreFlavourNote — objective invariants', () => {
  it('does not punish the taster for descriptors they omitted', async () => {
    // The defining constraint: lengthening the *reference* note with things the
    // taster never mentioned must not move their score. Anything that puts the
    // reference on the denominator fails this.
    const user = 'kirsebær og krydder'
    const base = await scoreFlavourNote(user, WINE)
    const extended = await scoreFlavourNote(user, `${WINE} Innslag av vanilje, fersken, lakris og mandel.`)

    expect(extended.score).toBeGreaterThanOrEqual(base.score)
  })

  it('rewards naming an additional correct descriptor', async () => {
    const fewer = await scoreFlavourNote('kirsebær', WINE)
    const more = await scoreFlavourNote('kirsebær krydder', WINE)

    expect(more.score).toBeGreaterThan(fewer.score)
    expect(more.hitMass).toBeGreaterThan(fewer.hitMass)
  })

  it('does not reward padding a note with descriptors the wine lacks', async () => {
    // Previously this *raised* the score: the denominator was pinned to the
    // wine's mass, so extra guesses were free while category near-misses paid
    // out. Padding must now cost.
    const honest = await scoreFlavourNote('kirsebær krydder', WINE)
    const padded = await scoreFlavourNote('kirsebær krydder fersken lakris mandel banan grapefrukt', WINE)

    expect(padded.score).toBeLessThanOrEqual(honest.score)
    expect(padded.precision).toBeLessThan(honest.precision)
  })

  it('scores a short accurate note above a long vague one', async () => {
    const accurate = await scoreFlavourNote('kirsebær bringebær krydder', WINE)
    const vague = await scoreFlavourNote('god balansert elegant lang fin behagelig rund', WINE)

    expect(accurate.score).toBeGreaterThan(vague.score)
  })

  it('credits an oenologically valid inference as a hit', async () => {
    // "vanilje" on a wine the reference calls "fat": correct perception of
    // barrel vanillin. Scored as a wrong guess before the derivation map.
    const { matches, score } = await scoreFlavourNote('vanilje', 'Preg av fat og mørke bær.')
    const vanilje = matches.find(m => m.lemma === 'vanilje')

    expect(vanilje?.kind).toBe('derived')
    expect(vanilje?.via).toBe('fat')
    expect(score).toBeGreaterThan(0)
  })

  it('credits a more precise answer than the reference gave', async () => {
    // Vinmonopolet often declines to be specific ("Saftig mørk frukt"). A taster
    // answering "solbær" named a dark fruit — correct, and more precise than the
    // reference. The hierarchy alone rates it a near-miss because `frukt` is
    // filed under Frukt og bær/annet and `solbær` under Frukt og bær/baer.
    const { matches } = await scoreFlavourNote('solbær', 'Saftig mørk frukt og lett krydret.')
    const solbær = matches.find(m => m.lemma === 'solbær')

    expect(solbær?.kind).toBe('specific')
    expect(solbær?.via).toBe('frukt')
  })

  it('does not credit a vaguer answer as though it were precise', async () => {
    // The reverse direction: reference names the specific berry, taster says
    // "frukt". That is correct but less informative, and keeps ordinary credit.
    const { matches } = await scoreFlavourNote('frukt', 'Preg av solbær og bjørnebær.')
    const frukt = matches.find(m => m.lemma === 'frukt')

    expect(frukt?.kind).not.toBe('specific')
    expect(frukt?.kind).not.toBe('direct')
  })

  it('ranks a direct hit at or above a taxonomic near-miss', async () => {
    const direct = await scoreFlavourNote('kirsebær', WINE)
    const nearMiss = await scoreFlavourNote('jordbær', WINE) // same Frukt og bær/baer path

    expect(direct.score).toBeGreaterThan(nearMiss.score)
    expect(direct.matches[0].kind).toBe('direct')
    expect(nearMiss.matches[0].kind).toBe('subcategory')
  })

  it('never uses the reference note as a denominator', async () => {
    const { userMass } = await scoreFlavourNote('kirsebær krydder', WINE)
    const { userMass: sameUserLongerWine } = await scoreFlavourNote('kirsebær krydder', `${WINE} ${WINE}`)

    expect(sameUserLongerWine).toBe(userMass)
  })

  it('returns a zeroed breakdown for empty input', async () => {
    expect((await scoreFlavourNote('', WINE)).score).toBe(0)
    expect((await scoreFlavourNote('kirsebær', '')).score).toBe(0)
  })

  it('keeps the score within 0-100', async () => {
    const notes = ['kirsebær', 'kirsebær bringebær krydder urt fat pepper moden', 'xyzzy', WINE]
    for (const note of notes) {
      const { score } = await scoreFlavourNote(note, WINE)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})
