import React, {useEffect} from 'react'
import {View, StyleSheet} from 'react-native'
import Animated, {useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate, Extrapolate} from 'react-native-reanimated'
import COLORS from '../styles/colors'

type Props = {
  size?: number
  color?: string
}

export default function ArcReactor({size = 140, color = COLORS.accent}: Props) {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withRepeat(withTiming(1, {duration: 1500}), -1, false)
    opacity.value = withRepeat(withTiming(0.1, {duration: 1500}), -1, false)
  }, [])

  const pulseStyle = useAnimatedStyle(() => {
    const s = interpolate(scale.value, [0, 1], [0.6, 1.6], Extrapolate.CLAMP)
    const o = interpolate(opacity.value, [0, 1], [0.9, 0.05], Extrapolate.CLAMP)
    return {
      transform: [{scale: s}],
      opacity: o,
    }
  })

  return (
    <View style={[styles.container, {width: size, height: size}]}> 
      <Animated.View style={[styles.pulse, pulseStyle, {borderColor: color, width: size, height: size, borderRadius: size / 2}]} />
      <View style={[styles.core, {width: size * 0.46, height: size * 0.46, borderRadius: (size * 0.46) / 2, backgroundColor: color}]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
})
