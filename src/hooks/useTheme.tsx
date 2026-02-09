import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

type ThemeMode = 'light' | 'dark' | 'system'

type ThemeContextType = {
  theme: 'light' | 'dark'
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'app_theme_mode'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load saved theme preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setThemeModeState(value)
      }
      setIsLoaded(true)
    })
  }, [])

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode)
  }

  // Determine actual theme based on mode
  const theme: 'light' | 'dark' = 
    themeMode === 'system' 
      ? (systemColorScheme ?? 'light') 
      : themeMode

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
    isDark: theme === 'dark',
  }

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
