export type ThemeMode = 'light' | 'dark' | 'system'

type ReadableStorage = {
  getItem: (key: string) => Promise<string | null>
}

export async function readStoredThemeMode(
  storage: ReadableStorage,
  storageKey: string
): Promise<ThemeMode | null> {
  try {
    const value = await storage.getItem(storageKey)
    return value === 'light' || value === 'dark' || value === 'system' ? value : null
  } catch (error) {
    console.warn('Failed to read theme preference, falling back to system theme', error)
    return null
  }
}

export async function readOnboardingState(
  storage: ReadableStorage,
  storageKey: string
): Promise<boolean> {
  try {
    const value = await storage.getItem(storageKey)
    return value === 'true'
  } catch (error) {
    console.warn('Failed to read onboarding state, using default visibility', error)
    return true
  }
}
