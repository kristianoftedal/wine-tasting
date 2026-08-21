import { describe, expect, it } from 'vitest'
import { expandFoodQuery } from './food-synonyms'
import generated from './food-synonyms.generated.json' with { type: 'json' }

const FOOD_VOCAB = ['Aperitiff', 'Dessert', 'Fisk', 'Grønnsaker', 'Lam og sau', 'Lyst kjøtt',
  'Ost', 'Skalldyr', 'Småvilt', 'Storfe', 'Storvilt', 'Svin']
const THEME_VOCAB = ['17. mai', 'Asiatisk', 'Fugl', 'Grillmat', 'Jul og nyttår', 'Kjøtt',
  'Norsk', 'Pizza og pasta', 'Påske', 'Sjømat', 'Thanksgiving', 'Vegetar']
const COURSE_VOCAB = ['Forrett', 'Gryter', 'Hovedrett', 'Kaker og desserter', 'Meny', 'Smårett', 'Tilbehør']

describe('expandFoodQuery', () => {
  it('resolves an ingredient to is_good_for terms', () => {
    expect(expandFoodQuery('ribbe').foodTerms).toContain('Svin')
    expect(expandFoodQuery('laks').foodTerms).toContain('Fisk')
    expect(expandFoodQuery('biff').foodTerms).toContain('Storfe')
  })

  it('lets the curated map override a wrong generated entry', () => {
    // Pinnekjøtt is salted, dried lamb ribs — never pork. The LLM sweep files it
    // under Svin; merging the two layers would make the hand-written correction
    // unable to win, so exact curated hits shadow the generated map entirely.
    const { foodTerms } = expandFoodQuery('pinnekjøtt')
    expect(foodTerms).toContain('Lam og sau')
    expect(foodTerms).not.toContain('Svin')
  })

  it('resolves occasions that have no is_good_for equivalent', () => {
    // These returned nothing at all before the theme channel existed.
    expect(expandFoodQuery('julemat').themeTerms).toContain('Jul og nyttår')
    expect(expandFoodQuery('påskelam').themeTerms).toContain('Påske')
    expect(expandFoodQuery('grillmat').themeTerms).toContain('Grillmat')
    expect(expandFoodQuery('thanksgiving').themeTerms).toContain('Thanksgiving')
  })

  it('resolves a course independently of what the dish is made of', () => {
    expect(expandFoodQuery('forrett').courseTerms).toContain('Forrett')
    expect(expandFoodQuery('tilbehør').courseTerms).toContain('Tilbehør')
    expect(expandFoodQuery('gryte').courseTerms).toContain('Gryter')
  })

  it('populates several channels when a query legitimately spans them', () => {
    // Ribbe is pork and Christmas: the wine query wants Svin, the article query
    // wants Jul og nyttår. Collapsing to one channel loses half the answer.
    const ribbe = expandFoodQuery('ribbe')
    expect(ribbe.foodTerms).toContain('Svin')
    expect(ribbe.themeTerms).toContain('Jul og nyttår')
  })

  it('resolves compound queries through their content word', () => {
    expect(expandFoodQuery('stekt ribbe').foodTerms).toContain('Svin')
    expect(expandFoodQuery('grillet svinekam').foodTerms).toContain('Svin')
  })

  it('returns empty channels for an empty or unknown query', () => {
    for (const query of ['', '   ', 'xyzzyqwerty']) {
      const r = expandFoodQuery(query)
      expect(r.foodTerms).toEqual([])
      expect(r.themeTerms).toEqual([])
      expect(r.courseTerms).toEqual([])
    }
  })

  it('only ever emits terms that exist in the target column', () => {
    const queries = ['ribbe', 'julemat', 'forrett', 'sushi', 'vegetar', 'kalkun', 'pizza',
      'and', 'ost', 'dessert', 'tapas', 'påske', 'grill', 'hovedrett', 'meny']
    for (const q of queries) {
      const r = expandFoodQuery(q)
      for (const t of r.foodTerms) expect(FOOD_VOCAB, `${q} -> food ${t}`).toContain(t)
      for (const t of r.themeTerms) expect(THEME_VOCAB, `${q} -> theme ${t}`).toContain(t)
      for (const t of r.courseTerms) expect(COURSE_VOCAB, `${q} -> course ${t}`).toContain(t)
    }
  })
})

describe('food-synonyms.generated.json', () => {
  const file = generated as {
    maps?: { food?: Record<string, string[]>; theme?: Record<string, string[]>; course?: Record<string, string[]> }
    vocabularies?: { food?: string[]; theme?: string[]; course?: string[] }
  }

  it('has the three-channel shape the resolver expects', () => {
    expect(file.maps?.food).toBeDefined()
    expect(file.maps?.theme).toBeDefined()
    expect(file.maps?.course).toBeDefined()
  })

  it('targets only terms that exist in the corresponding column', () => {
    // The previous single-map build emitted 31 targets against a 12-term filter,
    // so half its lemmas resolved to nothing. Each channel is now scoped to the
    // vocabulary it is actually queried against.
    const channels: Array<[string, Record<string, string[]> | undefined, string[]]> = [
      ['food', file.maps?.food, FOOD_VOCAB],
      ['theme', file.maps?.theme, THEME_VOCAB],
      ['course', file.maps?.course, COURSE_VOCAB],
    ]
    for (const [name, map, vocab] of channels) {
      const targets = [...new Set(Object.values(map ?? {}).flat())]
      const stray = targets.filter(t => !vocab.includes(t))
      expect(stray, `${name} channel has out-of-vocabulary targets`).toEqual([])
    }
  })

  it('has no lemma that resolves to nothing usable', () => {
    for (const [name, map] of Object.entries(file.maps ?? {})) {
      const dead = Object.entries(map ?? {}).filter(([, v]) => v.length === 0).map(([k]) => k)
      expect(dead, `${name} channel has dead lemmas`).toEqual([])
    }
  })
})
