/**
 * Audio playback service for backend-generated voice responses.
 */
const ExpoAudio: any = require('expo-audio')

type AudioPlaybackStatus = any
type AudioPlayer = any
import * as FileSystem from 'expo-file-system/legacy'

class AudioPlaybackService {
  private player: AudioPlayer | null = null
  private playbackSubscription: { remove: () => void } | null = null
  private isPlaying = false
  private onPlaybackStatusUpdate: ((status: AudioPlaybackStatus) => void) | null = null

  async initialize(): Promise<void> {
    console.log('[audioPlayback] initialize: setting audio mode')
    await ExpoAudio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    })
  }

  async play(
    audioUri: string,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      await this.stop()

      try {
        const info = await FileSystem.getInfoAsync(audioUri)
        console.log('[audioPlayback] play start:', audioUri, {
          ts: Date.now(),
          size: info.exists ? info.size : null,
        })
      } catch {
        console.log('[audioPlayback] play start (no file info):', audioUri, {
          ts: Date.now(),
        })
      }

      const player = ExpoAudio.createAudioPlayer({ uri: audioUri }, { updateInterval: 250 })
      this.playbackSubscription = player.addListener?.(
        'playbackStatusUpdate',
        (status: AudioPlaybackStatus) => {
          if (status.didJustFinish) {
            this.isPlaying = false
            console.log('[audioPlayback] didJustFinish', audioUri, { ts: Date.now() })
            onComplete?.()
          }
          this.onPlaybackStatusUpdate?.(status)
        }
      )

      player.play()
      this.player = player
      this.isPlaying = true
    } catch (error) {
      this.isPlaying = false
      console.error('[audioPlayback] play error', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  async pause(): Promise<void> {
    if (this.player && this.isPlaying) {
      this.player.pause()
      this.isPlaying = false
    }
  }

  async resume(): Promise<void> {
    if (this.player && !this.isPlaying) {
      this.player.play()
      this.isPlaying = true
    }
  }

  async stop(): Promise<void> {
    if (this.player) {
      console.log('[audioPlayback] stop called', { ts: Date.now() })
      try {
        this.player.pause()
      } catch {}
      try {
        this.playbackSubscription?.remove()
      } catch {}
      try {
        this.player.remove()
      } catch {}
      this.playbackSubscription = null
      this.player = null
      this.isPlaying = false
      console.log('[audioPlayback] stop completed', { ts: Date.now() })
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: AudioPlaybackStatus) => void): void {
    this.onPlaybackStatusUpdate = callback
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  async getPosition(): Promise<number | null> {
    if (!this.player) return null
    return Math.round((this.player.currentTime || 0) * 1000)
  }

  async setSpeed(speed: number): Promise<void> {
    if (this.player) {
      this.player.setPlaybackRate?.(speed, 'high')
    }
  }
}

export const audioPlaybackService = new AudioPlaybackService()

export {
  AudioPlaybackService,
}
