/**
 * Audio playback service for backend-generated voice responses.
 */
const { Audio }: any = require('expo-av')

type AVPlaybackStatus = any
type Sound = any
import * as FileSystem from 'expo-file-system/legacy'

class AudioPlaybackService {
  private sound: Sound | null = null
  private isPlaying = false
  private onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null

  async initialize(): Promise<void> {
    console.log('[audioPlayback] initialize: setting audio mode')
    await Audio.setAudioModeAsync({
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

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            this.isPlaying = false
            console.log('[audioPlayback] didJustFinish', audioUri, { ts: Date.now() })
            onComplete?.()
          }
          this.onPlaybackStatusUpdate?.(status)
        }
      )

      this.sound = sound
      this.isPlaying = true
    } catch (error) {
      this.isPlaying = false
      console.error('[audioPlayback] play error', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  async pause(): Promise<void> {
    if (this.sound && this.isPlaying) {
      await this.sound.pauseAsync()
      this.isPlaying = false
    }
  }

  async resume(): Promise<void> {
    if (this.sound && !this.isPlaying) {
      await this.sound.playAsync()
      this.isPlaying = true
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      console.log('[audioPlayback] stop called', { ts: Date.now() })
      try {
        await this.sound.stopAsync()
      } catch {}
      try {
        await this.sound.unloadAsync()
      } catch {}
      this.sound = null
      this.isPlaying = false
      console.log('[audioPlayback] stop completed', { ts: Date.now() })
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: AVPlaybackStatus) => void): void {
    this.onPlaybackStatusUpdate = callback
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  async getPosition(): Promise<number | null> {
    if (!this.sound) return null
    const status = await this.sound.getStatusAsync()
    if (status.isLoaded) {
      return status.positionMillis
    }
    return null
  }

  async setSpeed(speed: number): Promise<void> {
    if (this.sound) {
      await this.sound.setRateAsync(speed, true)
    }
  }
}

export const audioPlaybackService = new AudioPlaybackService()

export {
  AudioPlaybackService,
}
