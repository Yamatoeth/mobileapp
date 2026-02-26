import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Dimensions, Animated, Easing, Platform } from 'react-native'
import { View } from 'react-native'

const { width: screenWidth } = Dimensions.get('window')
const SPHERE_SIZE = Math.min(screenWidth * 0.88, 340)

// Android gets fewer particles — JS thread is slower
const N = Platform.OS === 'android' ? 60 : 120

type Props = {
  listening: boolean
  style?: any
}

type Particle = {
  phi: number
  theta: number
  size: number
  phase: number
  anim: Animated.Value
}

const R = SPHERE_SIZE * 0.42
const CX = SPHERE_SIZE / 2
const CY = SPHERE_SIZE / 2
const ROT_X = 0.28

// Pre-compute static particle positions once (outside component)
const STATIC_PARTICLES: Omit<Particle, 'anim'>[] = Array.from({ length: N }, (_, i) => ({
  phi: Math.acos(1 - 2 * (i + 0.5) / N),
  theta: Math.PI * (1 + Math.sqrt(5)) * i,
  size: 2 + Math.random() * 3.5,
  phase: Math.random() * Math.PI * 2,
}))

export default function ParticleSphere({ listening }: Props) {
  const rotY = useRef(0)
  const energy = useRef(0)
  const tRef = useRef(0)
  const lastRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  // Throttle re-renders: only update state at ~30fps on Android, 60fps on iOS
  const frameSkip = Platform.OS === 'android' ? 2 : 1
  const frameCount = useRef(0)
  const [, setTick] = useState(0)

  const animValues = useRef<Animated.Value[]>(
    STATIC_PARTICLES.map(() => new Animated.Value(0))
  ).current

  // sheen animations
  const sheen1 = useRef(new Animated.Value(0)).current
  const sheen2 = useRef(new Animated.Value(0)).current

  // Pulse animation when listening
  useEffect(() => {
    if (listening) {
      animValues.forEach((anim, i) => {
        const phase = STATIC_PARTICLES[i].phase
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 600 + phase * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600 + phase * 200,
              useNativeDriver: true,
            }),
          ])
        ).start()
      })
    } else {
      animValues.forEach((anim) => {
        anim.stopAnimation()
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start()
      })
    }
  }, [listening, animValues])

  // RAF loop — throttled on Android
  useEffect(() => {
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now

      rotY.current += 0.004 + energy.current * 0.012
      const target = listening ? 1 : 0
      energy.current += (target - energy.current) * 0.06
      tRef.current += dt

      frameCount.current += 1
      if (frameCount.current % frameSkip === 0) {
        setTick((t) => t + 1)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [listening, frameSkip])

  // Sheen looping animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(sheen1, {
        toValue: 1,
        duration: 9000,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      })
    ).start()
    Animated.loop(
      Animated.timing(sheen2, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      })
    ).start()
  }, [sheen1, sheen2])

  // Project particles — computed inline (no useMemo, tRef.current isn't a dep React tracks)
  const t = tRef.current
  const projected = STATIC_PARTICLES
    .map((p, i) => {
      const theta = p.theta + rotY.current * 0.9 + Math.sin(t * 0.6 + p.phase) * 0.04
      const wobble = 1 + 0.06 * Math.sin(t * 1.5 + p.phase * 2)
      const x = R * wobble * Math.sin(p.phi) * Math.cos(theta)
      const y = R * wobble * Math.sin(p.phi) * Math.sin(theta)
      const z = R * Math.cos(p.phi)
      const y2 = y * Math.cos(ROT_X) - z * Math.sin(ROT_X)
      const z2 = y * Math.sin(ROT_X) + z * Math.cos(ROT_X)
      const sx = CX + x
      const sy = CY - y2
      const depth = (z2 / R + 1) * 0.5

      const lat = depth
      const rr = 120 + lat * 80
      const gg = 160 + lat * 40
      const bb = 220 + lat * 20
      const alpha = 0.18 + depth * 0.7 + energy.current * 0.12
      const size = Math.max(0.8, p.size * (0.6 + depth * 1.4 + Math.sin(t * 2 + p.phase) * 0.25))

      return { sx, sy, depth, rr, gg, bb, alpha, size, anim: animValues[i] }
    })
    .sort((a, b) => a.depth - b.depth)

  const sheen1Tx = sheen1.interpolate({
    inputRange: [0, 1],
    outputRange: [-SPHERE_SIZE * 0.6, SPHERE_SIZE * 0.6],
  })
  const sheen2Tx = sheen2.interpolate({
    inputRange: [0, 1],
    outputRange: [SPHERE_SIZE * 0.4, -SPHERE_SIZE * 0.4],
  })

  return (
    <View style={{ width: SPHERE_SIZE, height: SPHERE_SIZE }}>
      {/* Glossy sheens */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: CX - R * 1.1,
          top: CY - R * 0.9,
          width: R * 2.2,
          height: R * 1.6,
          borderRadius: R * 1.1,
          backgroundColor: 'rgba(255,255,255,0.06)',
          transform: [
            { translateX: sheen1Tx },
            { rotate: sheen1.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '18deg'] }) },
          ],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: CX - R * 0.9,
          top: CY - R * 0.6,
          width: R * 1.8,
          height: R * 1.2,
          borderRadius: R * 0.9,
          backgroundColor: 'rgba(110,180,255,0.04)',
          transform: [
            { translateX: sheen2Tx },
            { rotate: sheen2.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '-8deg'] }) },
          ],
        }}
      />

      {/* Particles */}
      {projected.map((item, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: 'absolute',
            width: Math.max(1, item.size),
            height: Math.max(1, item.size),
            borderRadius: item.size / 2,
            backgroundColor: `rgba(${Math.round(item.rr)},${Math.round(item.gg)},${Math.round(item.bb)},${item.alpha.toFixed(2)})`,
            left: item.sx - item.size / 2,
            top: item.sy - item.size / 2,
            transform: [
              {
                scale: item.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.6],
                }),
              },
            ],
            // elevation au lieu de shadow sur Android (shadow* props ignorées sur Android)
            elevation: Platform.OS === 'android' ? 1 : 0,
            shadowColor: Platform.OS === 'ios' ? '#00d9ff' : undefined,
            shadowOpacity: Platform.OS === 'ios' ? 0.12 * item.alpha : undefined,
            shadowRadius: Platform.OS === 'ios' ? 2 + item.size * 0.4 : undefined,
          }}
        />
      ))}
    </View>
  )
}