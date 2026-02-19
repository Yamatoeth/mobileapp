import React, { useCallback, useEffect, useRef, useState } from 'react'
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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import ParticleSphere from './ParticleSphere'
import * as Haptics from 'expo-haptics'
import { useFonts as useOrbitron, Orbitron_700Bold } from '@expo-google-fonts/orbitron'
import { useFonts as useRajdhani, Rajdhani_300Light } from '@expo-google-fonts/rajdhani'
import { useNavigation } from '@react-navigation/native'
import { useWakeWord } from '../src/hooks/useWakeWord'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width: screenWidth } = Dimensions.get('window')
const SPHERE_SIZE = Math.min(screenWidth * 0.88, 340)
const R = SPHERE_SIZE * 0.42

function WaveBars({ visible }: { visible: boolean }) {
  const heights = [10, 22, 34, 18, 30, 14, 36, 20, 26]
  const anims = useRef(heights.map(() => new Animated.Value(0.35))).current

  useEffect(() => {
    const loops = anims.map((a, i) => {
      const seq = Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay: i * 80 }),
        Animated.timing(a, { toValue: 0.35, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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

export default function JarvisVoiceScreen({ onNavigate }: Props) {
  const [orbitronLoaded] = useOrbitron({ Orbitron_700Bold })
  const [rajdhaniLoaded] = useRajdhani({ Rajdhani_300Light })
  const fontsLoaded = orbitronLoaded && rajdhaniLoaded

  const [listening, setListening] = useState(false)
  const [wakeEnabled, setWakeEnabled] = useState(false)
  const pressTimeout = useRef<number | null>(null)
  const navigation: any = useNavigation()
  const wake = useWakeWord()

  const WAKE_KEY = 'wakeEnabled_v1'

  const onPressIn = useCallback(() => {
    if (pressTimeout.current) clearTimeout(pressTimeout.current)
    pressTimeout.current = (setTimeout(() => {
      setListening(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }, 60) as unknown) as number
  }, [])

  const onPressOut = useCallback(() => {
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current)
      pressTimeout.current = null
    }
    setListening(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  useEffect(() => {
    // Register wake callback to briefly show listening state and haptic.
    wake.onWake(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setListening(true)
      setTimeout(() => setListening(false), 2500)
    })
  }, [wake])

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
    apply()
    return () => {
      mounted = false
    }
  }, [wakeEnabled, wake])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const v = await AsyncStorage.getItem(WAKE_KEY)
        if (!mounted) return
        setWakeEnabled(v === '1')
      } catch (err) {
        // ignore
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const toggleWake = useCallback(async (val: boolean) => {
    try {
      setWakeEnabled(val)
      await AsyncStorage.setItem(WAKE_KEY, val ? '1' : '0')
    } catch (err) {
      // ignore write errors for now
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pressTimeout.current) clearTimeout(pressTimeout.current)
    }
  }, [])

  if (!fontsLoaded) return null

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.logo}>JARVIS</Text>
        <View style={styles.headerRight}>
          <Switch
            value={wakeEnabled}
            onValueChange={(v) => toggleWake(v)}
            trackColor={{ false: '#222', true: '#00d4ff' }}
            thumbColor={wakeEnabled ? '#ffffff' : '#f4f3f4'}
            accessibilityLabel="Enable wake word"
          />
          <Pressable onPress={() => onNavigate?.('profile')} style={styles.iconButton} accessibilityLabel="Open profile">
            <Ionicons name="person-circle-outline" size={28} color="#00d4ff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.center}>
        <View style={{ width: SPHERE_SIZE, height: SPHERE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <ParticleSphere listening={listening} />

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
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

        <WaveBars visible={true} />

        <View style={{ height: 18 }} />

        <Text style={[styles.hint, listening ? styles.hintActive : {}]}>
          {listening ? 'Listening...' : 'Hold to speak'}
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  status: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Rajdhani_300Light',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusActive: {
    color: '#00d4ff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.22)',
    fontFamily: 'Rajdhani_300Light',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  hintActive: {
    color: 'rgba(0,212,255,0.8)',
  },
  iconButton: {
    padding: 8,
  },
  icon: {
    fontSize: 18,
    color: '#00d4ff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  waveBar: {
    width: 6,
    backgroundColor: 'linear-gradient(180deg,#0044ff,#00d4ff)',
    borderRadius: 3,
  },
})
