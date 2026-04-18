import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Store console.warn mock
const mockWarn = vi.fn()

beforeEach(() => {
  vi.stubGlobal('console', {
    ...console,
    warn: mockWarn
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  mockWarn.mockClear()
})

describe('getActiveProfile', () => {
  it('should return inverted profile by default when env is undefined', async () => {
    // Ensure NEXT_PUBLIC_WEIGHT_PROFILE is not set
    delete process.env.NEXT_PUBLIC_WEIGHT_PROFILE
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
  })

  it('should return inverted profile when env is empty string', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', '')
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
  })
})

describe('valid profile selection', () => {
  it('should return inverted profile when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'inverted')
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
    expect(profile.weights['GENERIC']).toBe(1.0)
    expect(profile.weights['Frukt']).toBe(2.0)
  })

  it('should return moderate profile when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'moderate')
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('moderate')
    expect(profile.weights['GENERIC']).toBe(1.2)
    expect(profile.weights['Frukt']).toBe(1.8)
  })

})

describe('invalid profile fallback', () => {
  it('should fall back to inverted for invalid profile name', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'nonexistent')
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    const profile = getActiveProfile()

    expect(profile.name).toBe('inverted')
  })

  it('should log warning for invalid profile name', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'invalid-profile')
    vi.resetModules()

    const { getActiveProfile } = await import('./config')
    getActiveProfile()

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid NEXT_PUBLIC_WEIGHT_PROFILE')
    )
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('invalid-profile')
    )
  })
})

describe('getCategoryWeight', () => {
  it('should return correct weight for Frukt from inverted profile', async () => {
    delete process.env.NEXT_PUBLIC_WEIGHT_PROFILE
    vi.resetModules()

    const { getCategoryWeight } = await import('./config')

    expect(getCategoryWeight('Frukt')).toBe(2.0) // Inverted profile
  })

  it('should return correct weight for GENERIC from inverted profile', async () => {
    delete process.env.NEXT_PUBLIC_WEIGHT_PROFILE
    vi.resetModules()

    const { getCategoryWeight } = await import('./config')

    expect(getCategoryWeight('GENERIC')).toBe(1.0) // Inverted profile
  })

  it('should return different weights for same category across profiles', async () => {
    // Test inverted profile
    delete process.env.NEXT_PUBLIC_WEIGHT_PROFILE
    vi.resetModules()
    const { getCategoryWeight: getInverted } = await import('./config')
    const invertedGeneric = getInverted('GENERIC')

    // Test moderate profile
    vi.stubEnv('NEXT_PUBLIC_WEIGHT_PROFILE', 'moderate')
    vi.resetModules()
    const { getCategoryWeight: getModerate } = await import('./config')
    const moderateGeneric = getModerate('GENERIC')

    // Inverted: GENERIC = 1.0, Moderate: GENERIC = 1.2
    expect(invertedGeneric).toBe(1.0)
    expect(moderateGeneric).toBe(1.2)
    expect(invertedGeneric).not.toBe(moderateGeneric)
  })

  it('should return weight for all main categories', async () => {
    delete process.env.NEXT_PUBLIC_WEIGHT_PROFILE
    vi.resetModules()

    const { getCategoryWeight } = await import('./config')

    // Test all main categories exist and return numbers
    const categories = ['Frukt', 'Krydder', 'Urter', 'Blomster', 'Eik/fat', 'Mineral', 'GENERIC'] as const
    categories.forEach(category => {
      const weight = getCategoryWeight(category)
      expect(typeof weight).toBe('number')
      expect(weight).toBeGreaterThan(0)
    })
  })
})
