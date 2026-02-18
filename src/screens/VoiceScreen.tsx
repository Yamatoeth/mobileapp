import React, { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, Vibration, View, Platform, AccessibilityInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVoiceAssistant } from '../hooks/useVoiceAssistant'
import { useTheme } from '../hooks/useTheme'
import { SiriSphere } from '../components/SiriSphere'
import { voiceColors, voiceGradient } from '../styles/voiceTheme'

const { width, height } = Dimensions.get('window')
const BUTTON_SIZE = 120

export function VoiceScreen() {
  const { state, audioLevel, transcript, response, startListening, stopListening } = useVoiceAssistant()
  const { isDark } = useTheme()

  const pulseAnim = useRef(new Animated.Value(1)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulseAnim])

  useEffect(() => {
    // glow when listening or speaking
    Animated.timing(glowAnim, {
      toValue: state === 'listening' || state === 'speaking' ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [state, glowAnim])

  function handlePressIn() {
    Vibration.vibrate(10)
    Animated.spring(scaleAnim, { toValue: 0.95, friction: 8, useNativeDriver: true }).start()
    startListening()
    AccessibilityInfo.announceForAccessibility('Listening')
  }

  function handlePressOut() {
    Vibration.vibrate(8)
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start()
    stopListening()
    AccessibilityInfo.announceForAccessibility('Processing')
  }

  const statusText =
    state === 'idle'
      ? 'Ready'
      : state === 'listening'
      ? 'Listening...'
      : state === 'transcribing' || state === 'thinking'
      ? 'Thinking...'
      : state === 'speaking'
      ? 'Speaking...'
      : state === 'error'
      ? 'Error'
      : '...'

  const statusColor =
    state === 'idle'
      ? voiceColors.primary
      : state === 'listening'
      ? '#FF3B30'
      : state === 'transcribing' || state === 'thinking'
      ? voiceColors.accent
      : state === 'speaking'
      ? voiceColors.primary
      : '#FF3B30'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: voiceGradient[0] }]}> 
      <Animated.View style={[styles.backgroundGlow, { transform: [{ scale: pulseAnim }], opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.45, 0.95] }) }]} />

      <View style={styles.header} accessible accessibilityRole="header">
        <Text style={[styles.title, { color: '#00D9FF' }]}>JARVIS</Text>
      </View>

      <View style={styles.centerArea}>
        <Animated.View style={[styles.statusPill, { backgroundColor: statusColor, opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.9,1] }) }]}> 
          <Text style={styles.statusText}>{statusText}</Text>
        </Animated.View>

        <View style={styles.waveContainer} pointerEvents="none">
          <SiriSphere audioLevel={audioLevel ?? 0} state={state} size={100} />
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Hold to talk"
            accessibilityHint="Hold to speak to Jarvis"
            style={({ pressed }) => [styles.buttonWrap, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.innerButton}>
              <Text style={styles.micIcon}>🎙</Text>
            </View>
          </Pressable>
        </Animated.View>

        <Text style={styles.hintText}>{state === 'idle' ? 'Hold to speak...' : ''}</Text>
      </View>

      {!!(transcript || response) && (
        <Animated.View style={styles.transcriptWrap} accessibilityLiveRegion="polite">
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptTitle}>Transcript</Text>
            <Text style={styles.transcriptText}>{transcript || response}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backgroundGlow: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: (width * 1.5) / 2,
    backgroundColor: '#002832',
    top: -height * 0.25,
    left: -width * 0.25,
    opacity: 0.6,
  },
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    color: '#0B1120',
    fontWeight: '700',
  },
  waveContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrap: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#00D9FF',
    shadowColor: '#00D9FF',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    backgroundColor: 'rgba(11,17,32,0.6)'
  },
  innerButton: {
    width: BUTTON_SIZE - 18,
    height: BUTTON_SIZE - 18,
    borderRadius: (BUTTON_SIZE - 18) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08101A',
  },
  micIcon: {
    fontSize: 28,
    color: '#00D9FF'
  },
  hintText: {
    marginTop: 18,
    color: '#9eeaff',
    opacity: 0.9,
  },
  transcriptWrap: {
    width: '100%',
    padding: 16,
  },
  transcriptCard: {
    backgroundColor: 'rgba(10,77,92,0.36)',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  transcriptTitle: {
    color: '#FFD700',
    fontWeight: '700',
    marginBottom: 6,
  },
  transcriptText: {
    color: '#d0f8ff'
  }
})
