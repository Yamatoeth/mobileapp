/**
 * Text-to-Speech Service
 * Supports both ElevenLabs and OpenAI TTS APIs
 */
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

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

    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: options.text,
          model_id: 'eleven_turbo_v2', // Fastest model
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    // Convert response to base64 and save to file
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

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

    const response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1', // Use tts-1-hd for higher quality but slower
        input: options.text,
        voice,
        speed: options.speed ?? 1.0,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI TTS error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    // Convert response to base64 and save to file
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

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
  private sound: Audio.Sound | null = null;
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
        (status) => {
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
