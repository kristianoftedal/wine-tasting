import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeText, norwegianLemmas } from './lemmatizeAndWeight'
import { normalizeWineSynonyms } from './synonymNormalization'
import { applyNegation } from './negation'
import { combineScoreScaled, hasScoreableFlavour, lemmasWithWeight, lexicalCredit } from './flavourScoring'
import { derivedFrom } from './derivations'
import { mean, pearson } from './stats'

/**
 * The scoring objective as a test, on real notes, offline.
 *
 * scripts/benchmark-scoring.ts measures the same properties with a soft
 * engine and 100 random wines; it needs a database and an API key. This runs
 * the lexical half alone (soft term held at 0) over the frozen set with the
 * same seeded perturbations, so a change that reintroduces a reference-side
 * denominator or lets a wrong guess pay fails the build rather than a
 * number someone has to remember to look at.
 *
 * Thresholds are set from the measured values on the lexical half, with room
 * for dictionary growth: +HIT +7.5, +WRONG −0.4, +NEG 0, MISS never below 0
 * (a longer reference can only add licensing words, never a denominator),
 * r(len) 0.47 (the soft term brings it to 0.28 in production).
 *
 * Wrong-guess candidates are aroma lemmas only. A structural word added to a
 * note (say "frisk") earns category credit against any reference that has a
 * structural word, because both sit under GENERIC — that is a property of
 * the ladder measured separately (scripts/measure-options.ts, ignoreGeneric),
 * not a wrong aroma guess.
 */
const FROZEN = 'scripts/validation-results/frozen-set-2026-10.json'
const prep = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text))
const score = (u: string, r: string) => combineScoreScaled(lexicalCredit(prep(u), prep(r)), 0).score

type Case = { user: string; reference: string; plusHit: string; plusWrong: string; plusNeg: string; referencePlusExtra: string }

function buildCases(): Case[] {
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as { fields: Array<{ userNote: string; referenceNote: string }> }
  let seed = 20260818
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  // Vocabulary for wrong guesses: every aroma lemma in the corpus's references.
  const vocabulary = [...new Set(frozen.fields.flatMap(f => [...lemmasWithWeight(prep(f.referenceNote)).values()].filter(v => v.main && v.main !== 'GENERIC').map(v => v.lemma)))]
  const cases: Case[] = []
  for (const f of frozen.fields) {
    const r = prep(f.referenceNote)
    if (!hasScoreableFlavour(r)) continue
    const userLemmas = lemmasWithWeight(prep(f.userNote))
    const referenceLemmas = lemmasWithWeight(r)
    const referenceSet = new Set(referenceLemmas.keys())
    const derived = derivedFrom(referenceSet)
    const referenceSubs = new Set([...referenceLemmas.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`))
    const missed = [...referenceSet].filter(l => !userLemmas.has(l))
    if (!missed.length) continue
    const isGenuinelyWrong = (lemma: string) => {
      if (referenceSet.has(lemma) || derived.has(lemma) || userLemmas.has(lemma)) return false
      const entry = norwegianLemmas[lemma]?.categoryPath
      if (entry?.main && entry.sub && referenceSubs.has(`${entry.main}/${entry.sub}`)) return false
      return true
    }
    const wrong: string[] = []
    for (let k = 0; k < 200 && wrong.length < 1; k++) { const c = vocabulary[Math.floor(rnd() * vocabulary.length)]; if (c && isGenuinelyWrong(c)) wrong.push(c) }
    const extras: string[] = []
    for (let k = 0; k < 200 && extras.length < 3; k++) { const c = vocabulary[Math.floor(rnd() * vocabulary.length)]; if (c && isGenuinelyWrong(c) && !extras.includes(c)) extras.push(c) }
    if (!wrong.length || extras.length < 3) continue
    const hit = missed[Math.floor(rnd() * missed.length)]
    cases.push({ user: f.userNote, reference: f.referenceNote, plusHit: `${f.userNote} ${hit}`, plusWrong: `${f.userNote} ${wrong[0]}`, plusNeg: `${f.userNote} ikke ${hit}`, referencePlusExtra: `${f.referenceNote} ${extras.join(' ')}` })
  }
  return cases
}

describe('scoring objective on real notes (lexical half, offline)', () => {
  const cases = buildCases()
  const base = cases.map(c => score(c.user, c.reference))
  const delta = (pick: (c: Case) => [string, string]) => cases.map((c, i) => score(...pick(c)) - base[i])

  it('has enough real cases to mean anything', () => {
    expect(cases.length).toBeGreaterThan(150)
  })

  it('+HIT: naming another descriptor the wine has raises the score clearly', () => {
    expect(mean(delta(c => [c.plusHit, c.reference]))).toBeGreaterThan(6)
  })

  it('+WRONG: a genuinely wrong descriptor never pays on average', () => {
    expect(mean(delta(c => [c.plusWrong, c.reference]))).toBeLessThan(0)
  })

  it('+NEG: negating a descriptor the wine has never raises the score', () => {
    const d = delta(c => [c.plusNeg, c.reference])
    expect(mean(d)).toBeLessThanOrEqual(0)
    expect(d.filter(x => x > 0).length).toBe(0)
  })

  it('MISS: aromas the taster never wrote can never lower their score', () => {
    // A longer reference can add a licensing word (a hypernym, a derivation
    // source, a new category) and lift a user word's tier; it can never sit
    // in a denominator. So every delta is >= 0 and the mean stays small.
    const d = delta(c => [c.user, c.referencePlusExtra])
    expect(d.filter(x => x < 0).length).toBe(0)
    expect(mean(d)).toBeLessThan(5)
  })

  it('does not reward verbosity', () => {
    const lengths = cases.map(c => prep(c.user).split(' ').filter(Boolean).length)
    expect(Math.abs(pearson(base, lengths))).toBeLessThan(0.5)
  })
})
