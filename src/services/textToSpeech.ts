/**
 * Text-to-Speech Service
 * Supports both ElevenLabs and OpenAI TTS APIs
 */
// Import expo-audio at runtime to avoid TS export mismatches across SDKs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Audio: any = require('expo-audio')
// Use permissive playback types
type AVPlaybackStatus = any
type Sound = any
import * as FileSystem from 'expo-file-system/legacy';
// Buffer for base64 conversion
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Buffer } = require('buffer')

// XHR fallback to reliably fetch ArrayBuffer in React Native environments
async function fetchArrayBufferViaXHR(url: string, opts: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore - global XMLHttpRequest available in React Native runtime
      const xhr = new XMLHttpRequest()
      xhr.open(opts.method || 'GET', url, true)
      xhr.responseType = 'arraybuffer'
      const headers = opts.headers || {}
      Object.keys(headers).forEach((k) => {
        try {
          xhr.setRequestHeader(k, String(headers[k]))
        } catch (e) {
          // ignore header set errors
        }
      })
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response)
        } else {
          reject(new Error(`XHR failed: ${xhr.status} ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error('XHR network error'))
      if (opts.body != null) {
        xhr.send(opts.body)
      } else {
        xhr.send()
      }
    } catch (err) {
      reject(err)
    }
  })
}

import { toUint8Array } from '../utils/binary'

// Robustly convert a Response into a Uint8Array, trying multiple strategies
async function bufferFromResponse(resp: Response, xhrRetry?: () => Promise<ArrayBuffer>): Promise<Uint8Array> {
  const tryConvert = (ab: any) => {
    const u8 = toUint8Array(ab)
    return u8 && u8.length ? u8 : null
  }

  // 1) resp.arrayBuffer()
  if (resp && typeof (resp as any).arrayBuffer === 'function') {
    try {
      const ab = await (resp as any).arrayBuffer()
      const b = tryConvert(ab)
      if (b) return b
    } catch (e) {
      // continue to other strategies
    }
  }

  // 2) resp.body stream (ReadableStream)
  if (resp && (resp as any).body && typeof (resp as any).body.getReader === 'function') {
    try {
      const reader = (resp as any).body.getReader()
      const chunks: Uint8Array[] = []
      let totalLength = 0
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          const v = value instanceof Uint8Array ? value : new Uint8Array(value)
          chunks.push(v)
          totalLength += v.byteLength
        }
      }
      const out = new Uint8Array(totalLength)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.byteLength
      }
      return out
    } catch (e) {
      // continue
    }
  }

  // 3) resp.blob()
  if (resp && typeof (resp as any).blob === 'function') {
    try {
      const blob = await (resp as any).blob()
      if (blob && typeof (blob as any).arrayBuffer === 'function') {
        const ab = await (blob as any).arrayBuffer()
        const b = tryConvert(ab)
        if (b) return b
      }
    } catch (e) {
      // continue
    }
  }

  // 4) resp.text() as last resort if content-type isn't JSON
  try {
    const text = await resp.text()
    const contentType = (resp.headers && typeof resp.headers.get === 'function') ? resp.headers.get('content-type') || '' : ''
    if (contentType.includes('application/json') || text.trim().startsWith('{')) {
      throw new Error('Expected binary response but received JSON/text: ' + text.slice(0, 500))
    }
    return toUint8Array(Buffer.from(text, 'binary'))
  } catch (err) {
    // If provided, try XHR retry which is often reliable in RN
    if (typeof xhrRetry === 'function') {
      const ab = await xhrRetry()
      const b = tryConvert(ab)
      if (b) return b
    }

    // Provide debug preview
    let preview = ''
    try {
      preview = await resp.text()
    } catch (_) {
      preview = '<unable to read text preview>'
    }
    console.error('[textToSpeech] bufferFromResponse failed', { error: String(err), preview })
    throw new Error('Failed to obtain binary response: ' + String(err) + ' — preview: ' + preview)
  }
}

// ============================================
// Types
// ============================================

export type TTSProvider = 'elevenlabs' | 'openai';

export interface TTSConfig {
  provider: TTSProvider;
  apiKey: string;
  voiceId?: string;
  model?: string;
}

export interface SynthesizeOptions {
  text: string;
  voiceId?: string;
  speed?: number; // 0.5 - 2.0
  stability?: number; // 0 - 1 (ElevenLabs only)
  similarityBoost?: number; // 0 - 1 (ElevenLabs only)
}

export interface SynthesizeResult {
  audioUri: string;
  durationMs: number;
  provider: TTSProvider;
}

// ============================================
// ElevenLabs Configuration
// ============================================

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// J.A.R.V.I.S. inspired voice options
const ELEVENLABS_VOICES = {
  // Professional, calm male voices
  'jarvis-like': '21m00Tcm4TlvDq8ikWAM', // Rachel (clear, professional)
  adam: 'pNInz6obpgDQGcFmaJgB', // Adam (deep, authoritative)
  antoni: 'ErXwobaYiN019PkySvjV', // Antoni (warm, conversational)
  josh: 'TxGEqnHWrfWFTfGW9XjX', // Josh (dynamic, expressive)
  // Default to a calm, professional voice
  default: '21m00Tcm4TlvDq8ikWAM',
} as const;

// ============================================
// OpenAI TTS Configuration
// ============================================

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

const OPENAI_VOICES = {
  alloy: 'alloy', // Neutral, balanced
  echo: 'echo', // Warm, conversational
  fable: 'fable', // British, expressive
  onyx: 'onyx', // Deep, authoritative - good for J.A.R.V.I.S.
  nova: 'nova', // Friendly, youthful
  shimmer: 'shimmer', // Warm, confident
  default: 'onyx', // Default to authoritative voice
} as const;

// ============================================
// ElevenLabs Service
// ============================================

class ElevenLabsService {
  private apiKey: string;
  private defaultVoiceId: string;

  constructor(apiKey: string, voiceId?: string) {
    this.apiKey = apiKey;
    this.defaultVoiceId = voiceId || ELEVENLABS_VOICES.default;
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const startTime = Date.now();
    const voiceId = options.voiceId || this.defaultVoiceId;

    const url = `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`
    const payload = JSON.stringify({
      text: options.text,
      model_id: 'eleven_turbo_v2', // Fastest model
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    })
    const headersObj: Record<string, string> = {
      'Content-Type': 'application/json',
      'xi-api-key': this.apiKey,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headersObj,
      body: payload,
    })

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Convert response to binary Buffer (robust across RN runtimes)
    const base64U8 = await bufferFromResponse(response, () => fetchArrayBufferViaXHR(url, { method: 'POST', headers: headersObj, body: payload }))
    const base64 = Buffer.from(base64U8).toString('base64')

    const audioUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(audioUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const durationMs = Date.now() - startTime;

    return {
      audioUri,
      durationMs,
      provider: 'elevenlabs',
    };

  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<{ voice_id: string; name: string }[]> {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices || [];
  }
}

// ============================================
// OpenAI TTS Service
// ============================================

class OpenAITTSService {
  private apiKey: string;
  private defaultVoice: string;

  constructor(apiKey: string, voice?: string) {
    this.apiKey = apiKey;
    this.defaultVoice = voice || OPENAI_VOICES.default;
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const startTime = Date.now();
    const voice = options.voiceId || this.defaultVoice;

    const url = OPENAI_TTS_URL
    const payload = JSON.stringify({
      model: 'tts-1', // Use tts-1-hd for higher quality but slower
      input: options.text,
      voice,
      speed: options.speed ?? 1.0,
      response_format: 'mp3',
    })
    const headersObj: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headersObj,
      body: payload,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI TTS error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const base64U8 = await bufferFromResponse(response, () => fetchArrayBufferViaXHR(url, { method: 'POST', headers: headersObj, body: payload }))
    const base64 = Buffer.from(base64U8).toString('base64')

    const audioUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(audioUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const durationMs = Date.now() - startTime;

    return {
      audioUri,
      durationMs,
      provider: 'openai',
    };
  }
}

// ============================================
// Main TTS Service
// ============================================

class TextToSpeechService {
  private config: TTSConfig | null = null;
  private elevenlabs: ElevenLabsService | null = null;
  private openai: OpenAITTSService | null = null;

  /**
   * Configure the TTS service
   */
  configure(config: TTSConfig): void {
    this.config = config;

    if (config.provider === 'elevenlabs') {
      this.elevenlabs = new ElevenLabsService(config.apiKey, config.voiceId);
    } else if (config.provider === 'openai') {
      this.openai = new OpenAITTSService(config.apiKey, config.voiceId);
    }
  }

  /**
   * Auto-configure from environment
   */
  autoConfigureFromEnv(): boolean {
    const elevenlabsKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
    const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (elevenlabsKey) {
      this.configure({
        provider: 'elevenlabs',
        apiKey: elevenlabsKey,
      });
      return true;
    } else if (openaiKey) {
      this.configure({
        provider: 'openai',
        apiKey: openaiKey,
      });
      return true;
    }

    return false;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.config !== null && (this.elevenlabs !== null || this.openai !== null);
  }

  /**
   * Get current provider
   */
  getProvider(): TTSProvider | null {
    return this.config?.provider || null;
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.config) {
      // Try auto-configure
      if (!this.autoConfigureFromEnv()) {
        throw new Error('TTS service not configured. Set EXPO_PUBLIC_ELEVENLABS_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY');
      }
    }

    if (this.config!.provider === 'elevenlabs' && this.elevenlabs) {
      return this.elevenlabs.synthesize(options);
    } else if (this.config!.provider === 'openai' && this.openai) {
      return this.openai.synthesize(options);
    }

    throw new Error(`TTS provider not initialized: ${this.config?.provider}`);
  }

  /**
   * Quick synthesize with just text
   */
  async speak(text: string): Promise<SynthesizeResult> {
    return this.synthesize({ text });
  }
}

// ============================================
// Audio Playback Service
// ============================================

class AudioPlaybackService {
  private sound: Sound | null = null;
  private isPlaying: boolean = false;
  private onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null;

  /**
   * Initialize audio settings
   */
  async initialize(): Promise<void> {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }

  /**
   * Play audio from URI
   */
  async play(
    audioUri: string,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Stop any currently playing audio
      await this.stop();

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              this.isPlaying = false;
              onComplete?.();
            }
          }
          this.onPlaybackStatusUpdate?.(status);
        }
      );

      this.sound = sound;
      this.isPlaying = true;
    } catch (error) {
      this.isPlaying = false;
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (this.sound && this.isPlaying) {
      await this.sound.pauseAsync();
      this.isPlaying = false;
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (this.sound && !this.isPlaying) {
      await this.sound.playAsync();
      this.isPlaying = true;
    }
  }

  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
    }
  }

  /**
   * Set playback status callback
   */
  setOnPlaybackStatusUpdate(callback: (status: AVPlaybackStatus) => void): void {
    this.onPlaybackStatusUpdate = callback;
  }

  /**
   * Check if audio is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get playback position
   */
  async getPosition(): Promise<number | null> {
    if (!this.sound) return null;
    const status = await this.sound.getStatusAsync();
    if (status.isLoaded) {
      return status.positionMillis;
    }
    return null;
  }

  /**
   * Set playback speed
   */
  async setSpeed(speed: number): Promise<void> {
    if (this.sound) {
      await this.sound.setRateAsync(speed, true);
    }
  }
}

// ============================================
// Combined Voice Output Service
// ============================================

class VoiceOutputService {
  private tts: TextToSpeechService;
  private playback: AudioPlaybackService;
  private isInitialized: boolean = false;

  constructor() {
    this.tts = new TextToSpeechService();
    this.playback = new AudioPlaybackService();
  }

  /**
   * Initialize the voice output service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.playback.initialize();
    this.isInitialized = true;
  }

  /**
   * Configure TTS provider
   */
  configure(config: TTSConfig): void {
    this.tts.configure(config);
  }

  /**
   * Speak text out loud
   */
  async speak(
    text: string,
    options?: {
      onStart?: () => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
      voiceId?: string;
      speed?: number;
    }
  ): Promise<void> {
    await this.initialize();

    try {
      options?.onStart?.();

      // Synthesize speech
      const result = await this.tts.synthesize({
        text,
        voiceId: options?.voiceId,
        speed: options?.speed,
      });

      // Play the audio
      await this.playback.play(
        result.audioUri,
        options?.onComplete,
        options?.onError
      );
    } catch (error) {
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop speaking
   */
  async stop(): Promise<void> {
    await this.playback.stop();
  }

  /**
   * Pause speaking
   */
  async pause(): Promise<void> {
    await this.playback.pause();
  }

  /**
   * Resume speaking
   */
  async resume(): Promise<void> {
    await this.playback.resume();
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.playback.getIsPlaying();
  }

  /**
   * Get TTS service for advanced usage
   */
  getTTSService(): TextToSpeechService {
    return this.tts;
  }

  /**
   * Get playback service for advanced usage
   */
  getPlaybackService(): AudioPlaybackService {
    return this.playback;
  }
}

// ============================================
// Export singletons and types
// ============================================

export const textToSpeechService = new TextToSpeechService();
export const audioPlaybackService = new AudioPlaybackService();
export const voiceOutputService = new VoiceOutputService();

// Export classes for direct instantiation
export {
  TextToSpeechService,
  ElevenLabsService,
  OpenAITTSService,
  AudioPlaybackService,
  VoiceOutputService,
};

// Export voice presets
export { ELEVENLABS_VOICES, OPENAI_VOICES };
