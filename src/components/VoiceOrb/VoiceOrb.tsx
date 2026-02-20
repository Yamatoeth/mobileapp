import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import WebView, { WebViewMessageEvent } from 'react-native-webview'
import { Audio } from 'expo-av'
import { Asset } from 'expo-asset'
import { useState } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceOrbProps {
  state: OrbState
  audioLevel?: number
  style?: ViewStyle
  onMicReady?: () => void
}

const STATE_MAP: Record<OrbState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
}

export default function VoiceOrb({ state, audioLevel, style, onMicReady }: VoiceOrbProps) {
  const webRef = useRef<WebView>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const [htmlUri, setHtmlUri] = useState<string | null>(null)

  useEffect(() => {
    const n = STATE_MAP[state]
    webRef.current?.injectJavaScript(`window.setOrbState(${n}); true;`)
    if (state === 'listening') {
      startNativeMic()
    } else {
      stopNativeMic()
    }
  }, [state])

  useEffect(() => {
    if (typeof audioLevel === 'number') {
      const v = Math.max(0, Math.min(1, audioLevel))
      webRef.current?.injectJavaScript(`window.setAudioLevel(${v}); true;`)
    }
  }, [audioLevel])

  useEffect(() => {
    return () => {
      try {
        webRef.current?.injectJavaScript(
          `window.setOrbState(0); window.stopMicInternal && window.stopMicInternal(); true;`
        )
      } catch (_) {}
      try { stopNativeMic() } catch (_) {}
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const asset = Asset.fromModule(require('./voiceorb.html'))
      await asset.downloadAsync()
      if (mounted) setHtmlUri(asset.localUri || null)
    })()
    return () => { mounted = false }
  }, [])

  async function startNativeMic() {
    try {
      const p = await Audio.requestPermissionsAsync()
      if (!p.granted) {
        console.warn('[VoiceOrb] microphone permission not granted')
        return
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY)

      recording.setOnRecordingStatusUpdate((status: any) => {
        try {
          let level = 0
          if (typeof status?.metering === 'number') {
            level = Math.min(1, Math.max(0, (status.metering + 100) / 100))
          }
          webRef.current?.injectJavaScript(`window.setAudioLevel(${level}); true;`)
        } catch (err) {
          console.warn('[VoiceOrb] recording status handler error', err)
        }
      })

      await recording.startAsync()
      recordingRef.current = recording
      onMicReady?.()
    } catch (err) {
      console.warn('[VoiceOrb] Native mic start error', err)
    }
  }

  async function stopNativeMic() {
    try {
      const rec = recordingRef.current
      if (rec) {
        try { rec.setOnRecordingStatusUpdate(null) } catch (_) {}
        try { await rec.stopAndUnloadAsync() } catch (_) {}
        recordingRef.current = null
      }
      try {
        webRef.current?.injectJavaScript(
          `window.setAudioLevel(0); window.stopMicInternal && window.stopMicInternal(); true;`
        )
      } catch (_) {}
    } catch (err) {
      console.warn('[VoiceOrb] Native mic stop error', err)
    }
  }

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data)
      if (!data) return
      if (data.type === 'mic-ready') {
        onMicReady?.()
      }
      if (data.type === 'log') console.log('[VoiceOrb]', data.message)
      if (data.type === 'warn') console.warn('[VoiceOrb]', data.message)
      if (data.type === 'error') console.error('[VoiceOrb]', data.message)
    } catch (_) {}
  }

  return (
    <View style={[styles.host, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        // Load the HTML file as a local asset — no CDN, no network dependency
        source={htmlUri ? { uri: htmlUri } : undefined}
        onMessage={handleMessage}
        style={styles.web}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})