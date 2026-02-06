import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  lemmatizeAndWeight,
  analyze,
  norwegianLemmas,
  stopwords,
  type TextAnalysis,
} from './lemmatizeAndWeight'

// Mock alert for Node environment (analyze uses browser alert for empty text)
const mockAlert = vi.fn()
vi.stubGlobal('alert', mockAlert)

beforeEach(() => {
  mockAlert.mockClear()
})

afterEach(() => {
  mockAlert.mockClear()
})

describe('lemmatizeAndWeight', () => {
  describe('basic lemmatization', () => {
    it('should lemmatize Norwegian wine terms correctly', () => {
      const result = lemmatizeAndWeight('solbær og kirsebær')
      const lemmas = result.lemmatized.map(w => w.lemma)

      expect(lemmas).toContain('solbær')
      expect(lemmas).toContain('kirsebær')
      // 'og' is a stopword and should be filtered
      expect(lemmas).not.toContain('og')
    })

    it('should filter out stopwords', () => {
      const result = lemmatizeAndWeight('frisk og fruktig med god syre i smaken')
      const originals = result.lemmatized.map(w => w.original)

      // Stopwords should be filtered
      expect(originals).not.toContain('og')
      expect(originals).not.toContain('i')
      expect(originals).not.toContain('med')
    })

    it('should keep unknown words with ukjent category', () => {
      const result = lemmatizeAndWeight('sjokoladebitter og solbær')
      const unknown = result.lemmatized.find(w => w.original === 'sjokoladebitter')

      expect(unknown).toBeDefined()
      expect(unknown?.category).toBe('ukjent')
      expect(unknown?.lemma).toBe('sjokoladebitter') // Unknown keeps original as lemma
    })
  })

  describe('weight application', () => {
    it('should apply Frukt category weight to berry terms', () => {
      const result = lemmatizeAndWeight('solbær kirsebær')

      // All berry terms should have weight from active profile's Frukt category
      // With inverted profile (default), Frukt = 2.0
      result.lemmatized.forEach(item => {
        expect(item.weight).toBeGreaterThan(1.0)
      })
    })

    it('should apply GENERIC weight to structure terms', () => {
      const result = lemmatizeAndWeight('balansert frisk')

      // Generic terms with inverted profile = 1.0
      result.lemmatized.forEach(item => {
        expect(item.weight).toBe(1.0) // GENERIC weight from inverted profile
      })
    })

    it('should apply GENERIC weight to unknown terms', () => {
      const result = lemmatizeAndWeight('ukenteord123')

      expect(result.lemmatized[0].weight).toBe(1.0) // GENERIC weight
      expect(result.lemmatized[0].category).toBe('ukjent')
    })
  })

  describe('category assignment', () => {
    it('should assign eik category and Eik/fat categoryPath to eik term', () => {
      const eikData = norwegianLemmas['eik']

      expect(eikData.category).toBe('eik')
      expect(eikData.categoryPath?.main).toBe('Eik/fat')
    })

    it('should assign struktur category and GENERIC categoryPath to balansert', () => {
      const balansertData = norwegianLemmas['balansert']

      expect(balansertData.category).toBe('struktur')
      expect(balansertData.categoryPath?.main).toBe('GENERIC')
    })

    it('should track categories in result', () => {
      const result = lemmatizeAndWeight('solbær eik balansert')

      expect(result.categories['bær']).toBe(1)
      expect(result.categories['eik']).toBe(1)
      expect(result.categories['struktur']).toBe(1)
    })
  })

  describe('TextAnalysis structure', () => {
    it('should return result with lemmatized array, categories, and weightSum', () => {
      const result = lemmatizeAndWeight('solbær og kirsebær')

      expect(result).toHaveProperty('lemmatized')
      expect(result).toHaveProperty('categories')
      expect(result).toHaveProperty('weightSum')
      expect(Array.isArray(result.lemmatized)).toBe(true)
      expect(typeof result.categories).toBe('object')
      expect(typeof result.weightSum).toBe('number')
    })

    it('should have weightSum equal to sum of individual weights', () => {
      const result = lemmatizeAndWeight('solbær eik balansert')

      const calculatedSum = result.lemmatized.reduce((sum, item) => sum + item.weight, 0)
      expect(result.weightSum).toBeCloseTo(calculatedSum, 5)
    })
  })

  describe('stopwords constant', () => {
    it('should contain common Norwegian stopwords', () => {
      expect(stopwords.has('og')).toBe(true)
      expect(stopwords.has('i')).toBe(true)
      expect(stopwords.has('med')).toBe(true)
      expect(stopwords.has('en')).toBe(true)
      expect(stopwords.has('et')).toBe(true)
    })
  })
})

describe('analyze function', () => {
  it('should return AnalysisResult with data1, data2, similarity, commonLemmas', () => {
    const result = analyze('solbær og kirsebær', 'kirsebær og eik')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('data1')
    expect(result).toHaveProperty('data2')
    expect(result).toHaveProperty('similarity')
    expect(result).toHaveProperty('commonLemmas')
  })

  it('should calculate similarity between texts', () => {
    const result = analyze('solbær kirsebær', 'solbær kirsebær')

    expect(result?.similarity).toBeCloseTo(1.0, 2) // Identical texts = 1.0 similarity
  })

  it('should find common lemmas between texts', () => {
    const result = analyze('solbær og kirsebær', 'kirsebær og eik')

    expect(result?.commonLemmas).toBeDefined()
    const commonLemmaNames = result?.commonLemmas.map(c => c.lemma)
    expect(commonLemmaNames).toContain('kirsebær')
  })

  it('should sort common lemmas by combined weight', () => {
    const result = analyze('solbær eik balansert', 'solbær eik balansert')

    expect(result?.commonLemmas).toBeDefined()
    if (result && result.commonLemmas.length > 1) {
      for (let i = 0; i < result.commonLemmas.length - 1; i++) {
        const currentCombined = result.commonLemmas[i].weight1 + result.commonLemmas[i].weight2
        const nextCombined = result.commonLemmas[i + 1].weight1 + result.commonLemmas[i + 1].weight2
        expect(currentCombined).toBeGreaterThanOrEqual(nextCombined)
      }
    }
  })

  it('should return undefined for empty text and call alert', () => {
    const result = analyze('', 'some text')
    expect(result).toBeUndefined()
    expect(mockAlert).toHaveBeenCalledWith('Vennligst fyll inn begge tekstfeltene')
  })

  it('should return undefined for whitespace-only text', () => {
    const result = analyze('   ', 'some text')
    expect(result).toBeUndefined()
    expect(mockAlert).toHaveBeenCalled()
  })
})

describe('norwegianLemmas dictionary', () => {
  it('should have berry terms with Frukt main category', () => {
    const berryTerms = ['solbær', 'kirsebær', 'bringebær', 'blåbær']

    berryTerms.forEach(term => {
      const data = norwegianLemmas[term]
      expect(data).toBeDefined()
      expect(data?.categoryPath?.main).toBe('Frukt')
    })
  })

  it('should have structure terms with GENERIC main category', () => {
    const structureTerms = ['balansert', 'frisk', 'fyldig', 'tanniner']

    structureTerms.forEach(term => {
      const data = norwegianLemmas[term]
      expect(data).toBeDefined()
      expect(data?.categoryPath?.main).toBe('GENERIC')
    })
  })
})
