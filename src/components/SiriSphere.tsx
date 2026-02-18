import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Platform } from 'react-native'
import { Canvas, Circle, Group, Blur, Skia, Paint, LinearGradient, vec } from '@shopify/react-native-skia'
import { useVoiceAssistant } from '../hooks/useVoiceAssistant'
import { voiceColors } from '../styles/voiceTheme'

type SiriSphereProps = {
  state: 'idle' | 'listening' | 'processing' | 'speaking' | string
  audioLevel: number
  size?: number
}

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function generateParticles(count: number, radius: number) {
  return Array.from({ length: count }).map(() => ({
    angle: Math.random() * Math.PI * 2,
    speed: randBetween(0.2, 1.2),
    offset: randBetween(0, Math.PI * 2),
    dist: randBetween(radius * 0.7, radius * 1.6),
    size: randBetween(1.2, 3.2),
    hue: Math.random() < 0.6 ? voiceColors.primary : '#ffffff',
  }))
}

export const SiriSphere: React.FC<SiriSphereProps> = ({ state, audioLevel, size = 100 }) => {
  // Defensive: if Skia native bindings are not available or misbehaving
  // avoid calling any Skia factories (which can throw JSI errors about ArrayBuffer)
  const SKIA_AVAILABLE = typeof Skia !== 'undefined' && !!Canvas && !!Circle && !!Group
  if (!SKIA_AVAILABLE) {
    // Render a simple React Native fallback so the app remains usable
    const fallbackRadius = size
    const backgroundColor = voiceColors.primary
    return (
      <View style={{ width: fallbackRadius * 2, height: fallbackRadius * 2, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: fallbackRadius * 1.6, height: fallbackRadius * 1.6, borderRadius: fallbackRadius * 0.8, backgroundColor: backgroundColor, opacity: 0.18 }} />
        <View style={{ position: 'absolute', width: fallbackRadius, height: fallbackRadius, borderRadius: fallbackRadius / 2, backgroundColor: backgroundColor }} />
      </View>
    )
  }
  const [particles, setParticles] = useState(() => generateParticles(64, size))
  const rafRef = useRef<number | null>(null)
  const tRef = useRef<number>(0)

  const center = size * 1.15
  const canvasSize = center * 2
  const baseRadius = size

  // performance: throttle updates
  useEffect(() => {
    let last = 0
    function step(ts: number) {
      const dt = ts - last
      last = ts
      tRef.current += dt / 1000

      // update particles positions on a small interval
      setParticles((prev) =>
        prev.map((p) => {
          // speed modifier by state and audioLevel
          const stateSpeed = state === 'processing' ? 2.4 : state === 'listening' ? 1.6 : state === 'speaking' ? 1.2 : 0.6
          const audioBoost = 1 + audioLevel * 2
          const angle = p.angle + (p.speed * stateSpeed * audioBoost * (dt / 1000))
          return { ...p, angle }
        })
      )

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [state, audioLevel])

  // size multiplier per state
  const sizeMult = useMemo(() => {
    switch (state) {
      case 'listening':
        return 1.18
      case 'processing':
        return 1.08
      case 'speaking':
        return 1.12
      default:
        return 1.0
    }
  }, [state])

  // glow opacity
  const glow = state === 'listening' ? 0.95 : state === 'processing' ? 0.85 : 0.6

  return (
    <View style={{ width: canvasSize, height: canvasSize, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ width: canvasSize, height: canvasSize }}>
        <Group>
          {/* Outer glow */}
          <Circle cx={center} cy={center} r={baseRadius * sizeMult * 1.6}>
            <Paint color={voiceColors.primary} style="fill" opacity={glow} />
            <Blur blur={Platform.OS === 'android' ? 14 : 20} />
          </Circle>

          {/* Main gradient sphere */}
          <Circle cx={center} cy={center} r={baseRadius * sizeMult}>
            <LinearGradient
              start={vec(center - baseRadius, center - baseRadius)}
              end={vec(center + baseRadius, center + baseRadius)}
              colors={[voiceColors.primary, voiceColors.secondary]}
            />
            <Paint style="fill" />
          </Circle>

          {/* Subtle inner glossy highlight */}
          <Circle cx={center - baseRadius * 0.35} cy={center - baseRadius * 0.45} r={baseRadius * 0.42}>
            <Paint color={'rgba(255,255,255,0.05)'} style="fill" />
            <Blur blur={6} />
          </Circle>

          {/* Particles */}
          {particles.map((p, i) => {
            const x = center + Math.cos(p.angle + p.offset) * p.dist
            const y = center + Math.sin(p.angle + p.offset) * p.dist * 0.9
            const opacity = 0.3 + Math.abs(Math.sin(p.angle * 2 + i)) * 0.7
            return (
              <Circle key={`pt-${i}`} cx={x} cy={y} r={p.size}>
                <Paint color={p.hue} style="fill" opacity={opacity} />
              </Circle>
            )
          })}
        </Group>
      </Canvas>
    </View>
  )
}

export default SiriSphere
