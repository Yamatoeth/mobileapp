import React, { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, Vibration, View, Platform, AccessibilityInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import VoiceOrb from '../components/VoiceOrb/VoiceOrb'
import { useVoiceAssistant } from '../hooks/useVoiceAssistant'
import { useTheme } from '../hooks/useTheme'
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#002832' }]}> 

      {/* Arc-reactor rings behind the mic button */}
      <View style={styles.ringsWrap} pointerEvents="none">
        <Animated.View style={[styles.ring, { transform: [{ scale: pulseAnim }], opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.06, 0.28] }) }]} />
        <Animated.View style={[styles.ringSmall, { transform: [{ scale: pulseAnim }], opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.04, 0.22] }) }]} />
        <Animated.View style={[styles.ringInner, { transform: [{ scale: pulseAnim }], opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.08, 0.36] }) }]} />
      </View>

      <View style={styles.header} accessible accessibilityRole="header">
        <Text style={[styles.title, { color: '#00D9FF' }]}>JARVIS</Text>
      </View>

      <View style={styles.centerArea}>
        <Animated.View style={[styles.statusPill, { backgroundColor: statusColor, opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.9,1] }) }]}> 
          <Text style={styles.statusText}>{statusText}</Text>
        </Animated.View>

        <View style={styles.waveContainer} pointerEvents="none">
        </View>
        <VoiceOrb
          state={state === 'listening' ? 'listening' : state === 'speaking' ? 'speaking' : state === 'thinking' ? 'thinking' : 'idle'}
          audioLevel={audioLevel}
          style={{ width: BUTTON_SIZE * 2, height: BUTTON_SIZE * 2, position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
        />
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
          <View style={styles.transcriptCardRow}>
            {/* Assistant (JARVIS) message on the left */}
            {response ? (
              <View style={[styles.bubble, styles.bubbleLeft]}>
                <Text style={styles.bubbleAuthor}>JARVIS</Text>
                <Text style={styles.bubbleText}>{response}</Text>
              </View>
            ) : null}

            {/* User message on the right */}
            {transcript ? (
              <View style={[styles.bubble, styles.bubbleRight]}>
                <Text style={styles.bubbleAuthorRight}>You</Text>
                <Text style={[styles.bubbleText, { color: '#001022' }]}>{transcript}</Text>
              </View>
            ) : null}
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
    backgroundColor: '#002832',
  },
  // backgroundGlow removed to avoid large halo; keep inner rings for liveliness
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
  ,
  ringsWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -BUTTON_SIZE / 2 }, { translateY: -BUTTON_SIZE / 2 }],
    width: BUTTON_SIZE * 2,
    height: BUTTON_SIZE * 2,
  },
  ring: {
    position: 'absolute',
    width: BUTTON_SIZE * 1.8,
    height: BUTTON_SIZE * 1.8,
    borderRadius: (BUTTON_SIZE * 1.8) / 2,
    backgroundColor: voiceColors.primary,
    opacity: 0.12,
  },
  ringSmall: {
    position: 'absolute',
    width: BUTTON_SIZE * 1.25,
    height: BUTTON_SIZE * 1.25,
    borderRadius: (BUTTON_SIZE * 1.25) / 2,
    backgroundColor: voiceColors.primary,
    opacity: 0.08,
  },
  ringInner: {
    position: 'absolute',
    width: BUTTON_SIZE * 0.9,
    height: BUTTON_SIZE * 0.9,
    borderRadius: (BUTTON_SIZE * 0.9) / 2,
    backgroundColor: voiceColors.primary,
    opacity: 0.18,
  },
  transcriptCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 12,
    margin: 6,
  },
  bubbleLeft: {
    backgroundColor: 'rgba(0,180,216,0.12)',
    alignSelf: 'flex-start',
  },
  bubbleRight: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
  },
  bubbleAuthor: {
    color: voiceColors.accent,
    fontWeight: '700',
    marginBottom: 6,
  },
  bubbleAuthorRight: {
    color: '#333',
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'right'
  },
  bubbleText: {
    color: '#d8fbff'
  }
})
