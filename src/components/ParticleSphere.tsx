import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, Animated, Easing } from 'react-native'
import { View } from 'react-native'

const { width: screenWidth } = Dimensions.get('window')
const SPHERE_SIZE = Math.min(screenWidth * 0.88, 340)
const N = 120 // fewer particles — RN Animated can't handle 500

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

export default function ParticleSphere({ listening }: Props) {
  const rotY = useRef(0)
  const energy = useRef(0)
  const tRef = useRef(0)
  const lastRef = useRef<number | null>(null)
  const [, setTick] = useState(0)

  // sheen animations for liquid glossy effect
  const sheen1 = useRef(new Animated.Value(0)).current
  const sheen2 = useRef(new Animated.Value(0)).current

  const particles = useMemo<Particle[]>(() => {
    const out: Particle[] = []
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / N)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const size = 2 + Math.random() * 3.5
      const phase = Math.random() * Math.PI * 2
      out.push({ phi, theta, size, phase, anim: new Animated.Value(0) })
    }
    return out
  }, [])

  // Pulse animation when listening
  useEffect(() => {
    if (listening) {
      particles.forEach((p) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(p.anim, { toValue: 1, duration: 600 + p.phase * 200, useNativeDriver: true }),
            Animated.timing(p.anim, { toValue: 0, duration: 600 + p.phase * 200, useNativeDriver: true }),
          ])
        ).start()
      })
    } else {
      particles.forEach((p) => {
        p.anim.stopAnimation()
        Animated.timing(p.anim, { toValue: 0, duration: 400, useNativeDriver: true }).start()
      })
    }
  }, [listening, particles])

  // continuous RAF-driven loop: rotate, wobble energy and time
  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now
      const dt = Math.min(0.05, (now - (lastRef.current || now)) / 1000)
      lastRef.current = now
      rotY.current += 0.004 + energy.current * 0.012
      const target = listening ? 1 : 0
      energy.current += (target - energy.current) * 0.06
      tRef.current += dt
      setTick((t) => t + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [listening])

  // sheen looping animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(sheen1, { toValue: 1, duration: 9000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
    ).start()
    Animated.loop(
      Animated.timing(sheen2, { toValue: 1, duration: 12000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
    ).start()
  }, [sheen1, sheen2])

  // Project particles to 2D with wobble for liquid motion
  const projected = useMemo(() => {
    const t = tRef.current
    return particles
      .map((p) => {
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

        // softened pastel colors for liquid look
        const lat = depth
        let rr = 120 + lat * 80
        let gg = 160 + lat * 40
        let bb = 220 + lat * 20

        const alpha = 0.18 + depth * 0.7 + energy.current * 0.12
        const size = p.size * (0.6 + depth * 1.4 + Math.sin(t * 2 + p.phase) * 0.25)

        return { sx, sy, depth, rr, gg, bb, alpha, size: Math.max(0.8, size), anim: p.anim }
      }).sort((a, b) => a.depth - b.depth)
  }, [particles, tRef.current])

  // sheen transforms
  const sheen1Tx = sheen1.interpolate({ inputRange: [0, 1], outputRange: [-SPHERE_SIZE * 0.6, SPHERE_SIZE * 0.6] })
  const sheen2Tx = sheen2.interpolate({ inputRange: [0, 1], outputRange: [SPHERE_SIZE * 0.4, -SPHERE_SIZE * 0.4] })

  return (
    <View style={{ width: SPHERE_SIZE, height: SPHERE_SIZE }}>

      {/* glossy sheens for liquid, subtle colored overlays */}
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
            { scale: 1.05 + energy.current * 0.08 },
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
            { scale: 1.02 + energy.current * 0.06 },
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
            backgroundColor: `rgba(${Math.round(item.rr)},${Math.round(item.gg)},${Math.round(item.bb)},${item.alpha})`,
            left: item.sx - item.size / 2,
            top: item.sy - item.size / 2,
            transform: [{
              scale: item.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.6],
              })
            }],
            // slightly blur-like shadow for depth on iOS/Android
            shadowColor: '#00d9ff',
            shadowOpacity: 0.12 * item.alpha,
            shadowRadius: 2 + item.size * 0.4,
            elevation: 1,
          }}
        />
      ))}
    </View>
  )
}
