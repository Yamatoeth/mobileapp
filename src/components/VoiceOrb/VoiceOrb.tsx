import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, ViewStyle, Platform } from 'react-native'
import WebView, { WebViewMessageEvent } from 'react-native-webview'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { useState } from 'react'
import { audioRecordingService } from '../../services/audioRecording'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceOrbProps {
  state: OrbState
  audioLevel?: number
  style?: ViewStyle
}

const STATE_MAP: Record<OrbState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
}

export default function VoiceOrb({ state, audioLevel, style }: VoiceOrbProps) {
  const webRef = useRef<WebView>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)

  useEffect(() => {
    const n = STATE_MAP[state]
    webRef.current?.injectJavaScript(`window.setOrbState(${n}); true;`)
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
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const asset = Asset.fromModule(require('./voiceorb.html'))
        await asset.downloadAsync()
        if (asset.localUri) {
          const html = await FileSystem.readAsStringAsync(asset.localUri)
          if (mounted) setHtmlContent(html)
        } else {
          if (mounted) setHtmlContent(null)
        }
      } catch (err) {
        if (mounted) setHtmlContent(null)
        console.warn('[VoiceOrb] Failed to load HTML asset', err)
      }
    })()
    return () => { mounted = false }
  }, [])




  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data)
      if (!data) return
      if (data.type === 'log') console.log('[VoiceOrb]', data.message)
      if (data.type === 'warn') {
        if (typeof data.message === 'string' && 
            (data.message.includes('getUserMedia') || data.message.includes('mediaDevices'))) return
        console.warn('[VoiceOrb]', data.message)
      }
      if (data.type === 'error') {
        if (typeof data.message === 'string' && 
            (data.message.includes('getUserMedia') || data.message.includes('mediaDevices'))) return
        console.error('[VoiceOrb]', data.message)
      }
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
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            var noop = function() { return new Promise(function() {}); };
            if (typeof navigator !== 'undefined') {
              try {
                Object.defineProperty(navigator, 'mediaDevices', {
                  value: { getUserMedia: noop, enumerateDevices: function() { return Promise.resolve([]); } },
                  writable: false,
                  configurable: false
                });
              } catch(e) {}
            }
            if (typeof window !== 'undefined') {
              window.getUserMedia = noop;
              window.webkitGetUserMedia = noop;
              navigator.getUserMedia = noop;
              navigator.webkitGetUserMedia = noop;
            }
          })();
          true;
        `}
        // Load the HTML file as a string for both iOS and Android
        source={htmlContent ? { html: htmlContent } : undefined}
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