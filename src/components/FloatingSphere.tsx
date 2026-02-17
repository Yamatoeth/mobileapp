import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg'

type Props = {
  size?: number
  colorCenter?: string
  colorOuter?: string
  style?: any
  level?: any // 0..1 numeric or Animated.Value for realtime level
  isPulsing?: boolean // transient pulse (e.g., STT)
  isStreaming?: boolean // LLM streaming state
}

export default function FloatingSphere({ size = 420, colorCenter = '#0ea5a4', colorOuter = '#09363a', style, level = 0, isPulsing = false, isStreaming = false }: Props) {
  const translateY = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(0)).current

  

  useEffect(() => {
    const floatAnim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateY, { toValue: -18, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 12, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(translateX, { toValue: 10, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -8, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.03, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.98, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    )
    floatAnim.start()
    return () => floatAnim.stop()
  }, [translateY, translateX, scale])

  // react to prop changes: support either Animated.Value or number for level
  useEffect(() => {
    // if level is an Animated.Value, tie scale to it via interpolation
    if (level && typeof (level as any).interpolate === 'function') {
      // map level(0..1) -> scale base (1.0 .. 1.22)
      const lvlAnim = level as unknown as Animated.Value
      const mapped = (lvlAnim).interpolate({ inputRange: [0, 1], outputRange: [1, 1.22], extrapolate: 'clamp' })
      Animated.timing(scale, { toValue: 1, duration: 1, useNativeDriver: true }).start() // ensure value exists
      // we won't drive 'scale' directly; use mapped in animatedStyle below
    } else {
      const num = typeof level === 'number' ? level : 0
      const levelScale = 1 + Math.min(1, Math.max(0, num || 0)) * 0.22
      const streamBoost = isStreaming ? 0.06 : 0
      const target = levelScale + streamBoost
      Animated.timing(scale, {
        toValue: target,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start()
    }

    // transient pulse when isPulsing toggles true
    if (isPulsing) {
      pulse.setValue(0)
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start()
    }
  }, [level, isStreaming, isPulsing, scale, pulse])

  // compose final scale: if level is Animated.Value, build from it, otherwise use `scale` Animated.Value
  const levelScaleNode = (level && typeof (level as any).interpolate === 'function')
    ? (level as unknown as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [1, 1.22], extrapolate: 'clamp' })
    : scale

  const animatedStyle = {
    transform: [
      { translateY: translateY },
      { translateX: translateX },
      { scale: Animated.add(levelScaleNode as any, Animated.multiply(pulse, 0.06)) },
    ],
    opacity: Animated.add(0.85, Animated.multiply(pulse, 0.15)),
  }

  const half = size / 2

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { width: size, height: size, marginTop: -half }, animatedStyle, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="40%" r="60%" fx="50%" fy="40%">
            <Stop offset="0%" stopColor={colorCenter} stopOpacity="0.95" />
            <Stop offset="60%" stopColor={colorOuter} stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </RadialGradient>
        </Defs>
        <Circle cx={half} cy={half} r={half} fill="url(#g)" />
      </Svg>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
})
