/**
 * Services Index
 * Central export for all service modules
 */

// API & Backend
export { default as apiClient, ApiError } from './apiClient';

// Audio & Voice
export {
  audioRecordingService,
  AudioRecordingService,
  type RecordingResult,
  type AudioLevel,
  type RecordingState,
} from './audioRecording';

export {
  speechToTextService,
  DeepgramService,
  WhisperService,
  SpeechToTextService,
  type TranscriptionResult,
  type TranscriptionWord,
  type STTProvider,
} from './speechToText';

// Health
// HealthKit removed in Phase 1 pivot — health service omitted

// Storage & AI
export * from './storage';
export * from './ai';

// OpenAI / J.A.R.V.I.S.
export {
  openAIService,
  OpenAIService,
  JARVIS_SYSTEM_PROMPT,
  type Message as OpenAIMessage,
  type GenerateResponseOptions,
  type GenerateResponseResult,
} from './openaiService';

// Text-to-Speech
export {
  textToSpeechService,
  audioPlaybackService,
  voiceOutputService,
  TextToSpeechService,
  ElevenLabsService,
  OpenAITTSService,
  AudioPlaybackService,
  VoiceOutputService,
  ELEVENLABS_VOICES,
  OPENAI_VOICES,
  type TTSProvider,
  type TTSConfig,
  type SynthesizeOptions,
  type SynthesizeResult,
} from './textToSpeech';

// Voice Pipeline (STT → LLM → TTS)
export {
  voicePipelineService,
  VoicePipelineService,
  ConversationHistory,
  type PipelineState,
  type PipelineResponse,
  type PipelineCallbacks,
  type PipelineOptions,
} from './voicePipeline';

// State Machine
// State machine removed — stateMachine service omitted

// Calendar service removed in Phase 1 pivot — frontend calendar hooks/types are feature-flagged

// Location
export {
  locationService,
  type LocationType,
  type Coordinates,
  type LocationInfo,
  type AddressInfo,
  type SavedLocation,
  type LocationChangeEvent,
} from './locationService';

// Context Aggregation (server-backed)
export { default as contextService, getServerContext } from './contextService';

// WebSocket client for voice streaming
export { default as WSClient } from './wsClient';
