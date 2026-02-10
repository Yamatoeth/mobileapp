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
export {
  healthKitService,
  HealthKitService,
  type BiometricReading,
  type HRVReading,
  type HeartRateReading,
  type SleepSample,
  type HealthKitStatus,
} from './healthKit';

// Storage & AI
export * from './storage';
export * from './ai';

// OpenAI / J.A.R.V.I.S.
export {
  openAIService,
  OpenAIService,
  JARVIS_SYSTEM_PROMPT,
  type Message as OpenAIMessage,
  type BiometricContext,
  type CalendarContext,
  type JarvisContext,
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
export {
  stateMachineService,
  THRESHOLDS,
  VALID_TRANSITIONS,
  type StateTransition,
  type TransitionLog,
  type StateDetectionInput,
  type StateDetectionResult,
} from './stateMachine';

// Calendar
export {
  calendarService,
  type CalendarEvent,
  type Attendee,
  type ActiveEventInfo,
  type TodaySchedule,
} from './calendarService';
