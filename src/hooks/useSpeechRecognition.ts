import { useState, useEffect, useCallback } from 'react'
import { Alert } from 'react-native'

type UseSpeechRecognitionResult = {
  isListening: boolean
  isAvailable: boolean
  startListening: () => Promise<void>
  stopListening: () => void
  transcript: string
  resetTranscript: () => void
}

// Voice input is disabled by default in Expo Go
// To enable, create a development build with expo-speech-recognition
const VOICE_ENABLED = false

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const startListening = useCallback(async () => {
    if (!VOICE_ENABLED) {
      Alert.alert(
        'Voice Input Unavailable',
        'Voice input requires a development build with native modules. It\'s not available in Expo Go.\n\nTo enable, run:\nnpx expo prebuild\nnpx expo run:ios',
        [{ text: 'OK' }]
      )
      return
    }
  }, [])

  const stopListening = useCallback(() => {
    setIsListening(false)
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    isAvailable: VOICE_ENABLED,
    startListening,
    stopListening,
    transcript,
    resetTranscript,
  }
}
