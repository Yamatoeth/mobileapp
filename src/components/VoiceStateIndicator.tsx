import React from 'react'
import {View, Text, StyleSheet} from 'react-native'
import {GestureResponderEvent, TouchableOpacity} from 'react-native'
import COLORS from '../styles/colors'

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking'

type Props = {
  state: VoiceState
  onPress?: (e: GestureResponderEvent) => void
}

export default function VoiceStateIndicator({state, onPress}: Props) {
  const getColor = () => {
    switch (state) {
      case 'recording':
        return '#FF4D4D'
      case 'processing':
        return COLORS.accentAlt
      case 'speaking':
        return COLORS.accent
      default:
        return COLORS.textMuted
    }
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.wrapper} activeOpacity={0.8}>
      <View style={[styles.indicator, {borderColor: getColor()}]} />
      <Text style={styles.label}>{state.toUpperCase()}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  label: {
    color: COLORS.white,
    fontSize: 12,
    letterSpacing: 0.6,
  },
})
