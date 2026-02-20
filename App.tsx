import 'react-native-gesture-handler'
import 'react-native-reanimated'
import './global.css'
// Ensure Skia JSI wrappers are applied early to accept various binary shapes
import './src/utils/skiaSafe'


import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from 'react-native'
import JarvisVoiceScreen from './src/components/JarvisVoiceScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { ThemeProvider, useTheme } from './src/hooks/useTheme'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { useOnboarding } from './src/hooks/useOnboarding'
import { useEffect, useState } from 'react'
import { addNotificationActionListener, registerForPushNotificationsAsync } from './src/services/notificationService'

const Stack = createNativeStackNavigator()

function AppContent() {
  const { isDark, theme } = useTheme()
  const { hasSeenOnboarding, isLoading, completeOnboarding } = useOnboarding()
  
  const navigationTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#002832',
      card: '#002832',
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#002832',
      card: '#002832',
    },
  }
  // notification triggers hook removed in pivot
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
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove()
      }
    }
  }, [])

  // Register for push notifications after onboarding (temporary user id)
  useEffect(() => {
    if (hasSeenOnboarding) {
      // TODO: replace with real authenticated user id
      registerForPushNotificationsAsync(1)
    }
  }, [hasSeenOnboarding])

  if (isLoading) {
    return null
  }

  if (!hasSeenOnboarding) {
    return (
      <View style={{ flex: 1, backgroundColor: '#002832' }}>
        <OnboardingScreen onComplete={completeOnboarding} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#002832' }}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#002832' } }}>
          <Stack.Screen name="Home">
            {(props) => <JarvisVoiceScreen onNavigate={() => props.navigation.navigate('Profile')} />}
          </Stack.Screen>
          <Stack.Screen name="Profile">
            {(props) => <ProfileScreen onNavigate={() => props.navigation.navigate('Home')} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
