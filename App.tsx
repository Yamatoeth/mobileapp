import './global.css'

import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { TabNavigator } from './src/navigation/TabNavigator'
import { ThemeProvider, useTheme } from './src/hooks/useTheme'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { useOnboarding } from './src/hooks/useOnboarding'
import { useEffect } from 'react'
import { addNotificationActionListener } from './src/services/notificationService'
import { useNotificationTriggers } from './src/hooks/useNotificationTriggers'

function AppContent() {
  const { isDark, theme } = useTheme()
  const { hasSeenOnboarding, isLoading, completeOnboarding } = useOnboarding()
  useNotificationTriggers()
  useEffect(() => {
    const subscription = addNotificationActionListener((response: { actionIdentifier: string }) => {
      // Example: handle notification actions
      const action = response.actionIdentifier
      if (action === 'dismiss') {
        // Dismiss logic
      } else if (action === 'snooze') {
        // Snooze logic (reschedule notification)
      } else if (action === 'open_app') {
        // Open app logic (navigate if needed)
      }
    })
    return () => {
      // No cleanup needed as addNotificationActionListener returns void
    }
  }, [])

  if (isLoading) {
    return null
  }

  if (!hasSeenOnboarding) {
    return (
      <View className={`flex-1 ${isDark ? 'dark bg-gray-900' : 'bg-white'}`}>
        <OnboardingScreen onComplete={completeOnboarding} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    )
  }

  const navigationTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#111827',
      card: '#1f2937',
    },
  } : DefaultTheme

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`}>
      <NavigationContainer theme={navigationTheme}>
        <TabNavigator />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationContainer>
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
