import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Switch,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import VoiceOrb from '../components/VoiceOrb/VoiceOrb'
import * as Haptics from 'expo-haptics'
import { useFonts as useOrbitron, Orbitron_700Bold } from '@expo-google-fonts/orbitron'
import { useFonts as useRajdhani, Rajdhani_300Light, Rajdhani_500Medium } from '@expo-google-fonts/rajdhani'
import { useWakeWord } from '../hooks/useWakeWord'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useVoiceAssistant } from '../hooks/useVoiceAssistant'
import apiClient from '../services/apiClient'
import { useSettingsStore } from '../store/settingsStore'

const { width: screenWidth } = Dimensions.get('window')
const SPHERE_SIZE = Math.min(screenWidth * 0.88, 340)

function WaveBars({ visible }: { visible: boolean }) {
  const heights = [10, 22, 34, 18, 30, 14, 36, 20, 26]
  const anims = useRef(heights.map(() => new Animated.Value(0.35))).current

  useEffect(() => {
    const loops = anims.map((a, i) => {
      const seq = Animated.sequence([
        Animated.timing(a, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          delay: i * 80,
        }),
        Animated.timing(a, {
          toValue: 0.35,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
      return Animated.loop(seq)
    })

    if (visible) {
      loops.forEach((l) => l.start())
    }

    return () => loops.forEach((l) => l.stop())
  }, [visible, anims])

  return (
    <View style={styles.waveRow}>
      {heights.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: h,
              transform: [{ scaleY: anims[i] }],
              marginHorizontal: 4,
            },
          ]}
        />
      ))}
    </View>
  )
}

type Props = {
  onNavigate?: (route: 'home' | 'profile') => void
}

function createLocalUserId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function JarvisVoiceScreen({ onNavigate }: Props) {
  const [orbitronLoaded] = useOrbitron({ Orbitron_700Bold })
  const [rajdhaniLoaded] = useRajdhani({ Rajdhani_300Light, Rajdhani_500Medium })
  const fontsLoaded = orbitronLoaded && rajdhaniLoaded

  const [wakeEnabled, setWakeEnabled] = useState(false)
  const [draft, setDraft] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const pressTimeout = useRef<number | null>(null)
  const wake = useWakeWord()
  const userId = useSettingsStore((s) => s.userId)
  const setUser = useSettingsStore((s) => s.setUser)

  const {
    state,
    isListening,
    isProcessing,
    isSpeaking,
    isReady,
    error,
    transcript,
    response,
    streamingResponse,
    startListening,
    stopListening,
    sendText,
  } = useVoiceAssistant({
    streamLLM: true,
    playAudio: true,
  })

  const WAKE_KEY = 'wakeEnabled_v1'

  useEffect(() => {
    let active = true

    async function bootstrapUser() {
      const stableUserId = userId || createLocalUserId()

      try {
        if (!userId) {
          setUser(stableUserId, `${stableUserId}@local.invalid`, 'Local User')
        }
      } finally {
        if (active) {
          setIsBootstrapping(false)
        }
      }

      void apiClient.getOrCreateUser(stableUserId).catch((bootstrapError) => {
        console.warn('Unable to create backend user, continuing in local mode', bootstrapError)
      })
    }

    void bootstrapUser()
    return () => {
      active = false
    }
  }, [setUser, userId])

  const onPressIn = useCallback(() => {
    if (pressTimeout.current) clearTimeout(pressTimeout.current)
    pressTimeout.current = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      void startListening()
    }, 60) as unknown as number
  }, [startListening])

  const onPressOut = useCallback(() => {
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current)
      pressTimeout.current = null
    }

    if (isListening) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      void stopListening()
    }
  }, [isListening, stopListening])

  useEffect(() => {
    wake.onWake(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      void startListening()
      setTimeout(() => {
        void stopListening()
      }, 2500)
    })
  }, [startListening, stopListening, wake])

  useEffect(() => {
    let mounted = true
    async function apply() {
      if (!mounted) return
      if (wakeEnabled) {
        await wake.start()
      } else {
        await wake.stop()
      }
    }
    void apply()
    return () => {
      mounted = false
    }
  }, [wakeEnabled, wake])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const value = await AsyncStorage.getItem(WAKE_KEY)
        if (!mounted) return
        setWakeEnabled(value === '1')
      } catch {
        // ignore persisted wake-word read failures
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const toggleWake = useCallback(async (value: boolean) => {
    try {
      setWakeEnabled(value)
      await AsyncStorage.setItem(WAKE_KEY, value ? '1' : '0')
    } catch {
      // ignore wake-word persistence write errors
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pressTimeout.current) clearTimeout(pressTimeout.current)
    }
  }, [])

  const displayResponse = streamingResponse || response
  const statusLabel = useMemo(() => {
    if (isBootstrapping) return 'Booting assistant'
    if (isListening) return 'Listening'
    if (isSpeaking) return 'Speaking'
    if (isProcessing) return 'Thinking'
    if (!isReady) return 'Preparing audio'
    return 'Ready'
  }, [isBootstrapping, isListening, isProcessing, isReady, isSpeaking])

  const handleSendText = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || isProcessing || isBootstrapping) {
      return
    }
    setDraft('')
    await sendText(trimmed)
  }, [draft, isBootstrapping, isProcessing, sendText])

  if (!fontsLoaded) return null

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.logo}>JARVIS</Text>
        <View style={styles.headerRight}>
          <Switch
            value={wakeEnabled}
            onValueChange={toggleWake}
            trackColor={{ false: '#173947', true: '#00d4ff' }}
            thumbColor={wakeEnabled ? '#ffffff' : '#f4f3f4'}
            accessibilityLabel="Enable wake word"
          />
          <Pressable
            onPress={() => onNavigate?.('profile')}
            style={styles.iconButton}
            accessibilityLabel="Open profile"
          >
            <Ionicons name="person-circle-outline" size={28} color="#00d4ff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.statusPill}>
          {isBootstrapping || isProcessing ? (
            <ActivityIndicator size="small" color="#00d4ff" />
          ) : (
            <View style={[styles.statusDot, (isListening || isSpeaking) && styles.statusDotActive]} />
          )}
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        <View style={{ width: SPHERE_SIZE, height: SPHERE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <VoiceOrb
            state={isListening ? 'listening' : isSpeaking ? 'speaking' : isProcessing ? 'thinking' : 'idle'}
            style={{ width: SPHERE_SIZE, height: SPHERE_SIZE, borderRadius: SPHERE_SIZE / 2 }}
          />

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isBootstrapping}
            style={{
              position: 'absolute',
              width: SPHERE_SIZE,
              height: SPHERE_SIZE,
              borderRadius: SPHERE_SIZE / 2,
            }}
            android_ripple={{ color: 'transparent' }}
          />
        </View>

        <View style={{ height: 18 }} />
        <WaveBars visible={isListening || isProcessing || isSpeaking} />
        <View style={{ height: 18 }} />
        <Text style={[styles.hint, (isListening || isSpeaking) && styles.hintActive]}>
          {isListening ? 'Release to send' : isBootstrapping ? 'Preparing local session' : 'Hold to speak'}
        </Text>
      </View>

      <View style={styles.outputPanel}>
        <Text style={styles.panelTitle}>Conversation</Text>
        <ScrollView style={styles.outputScroll} contentContainerStyle={styles.outputScrollContent}>
          {transcript ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageLabel}>You</Text>
              <Text style={styles.messageText}>{transcript}</Text>
            </View>
          ) : null}

          {displayResponse ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageLabel}>JARVIS</Text>
              <Text style={styles.messageText}>{displayResponse}</Text>
            </View>
          ) : (
            <View style={styles.messageCard}>
              <Text style={styles.messageLabel}>JARVIS</Text>
              <Text style={styles.placeholderText}>
                Ask a question below, or hold the orb to speak.
              </Text>
            </View>
          )}

          {error ? (
            <View style={[styles.messageCard, styles.errorCard]}>
              <Text style={styles.messageLabel}>Issue</Text>
              <Text style={styles.messageText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask JARVIS anything"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            editable={!isBootstrapping && !isProcessing}
            onSubmitEditing={() => {
              void handleSendText()
            }}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => {
              void handleSendText()
            }}
            disabled={!draft.trim() || isBootstrapping || isProcessing}
            style={[
              styles.sendButton,
              (!draft.trim() || isBootstrapping || isProcessing) && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons name="arrow-up" size={20} color="#00131a" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002832',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    height: 48,
  },
  logo: {
    color: '#00d4ff',
    fontFamily: 'Orbitron_700Bold',
    fontSize: 18,
    letterSpacing: 4,
    textShadowColor: '#00d4ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    marginBottom: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  statusDotActive: {
    backgroundColor: '#00d4ff',
  },
  statusText: {
    color: '#c9f7ff',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hint: {
    marginTop: 8,
    color: '#ffffff',
    fontFamily: 'Rajdhani_300Light',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  hintActive: {
    color: '#00d4ff',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  waveBar: {
    width: 6,
    backgroundColor: '#00d4ff',
    borderRadius: 3,
    shadowColor: '#00d4ff',
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },
  outputPanel: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 12, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.18)',
    minHeight: 280,
  },
  panelTitle: {
    color: '#7edff2',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  outputScroll: {
    maxHeight: 210,
  },
  outputScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  messageCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  errorCard: {
    borderColor: 'rgba(255, 87, 87, 0.28)',
    backgroundColor: 'rgba(255, 87, 87, 0.08)',
  },
  messageLabel: {
    color: '#59e1ff',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  messageText: {
    color: '#f4fcff',
    fontFamily: 'Rajdhani_300Light',
    fontSize: 18,
    lineHeight: 24,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: 'Rajdhani_300Light',
    fontSize: 18,
    lineHeight: 24,
  },
  composer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 18,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4ff',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
})
