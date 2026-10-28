import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeText } from '../lemmatizeAndWeight'
import { normalizeWineSynonyms } from '../synonymNormalization'
import { applyNegation } from '../negation'
import { bertEngine } from './bert'
import { colbertTokenEngine, colbertWordEngine } from './colbert'
import { spanStats } from './words'
import type { NoteInput, SoftEngine } from './types'

/**
 * Runs only when the model files are present (scripts/fetch-soft-models.ts);
 * CI without models skips, which is deliberate — the models are not in git.
 */
const MODELS = existsSync('models/lebchen/norbert3-base-onnx/onnx/model_quantized.onnx') && existsSync('models/lightonai/mLateOn/model_int8.onnx')
const FROZEN = 'scripts/validation-results/frozen-set-2026-10.json'

const input = (t: string): NoteInput => {
  const n = applyNegation(t)
  return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }
}

describe.skipIf(!MODELS)('local soft engines', () => {
  const engines: SoftEngine[] = [bertEngine, colbertWordEngine, colbertTokenEngine]

  it('recover word spans from whole-text tokenisation on at least 99% of real notes', async () => {
    const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as { fields: Array<{ userNote: string; referenceNote: string }> }
    const notes = [...new Set(frozen.fields.flatMap(f => [f.userNote, f.referenceNote]))].slice(0, 200)
    for (const engine of [bertEngine, colbertWordEngine]) {
      spanStats.whole = 0; spanStats.fallback = 0
      for (const note of notes) await engine.score(input(note), input('Solbær og fat.'))
      const total = spanStats.whole + spanStats.fallback
      expect(total).toBeGreaterThan(100)
      expect(spanStats.whole / total, `${engine.id}: ${spanStats.fallback} fallbacks of ${total}`).toBeGreaterThanOrEqual(0.99)
    }
  }, 120_000)

  it.each(engines.map(e => [e.id, e] as const))('%s: extending the reference does not materially lower the raw value', async (_, engine) => {
    // Contextual vectors move a little when the sentence around them changes,
    // so strict monotonicity cannot hold as it does for isolated token
    // vectors. The benchmark's MISS column measures the effect on scores;
    // this guards against anything larger than context drift.
    const user = input('Solbær, kirsebær og litt fat')
    const base = await engine.score(user, input('Mørke bær og kirsebær.'))
    const extended = await engine.score(user, input('Mørke bær og kirsebær. Innslag av vanilje, fersken, lakris og mandel.'))
    expect(extended.raw).toBeGreaterThanOrEqual(base.raw - 0.05)
  }, 60_000)

  it.each(engines.map(e => [e.id, e] as const))('%s: a matching word scores above an unrelated one', async (_, engine) => {
    const same = await engine.score(input('solbær'), input('Preg av solbær og bjørnebær.'))
    const other = await engine.score(input('solbær'), input('Lys gul. Sitron og grønt eple.'))
    expect(same.raw).toBeGreaterThan(other.raw)
    expect(same.alignments[0].best).toBe('solbær')
  }, 60_000)

  it.each(engines.map(e => [e.id, e] as const))('%s: returns one alignment per content word with a 0–100 soft score', async (_, engine) => {
    const r = await engine.score(input('Rødt eple, sitrus og mineralsk. Frisk.'), input('Preg av gule epler, sitrus og flint.'))
    expect(r.alignments.map(a => a.word).sort()).toEqual(['eple', 'mineral', 'sitrus'])
    expect(r.softScore).toBeGreaterThanOrEqual(0)
    expect(r.softScore).toBeLessThanOrEqual(100)
  }, 60_000)
})
