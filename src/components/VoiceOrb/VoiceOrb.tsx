import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import WebView, { WebViewMessageEvent } from 'react-native-webview'
import { Audio } from 'expo-av'
import { Asset } from 'expo-asset'
import { useState } from 'react'
import { audioRecordingService } from '../../services/audioRecording'

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
  const recordingRef = useRef<any>(null)
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
      // Delegate permission request and recording lifecycle to audioRecordingService.
      const started = await audioRecordingService.startRecording((statusOrLevel: any) => {
        try {
          let level = 0
          // service may pass normalized level object or raw status
          if (typeof statusOrLevel === 'number') {
            level = Math.min(1, Math.max(0, statusOrLevel))
          } else if (statusOrLevel && typeof statusOrLevel.level === 'number') {
            level = Math.min(1, Math.max(0, statusOrLevel.level))
          }
          webRef.current?.injectJavaScript(`window.setAudioLevel(${level}); true;`)
        } catch (err) {
          console.warn('[VoiceOrb] recording status handler error', err)
        }
      })

      if (started) {
        recordingRef.current = true
        onMicReady?.()
      }
    } catch (err) {
      console.warn('[VoiceOrb] Native mic start error', err)
    }
  }

  async function stopNativeMic() {
    try {
      if (audioRecordingService.isRecording()) {
        try {
          await audioRecordingService.stopRecording()
        } catch (_) {}
      } else {
        try {
          await audioRecordingService.cancelRecording()
        } catch (_) {}
      }
      recordingRef.current = null
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