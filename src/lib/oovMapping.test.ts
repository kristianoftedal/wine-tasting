import { describe, expect, it, vi } from 'vitest'

// Deterministic "embeddings": a few hand-made directions so the mapping logic
// can be tested without the API. Unknown words point at the lemma they should
// map to, with a cosine we control via the vector angle.
const DIRS: Record<string, [number, number]> = {
  bakverk: [1, 0], toast: [0, 1], brioche: [0.6, 0.8],
  brioch: [0.98, 0.2],   // close to bakverk-ish? no: closest is brioche/bakverk region
  toasty: [0.05, 1],     // close to toast
  gult: [-1, 0],         // nowhere near anything
}
vi.mock('@/lib/tokenEmbeddings', () => ({
  embedTokens: vi.fn(async (tokens: string[]) => {
    const m = new Map<string, Float32Array>()
    for (const t of tokens) if (DIRS[t]) m.set(t, Float32Array.from(DIRS[t]))
    return m
  }),
}))

const { isUnknownWord, mapUnknownWords, AROMA_CANDIDATES } = await import('./oovMapping')

describe('oovMapping', () => {
  it('knows dictionary words and short tokens are not unknown', () => {
    expect(isUnknownWord('solbær')).toBe(false)
    expect(isUnknownWord('og')).toBe(false)
    expect(isUnknownWord('toasty')).toBe(true)
  })

  it('only offers aroma lemmas as targets', () => {
    const lemmas = new Set(AROMA_CANDIDATES.map(c => c.lemma))
    expect(lemmas.has('bakverk')).toBe(true)
    expect(lemmas.has('syre')).toBe(false)
    expect(lemmas.has('tannin')).toBe(false)
  })

  it('maps an unknown word to its nearest aroma lemma above the threshold', async () => {
    const r = await mapUnknownWords('solbær toasty', 0.9)
    expect(r.mapped).toEqual([{ from: 'toasty', to: 'toast', sim: expect.closeTo(0.9988, 3) }])
    expect(r.text).toBe('solbær toast')
  })

  it('leaves a word alone below the threshold or without a vector', async () => {
    const r = await mapUnknownWords('gult toasty fortynna', 0.9)
    expect(r.mapped.map(m => m.from)).toEqual(['toasty'])
    expect(r.text).toBe('gult toast fortynna')
  })

  it('is a no-op when nothing is unknown', async () => {
    expect(await mapUnknownWords('solbær og fat')).toEqual({ text: 'solbær og fat', mapped: [] })
  })
})
