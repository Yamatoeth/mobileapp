import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import { Canvas, Circle, Group } from '@shopify/react-native-skia'
import { View } from 'react-native'

type Particle = {
  phi: number
  thetaBase: number
  size: number
  phase: number
  speed: number
}

const { width: screenWidth } = Dimensions.get('window')
const SPHERE_SIZE = Math.min(screenWidth * 0.88, 340)
const R = SPHERE_SIZE * 0.42
const CX = SPHERE_SIZE / 2
const CY = SPHERE_SIZE / 2
const N = 500

type Props = {
  listening: boolean
  style?: any
}

export default function ParticleSphere({ listening }: Props) {
  const rotX = 0.28

  const particles = useMemo<Particle[]>(() => {
    const out: Particle[] = []
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / N)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const size = 0.8 + Math.random() * (3.0 - 0.8)
      const phase = Math.random() * Math.PI * 2
      const speed = 0.7 + Math.random() * 0.6
      out.push({ phi, thetaBase: theta, size, phase, speed })
    }
    return out
  }, [])
  // animation state refs
  const rotYRef = useRef(0)
  const energyRef = useRef(0)
  const targetRef = useRef(0)
  const tRef = useRef(0)
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    targetRef.current = listening ? 1 : 0
  }, [listening])

  // tick state triggers re-render each frame
  const [, setTick] = useState(0)

  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      if (lastRef.current == null) lastRef.current = now
      const dt = Math.min(0.05, (now - (lastRef.current || now)) / 1000)
      lastRef.current = now
      rotYRef.current += 0.004 + energyRef.current * 0.012
      energyRef.current += (targetRef.current - energyRef.current) * 0.045
      tRef.current += dt
      // frame logging (throttle)
      // log every ~30 frames by using tRef time instead of a frame counter
      if (Math.floor(tRef.current * 30) % 30 === 0) {
        console.log('ParticleSphere frame', tRef.current)
      }
      setTick((t) => t + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // compute renderable particles each render
  const rotY = rotYRef.current
  const energy = energyRef.current
  const t = tRef.current

  const depthSorted = useMemo(() => {
    return particles
      .map((p) => {
        const theta_final = p.thetaBase + rotY * p.speed
        const x = R * Math.sin(p.phi) * Math.cos(theta_final)
        const y = R * Math.sin(p.phi) * Math.sin(theta_final)
        const z = R * Math.cos(p.phi)
        const y2 = y * Math.cos(rotX) - z * Math.sin(rotX)
        const z2 = y * Math.sin(rotX) + z * Math.cos(rotX)
        const sx = CX + x
        const sy = CY - y2
        const depth = z2
        return { p, sx, sy, depth, zPrime: z2 }
      })
      .sort((a, b) => a.depth - b.depth)
  }, [particles, rotY, t, energy])

  useEffect(() => {
    console.log('SPHERE_SIZE', SPHERE_SIZE)
  }, [])

  // log first projected particle for debug
  useEffect(() => {
    if (depthSorted && depthSorted.length > 0) {
      const first = depthSorted[0]
      if (first) console.log('first projected particle', first.sx, first.sy)
    }
  }, [depthSorted])

  return (
    <Canvas style={{ width: SPHERE_SIZE, height: SPHERE_SIZE, backgroundColor: 'transparent' }}>
      {/* background glow */}
      <Group>
        <Circle cx={CX} cy={CY} r={R * 1.6} color={`rgba(0,120,255,${0.12 + energy * 0.22})`} />
        <Circle cx={CX} cy={CY} r={R * 1.08} color={`rgba(0,180,255,${0.15 + energy * 0.25})`} style="stroke" strokeWidth={1.2} />

        {depthSorted.map((item, idx) => {
          const { p, sx, sy, depth, zPrime } = item
          const normZ = zPrime / R
          const lat = (normZ + 1) * 0.5
          const wave = Math.sin(lat * Math.PI * 2.5 - t * 2.2 + p.phase) * 0.5 + 0.5
          const wave2 = Math.sin(lat * Math.PI * 5 - t * 3.5 + p.phase * 2) * 0.3 + 0.7

          let r = 0
          let g = 0
          let b = 0
          const f = (lat - 0) / 1
          if (lat > 0.6) {
            r = 0
            g = 180 * (1 - f)
            b = 255
          } else if (lat > 0.3) {
            r = 100 * (1 - f)
            g = 180 * f
            b = 255
          } else {
            r = 200 * (1 - f)
            g = 0
            b = 180 + 75 * f
          }
          const brightness = 0.5 + wave * 0.4 + wave2 * 0.15 + energy * 0.35
          let rr = r * brightness + energy * 60
          let gg = g * brightness + energy * 30
          let bb = b * brightness + energy * 50
          rr = Math.min(255, rr)
          gg = Math.min(255, gg)
          bb = Math.min(255, bb)

          const df = (depth / R + 1) * 0.5
          const pulse = listening
            ? 1 + Math.sin(t * 7 * p.speed + p.phase) * 0.5 * energy
            : 1 + Math.sin(t * 0.8 * p.speed + p.phase) * 0.12
          const s = p.size * (0.45 + df * 1.2) * pulse
          const alpha = 0.2 + df * 0.95

          const color = `rgba(${Math.round(rr)},${Math.round(gg)},${Math.round(bb)},${alpha})`

          return (
            <Group key={idx}>
              {/* glow halo (simple, without blur) */}
              {df > 0.6 && s > 0.8 ? (
                <Circle cx={sx} cy={sy} r={s * 3.5} color={`rgba(0,200,255,${0.06 + 0.1 * energy})`} />
              ) : null}
              <Circle cx={sx} cy={sy} r={Math.max(0.3, s)} color={color} />
            </Group>
          )
        })}
      </Group>
    </Canvas>
  )
}
