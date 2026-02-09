import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_KEY = 'has_seen_onboarding'

export function useOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setHasSeenOnboarding(value === 'true')
      setIsLoading(false)
    })
  }, [])

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    setHasSeenOnboarding(true)
  }

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY)
    setHasSeenOnboarding(false)
  }

  return {
    hasSeenOnboarding,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  }
}
