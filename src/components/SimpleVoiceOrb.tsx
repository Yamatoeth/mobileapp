import React, { useEffect, useMemo, useRef } from 'react'
import type { ComponentProps } from 'react'
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

type Props = {
  state: OrbState
  audioLevel?: number
  style?: ViewStyle
}

type OrbTheme = {
  accent: string
  soft: string
  glow: string
  icon: ComponentProps<typeof Ionicons>['name']
}

const STATE_THEME: Record<OrbState, OrbTheme> = {
  idle: {
    accent: '#00d4ff',
    soft: 'rgba(0, 212, 255, 0.28)',
    glow: 'rgba(0, 212, 255, 0.18)',
    icon: 'radio-outline',
  },
  listening: {
    accent: '#35f0ff',
    soft: 'rgba(53, 240, 255, 0.34)',
    glow: 'rgba(53, 240, 255, 0.24)',
    icon: 'mic-outline',
  },
  thinking: {
    accent: '#ffb703',
    soft: 'rgba(255, 183, 3, 0.3)',
    glow: 'rgba(255, 183, 3, 0.18)',
    icon: 'sync-outline',
  },
  speaking: {
    accent: '#8fffe0',
    soft: 'rgba(143, 255, 224, 0.3)',
    glow: 'rgba(143, 255, 224, 0.22)',
    icon: 'volume-high-outline',
  },
}

export default function SimpleVoiceOrb({ state, audioLevel = 0, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current
  const spin = useRef(new Animated.Value(0)).current
  const level = useRef(new Animated.Value(0)).current
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.35))).current

  const theme = useMemo(() => STATE_THEME[state], [state])
  const isActive = state !== 'idle'

  useEffect(() => {
    pulse.stopAnimation()
    pulse.setValue(0)

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: state === 'thinking' ? 760 : isActive ? 920 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: state === 'thinking' ? 760 : isActive ? 920 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [isActive, pulse, state])

  useEffect(() => {
    spin.stopAnimation()
    spin.setValue(0)

    if (state !== 'thinking') {
      return
    }

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    loop.start()
    return () => loop.stop()
  }, [spin, state])

  useEffect(() => {
    Animated.timing(level, {
      toValue: Math.max(0, Math.min(1, audioLevel)),
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [audioLevel, level])

  useEffect(() => {
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 360 + index * 45,
            delay: index * 55,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.35,
            duration: 360 + index * 45,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    )

    if (state === 'speaking' || state === 'listening') {
      loops.forEach((loop) => loop.start())
    } else {
      bars.forEach((bar) => {
        bar.stopAnimation()
        Animated.timing(bar, {
          toValue: 0.35,
          duration: 180,
          useNativeDriver: true,
        }).start()
      })
    }

    return () => loops.forEach((loop) => loop.stop())
  }, [bars, state])

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: isActive ? [0.96, 1.08] : [0.98, 1.02],
  })
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: isActive ? [0.28, 0.72] : [0.18, 0.34],
  })
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: isActive ? [0.5, 1] : [0.28, 0.46],
  })
  const spinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const levelScale = level.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.14],
  })

  return (
    <View style={[styles.host, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: theme.glow,
            opacity: glowOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.outerRing,
          {
            borderColor: theme.soft,
            opacity: ringOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.rotatingRing,
          {
            borderTopColor: theme.accent,
            borderRightColor: theme.soft,
            borderBottomColor: theme.soft,
            borderLeftColor: theme.accent,
            opacity: state === 'idle' ? 0.42 : 0.86,
            transform: [{ rotate: spinRotation }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.coreShell,
          {
            borderColor: theme.soft,
            shadowColor: theme.accent,
            transform: [{ scale: levelScale }],
          },
        ]}
      >
        <View style={[styles.core, { backgroundColor: theme.glow }]}>
          <Ionicons name={theme.icon} size={44} color={theme.accent} />
          <View style={styles.meter}>
            {bars.map((bar, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.meterBar,
                  {
                    backgroundColor: theme.accent,
                    opacity: state === 'idle' ? 0.46 : 0.9,
                    transform: [{ scaleY: bar }],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    aspectRatio: 1,
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    width: '76%',
    height: '76%',
    borderRadius: 999,
  },
  outerRing: {
    position: 'absolute',
    width: '92%',
    height: '92%',
    borderRadius: 999,
    borderWidth: 1,
  },
  rotatingRing: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 2,
  },
  coreShell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    height: '48%',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 14, 22, 0.86)',
    shadowOpacity: 0.48,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '82%',
    height: '82%',
    borderRadius: 999,
  },
  meter: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 20,
    marginTop: 8,
  },
  meterBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
})
