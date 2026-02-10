/**
 * Voice Pipeline Service
 * End-to-end STT → LLM → TTS pipeline for J.A.R.V.I.S.
 */
import { audioRecordingService, RecordingResult } from './audioRecording';
import { speechToTextService, TranscriptionResult } from './speechToText';
import { openAIService, JarvisContext, GenerateResponseResult } from './openaiService';
import { voiceOutputService } from './textToSpeech';

// ============================================
// Types
// ============================================

export type PipelineState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface PipelineResponse {
  userTranscript: string;
  assistantResponse: string;
  transcriptionTimeMs: number;
  llmTimeMs: number;
  ttsTimeMs: number;
  totalTimeMs: number;
}

export interface PipelineCallbacks {
  onStateChange?: (state: PipelineState) => void;
  onTranscript?: (transcript: string) => void;
  onResponse?: (response: string) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: PipelineResponse) => void;
  onStreamChunk?: (chunk: string) => void;
}

export interface PipelineOptions {
  context?: JarvisContext;
  streamLLM?: boolean;
  playAudio?: boolean;
  minRecordingMs?: number;
  maxRecordingMs?: number;
}

// ============================================
// Conversation History
// ============================================

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class ConversationHistory {
  private turns: ConversationTurn[] = [];
  private maxTurns: number = 10; // 5 exchanges = 10 turns

  add(role: 'user' | 'assistant', content: string): void {
    this.turns.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Trim to max turns
    if (this.turns.length > this.maxTurns) {
      this.turns = this.turns.slice(-this.maxTurns);
    }
  }

  getHistory(): { role: 'user' | 'assistant'; content: string }[] {
    return this.turns.map(({ role, content }) => ({ role, content }));
  }

  clear(): void {
    this.turns = [];
  }

  get length(): number {
    return this.turns.length;
  }
}

// ============================================
// Voice Pipeline Service
// ============================================

class VoicePipelineService {
  private state: PipelineState = 'idle';
  private conversationHistory: ConversationHistory;
  private callbacks: PipelineCallbacks = {};
  private isInitialized: boolean = false;
  private currentRecordingUri: string | null = null;

  constructor() {
    this.conversationHistory = new ConversationHistory();
  }

  /**
   * Initialize the pipeline
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Initialize voice output
      await voiceOutputService.initialize();

      // Request audio permissions
      const hasPermission = await audioRecordingService.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize voice pipeline:', error);
      return false;
    }
  }

  /**
   * Set callbacks for pipeline events
   */
  setCallbacks(callbacks: PipelineCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Update a single callback
   */
  setCallback<K extends keyof PipelineCallbacks>(
    key: K,
    callback: PipelineCallbacks[K]
  ): void {
    this.callbacks[key] = callback;
  }

  /**
   * Get current state
   */
  getState(): PipelineState {
    return this.state;
  }

  /**
   * Update state and notify
   */
  private setState(state: PipelineState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  /**
   * Start listening for voice input
   */
  async startListening(): Promise<void> {
    if (this.state !== 'idle') {
      console.warn('Pipeline is not idle, cannot start listening');
      return;
    }

    await this.initialize();
    this.setState('listening');

    try {
      // Start recording with audio level callback
      await audioRecordingService.startRecording((level) => {
        this.callbacks.onAudioLevel?.(level.level);
      });
    } catch (error) {
      this.setState('error');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop listening and process the voice input
   */
  async stopListening(options: PipelineOptions = {}): Promise<PipelineResponse | null> {
    if (this.state !== 'listening') {
      console.warn('Pipeline is not listening');
      return null;
    }

    const startTime = Date.now();
    let transcriptionTime = 0;
    let llmTime = 0;
    let ttsTime = 0;

    try {
      // Stop recording
      const recording = await audioRecordingService.stopRecording();
      if (!recording) {
        throw new Error('No recording available');
      }

      this.currentRecordingUri = recording.uri;

      // Check minimum duration
      const minMs = options.minRecordingMs ?? 500;
      if (recording.durationMs < minMs) {
        this.setState('idle');
        return null;
      }

      // Transcribe
      this.setState('transcribing');
      const transcribeStart = Date.now();
      const transcription = await speechToTextService.transcribeAuto(recording.uri);
      transcriptionTime = Date.now() - transcribeStart;

      if (!transcription.text || transcription.text.trim() === '') {
        this.setState('idle');
        return null;
      }

      this.callbacks.onTranscript?.(transcription.text);
      this.conversationHistory.add('user', transcription.text);

      // Generate LLM response
      this.setState('thinking');
      const llmStart = Date.now();

      let assistantResponse = '';

      if (options.streamLLM && this.callbacks.onStreamChunk) {
        // Streaming mode
        assistantResponse = await openAIService.stream(
          transcription.text,
          (chunk) => {
            this.callbacks.onStreamChunk?.(chunk);
          },
          this.buildContext(options.context)
        );
      } else {
        // Non-streaming mode
        const result = await openAIService.generateResponse({
          prompt: transcription.text,
          context: this.buildContext(options.context),
        });
        assistantResponse = result.content;
      }

      llmTime = Date.now() - llmStart;

      if (!assistantResponse) {
        throw new Error('No response from LLM');
      }

      this.callbacks.onResponse?.(assistantResponse);
      this.conversationHistory.add('assistant', assistantResponse);

      // Text-to-Speech
      if (options.playAudio !== false) {
        this.setState('speaking');
        const ttsStart = Date.now();

        await voiceOutputService.speak(assistantResponse, {
          onComplete: () => {
            this.setState('idle');
          },
          onError: (error) => {
            console.error('TTS error:', error);
            this.setState('idle');
          },
        });

        ttsTime = Date.now() - ttsStart;
      } else {
        this.setState('idle');
      }

      const totalTime = Date.now() - startTime;

      const result: PipelineResponse = {
        userTranscript: transcription.text,
        assistantResponse,
        transcriptionTimeMs: transcriptionTime,
        llmTimeMs: llmTime,
        ttsTimeMs: ttsTime,
        totalTimeMs: totalTime,
      };

      this.callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      this.setState('error');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      
      // Reset to idle after error
      setTimeout(() => {
        if (this.state === 'error') {
          this.setState('idle');
        }
      }, 2000);

      return null;
    }
  }

  /**
   * Cancel current operation
   */
  async cancel(): Promise<void> {
    if (this.state === 'listening') {
      await audioRecordingService.cancelRecording();
    }

    if (this.state === 'speaking') {
      await voiceOutputService.stop();
    }

    this.setState('idle');
  }

  /**
   * Process text input directly (skip STT)
   */
  async processText(
    text: string,
    options: PipelineOptions = {}
  ): Promise<PipelineResponse | null> {
    if (this.state !== 'idle') {
      console.warn('Pipeline is not idle');
      return null;
    }

    const startTime = Date.now();
    let llmTime = 0;
    let ttsTime = 0;

    try {
      this.conversationHistory.add('user', text);

      // Generate LLM response
      this.setState('thinking');
      const llmStart = Date.now();

      let assistantResponse = '';

      if (options.streamLLM && this.callbacks.onStreamChunk) {
        assistantResponse = await openAIService.stream(
          text,
          (chunk) => {
            this.callbacks.onStreamChunk?.(chunk);
          },
          this.buildContext(options.context)
        );
      } else {
        const result = await openAIService.generateResponse({
          prompt: text,
          context: this.buildContext(options.context),
        });
        assistantResponse = result.content;
      }

      llmTime = Date.now() - llmStart;

      if (!assistantResponse) {
        throw new Error('No response from LLM');
      }

      this.callbacks.onResponse?.(assistantResponse);
      this.conversationHistory.add('assistant', assistantResponse);

      // Text-to-Speech
      if (options.playAudio !== false) {
        this.setState('speaking');
        const ttsStart = Date.now();

        await voiceOutputService.speak(assistantResponse, {
          onComplete: () => {
            this.setState('idle');
          },
          onError: (error) => {
            console.error('TTS error:', error);
            this.setState('idle');
          },
        });

        ttsTime = Date.now() - ttsStart;
      } else {
        this.setState('idle');
      }

      const totalTime = Date.now() - startTime;

      const result: PipelineResponse = {
        userTranscript: text,
        assistantResponse,
        transcriptionTimeMs: 0,
        llmTimeMs: llmTime,
        ttsTimeMs: ttsTime,
        totalTimeMs: totalTime,
      };

      this.callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      this.setState('error');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Build context with conversation history
   */
  private buildContext(additionalContext?: JarvisContext): JarvisContext {
    return {
      ...additionalContext,
      conversationHistory: this.conversationHistory.getHistory().map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory.clear();
    openAIService.clearHistory();
  }

  /**
   * Get conversation history length
   */
  getHistoryLength(): number {
    return this.conversationHistory.length;
  }

  /**
   * Check if pipeline is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.state === 'idle';
  }
}

// ============================================
// Export
// ============================================

export const voicePipelineService = new VoicePipelineService();

export { VoicePipelineService, ConversationHistory };
