/**
 * Speech-to-Text Service
 * Supports both Deepgram and OpenAI Whisper APIs
 */
import * as FileSystem from 'expo-file-system/legacy';

// ============================================
// Types
// ============================================

export interface TranscriptionResult {
  text: string;
  confidence: number;
  durationMs: number;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export type STTProvider = 'deepgram' | 'whisper';

interface STTConfig {
  provider: STTProvider;
  apiKey: string;
  language?: string;
  model?: string;
}

// ============================================
// API Endpoints
// ============================================

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

// ============================================
// Deepgram Service
// ============================================

class DeepgramService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioUri: string,
    language: string = 'en'
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    console.log('[speechToText] transcribe called', { audioUri, language, ts: startTime });

    // Read audio file as base64
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    console.log('[speechToText] file info', { exists: fileInfo.exists, size: fileInfo.size, uri: audioUri });
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Build query parameters
    const params = new URLSearchParams({
      model: 'nova-2',
      language,
      punctuate: 'true',
      smart_format: 'true',
    });

    const response = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: bytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[speechToText] Deepgram API error', { status: response.status, body: errorText });
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;
    console.log('[speechToText] Deepgram transcribe completed', { durationMs });

    // Extract transcription from Deepgram response
    const alternative = result.results?.channels?.[0]?.alternatives?.[0];

    if (!alternative) {
      return {
        text: '',
        confidence: 0,
        durationMs,
      };
    }

    // Extract words if available
    const words: TranscriptionWord[] = (alternative.words || []).map(
      (w: { word: string; start: number; end: number; confidence: number }) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })
    );

    return {
      text: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      durationMs,
      words,
    };
  }
}

// ============================================
// OpenAI Whisper Service
// ============================================

class WhisperService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioUri: string,
    language: string = 'en'
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    console.log('[speechToText] Whisper transcribe called', { audioUri, language, ts: startTime });

    // Read file info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    console.log('[speechToText] file info', { exists: fileInfo.exists, size: fileInfo.size, uri: audioUri });
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    // Create form data manually for React Native
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Build multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    const fileName = audioUri.split('/').pop() || 'audio.wav';

    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += 'Content-Type: audio/wav\r\n\r\n';

    // We need to use a different approach for binary data in RN
    // Using uploadAsync instead
    const response = await FileSystem.uploadAsync(OPENAI_API_URL, audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      parameters: {
        model: 'whisper-1',
        language,
        response_format: 'verbose_json',
      },
    });

    if (response.status !== 200) {
      console.error('[speechToText] Whisper API error', { status: response.status, body: response.body });
      throw new Error(`Whisper API error: ${response.status} - ${response.body}`);
    }

    const result = JSON.parse(response.body);
    const durationMs = Date.now() - startTime;
    console.log('[speechToText] Whisper transcribe completed', { durationMs });

    // Extract words if available (verbose_json format)
    const words: TranscriptionWord[] = (result.words || []).map(
      (w: { word: string; start: number; end: number }) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: 1, // Whisper doesn't provide word-level confidence
      })
    );

    return {
      text: result.text || '',
      confidence: 1, // Whisper doesn't provide overall confidence
      durationMs,
      words: words.length > 0 ? words : undefined,
    };
  }
}

// ============================================
// Main STT Service
// ============================================

class SpeechToTextService {
  private config: STTConfig | null = null;
  private deepgram: DeepgramService | null = null;
  private whisper: WhisperService | null = null;

  /**
   * Configure the STT service
   */
  configure(config: STTConfig): void {
    this.config = config;

    if (config.provider === 'deepgram') {
      this.deepgram = new DeepgramService(config.apiKey);
    } else if (config.provider === 'whisper') {
      this.whisper = new WhisperService(config.apiKey);
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.config !== null && (this.deepgram !== null || this.whisper !== null);
  }

  /**
   * Get current provider
   */
  getProvider(): STTProvider | null {
    return this.config?.provider || null;
  }

  /**
   * Transcribe audio file
   */
  async transcribe(audioUri: string): Promise<TranscriptionResult> {
    if (!this.config) {
      throw new Error('STT service not configured');
    }

    const language = this.config.language || 'en';

    if (this.config.provider === 'deepgram' && this.deepgram) {
      return this.deepgram.transcribe(audioUri, language);
    } else if (this.config.provider === 'whisper' && this.whisper) {
      return this.whisper.transcribe(audioUri, language);
    }

    throw new Error(`Unsupported STT provider: ${this.config.provider}`);
  }

  /**
   * Transcribe with auto-configuration from environment
   */
  async transcribeAuto(audioUri: string): Promise<TranscriptionResult> {
    // Try to auto-configure from environment variables
    if (!this.isConfigured()) {
      const deepgramKey = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY;
      const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

      if (deepgramKey) {
        this.configure({
          provider: 'deepgram',
          apiKey: deepgramKey,
        });
      } else if (openaiKey) {
        this.configure({
          provider: 'whisper',
          apiKey: openaiKey,
        });
      } else {
        throw new Error('No STT API key configured. Set EXPO_PUBLIC_DEEPGRAM_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY');
      }
    }

    return this.transcribe(audioUri);
  }
}

// Export singleton instance
export const speechToTextService = new SpeechToTextService();

// Export classes for direct use
export { DeepgramService, WhisperService, SpeechToTextService };
