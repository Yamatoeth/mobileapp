import * as SecureStore from 'expo-secure-store'
import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'

const API_KEY_STORAGE_KEY = 'groq_api_key'

// Check for environment variable (useful for development)
const ENV_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY

// For web, use localStorage as fallback (not secure, only for development)
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    return SecureStore.setItemAsync(key, value)
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    return SecureStore.deleteItemAsync(key)
  },
}

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    storage.get(API_KEY_STORAGE_KEY).then((storedKey) => {
      // Use stored key first, then fall back to env variable
      const key = storedKey || ENV_API_KEY || null
      setApiKeyState(key)
      setIsLoading(false)
    })
  }, [])

  const setApiKey = useCallback(async (key: string) => {
    await storage.set(API_KEY_STORAGE_KEY, key)
    setApiKeyState(key)
  }, [])

  const clearApiKey = useCallback(async () => {
    await storage.delete(API_KEY_STORAGE_KEY)
    // Fall back to env variable if available
    setApiKeyState(ENV_API_KEY || null)
  }, [])

  return { apiKey, setApiKey, clearApiKey, isLoading }
}
