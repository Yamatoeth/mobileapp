import { readOnboardingState, readStoredThemeMode } from '../utils/startupStorage'

describe('startup storage helpers', () => {
  const storage = {
    getItem: jest.fn<Promise<string | null>, [string]>(),
  }
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('falls back to system theme when reading theme storage fails', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('theme storage failed'))

    await expect(readStoredThemeMode(storage, 'theme')).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('falls back to onboarding-complete when reading onboarding storage fails', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('onboarding storage failed'))

    await expect(readOnboardingState(storage, 'onboarding')).resolves.toBe(true)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('accepts valid saved theme values only', async () => {
    storage.getItem.mockResolvedValueOnce('dark')
    await expect(readStoredThemeMode(storage, 'theme')).resolves.toBe('dark')

    storage.getItem.mockResolvedValueOnce('unsupported')
    await expect(readStoredThemeMode(storage, 'theme')).resolves.toBeNull()
  })

  it('parses onboarding completion from storage', async () => {
    storage.getItem.mockResolvedValueOnce('true')
    await expect(readOnboardingState(storage, 'onboarding')).resolves.toBe(true)

    storage.getItem.mockResolvedValueOnce('false')
    await expect(readOnboardingState(storage, 'onboarding')).resolves.toBe(false)
  })
})
